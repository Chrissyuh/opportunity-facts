import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { ANALYZER_VERSION } from "./analyzer-version";
import { createSharedRedis, type SharedRedis } from "./shared-redis";
import type { AnalysisTiming, AnalysisTelemetrySink } from "./telemetry";

export const DEFAULT_ANALYSIS_MAX_CONCURRENCY = 2;
export const MAX_ANALYSIS_MAX_CONCURRENCY = 16;

let activeAnalyses = 0;

export function isAnalysisEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const configured = environment.ANALYSIS_ENABLED?.trim().toLowerCase();
  if (configured === undefined || configured === "") return false;
  return ["1", "true", "yes", "on"].includes(configured);
}

export function configuredAnalysisMaxConcurrency(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const configured = environment.ANALYSIS_MAX_CONCURRENCY?.trim();
  if (configured === undefined || configured === "") {
    return DEFAULT_ANALYSIS_MAX_CONCURRENCY;
  }
  if (!/^\d+$/u.test(configured)) return 1;
  const parsed = Number(configured);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_ANALYSIS_MAX_CONCURRENCY
    ? parsed
    : 1;
}

/**
 * Best-effort defense for one Node.js process. The deployment gateway and
 * provider project must still enforce distributed request and spend limits.
 */
export function tryAcquireAnalysisSlot(): (() => void) | null {
  if (activeAnalyses >= configuredAnalysisMaxConcurrency()) return null;
  activeAnalyses += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeAnalyses = Math.max(0, activeAnalyses - 1);
  };
}

export type AnalysisOperation = "normal" | "extended";
export type AdmissionRejectionCode = "RATE_LIMITED" | "ANALYSIS_BUSY" | "DEMO_BUDGET_EXHAUSTED" | "CONTROLS_UNAVAILABLE";

export interface SharedAdmissionRejection {
  readonly allowed: false;
  readonly code: AdmissionRejectionCode;
  readonly retryAfterSeconds: number;
}

export interface SharedAdmissionLease {
  readonly allowed: true;
  readonly operation: AnalysisOperation;
  release(actualCostMilliUsd?: number | null): Promise<void>;
}

export type SharedAdmissionDecision = SharedAdmissionRejection | SharedAdmissionLease;

export interface AnalysisControlConfigurationStatus {
  readonly required: boolean;
  readonly ready: boolean;
  readonly missing: readonly ("shared_store" | "identifier_secret" | "budget_limits" | "operation_reservations")[];
}

interface SharedAdmissionConfig {
  readonly required: boolean;
  readonly rateWindowSeconds: number;
  readonly normalRateLimit: number;
  readonly extendedRateLimit: number;
  readonly globalConcurrency: number;
  readonly leaseSeconds: number;
  readonly dailyBudgetMilliUsd: number;
  readonly totalBudgetMilliUsd: number;
  readonly normalReserveMilliUsd: number;
  readonly extendedReserveMilliUsd: number;
  readonly identifierSecret: string | null;
  readonly budgetEpoch: string;
}

function enabled(value: string | undefined): boolean {
  return value !== undefined && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^\d+$/u.test(value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function usdToMilliUsd(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100_000 ? Math.ceil(parsed * 1_000) : 0;
}

function sharedAdmissionConfig(environment: Readonly<Record<string, string | undefined>>): SharedAdmissionConfig {
  const explicitRequired = environment.ANALYSIS_SHARED_CONTROLS_REQUIRED;
  const required = explicitRequired === undefined || explicitRequired.trim() === ""
    ? environment.VERCEL_ENV === "production"
    : enabled(explicitRequired);
  return {
    required,
    rateWindowSeconds: boundedInteger(environment.ANALYSIS_RATE_LIMIT_WINDOW_SECONDS, 3_600, 60, 86_400),
    normalRateLimit: boundedInteger(environment.ANALYSIS_RATE_LIMIT_MAX_REQUESTS, 6, 1, 1_000),
    extendedRateLimit: boundedInteger(environment.ANALYSIS_EXTENDED_RATE_LIMIT_MAX_REQUESTS, 3, 1, 1_000),
    globalConcurrency: boundedInteger(environment.ANALYSIS_GLOBAL_MAX_CONCURRENCY, 2, 1, 32),
    leaseSeconds: boundedInteger(environment.ANALYSIS_GLOBAL_LEASE_SECONDS, 300, 30, 900),
    dailyBudgetMilliUsd: usdToMilliUsd(environment.ANALYSIS_DAILY_BUDGET_USD),
    totalBudgetMilliUsd: usdToMilliUsd(environment.ANALYSIS_TOTAL_BUDGET_USD),
    normalReserveMilliUsd: usdToMilliUsd(environment.ANALYSIS_NORMAL_RESERVE_USD),
    extendedReserveMilliUsd: usdToMilliUsd(environment.ANALYSIS_EXTENDED_RESERVE_USD),
    identifierSecret: environment.ANALYSIS_RATE_LIMIT_SECRET?.trim() || null,
    budgetEpoch: environment.ANALYSIS_BUDGET_EPOCH?.trim().slice(0, 100) || "initial",
  };
}

export function analysisControlConfigurationStatus(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AnalysisControlConfigurationStatus {
  const config = sharedAdmissionConfig(environment);
  const missing: AnalysisControlConfigurationStatus["missing"][number][] = [];
  if (!environment.UPSTASH_REDIS_REST_URL?.trim() || !environment.UPSTASH_REDIS_REST_TOKEN?.trim()) missing.push("shared_store");
  if ((config.identifierSecret?.length ?? 0) < 32) missing.push("identifier_secret");
  const maximumReservation = Math.max(config.normalReserveMilliUsd, config.extendedReserveMilliUsd);
  if (config.dailyBudgetMilliUsd <= 0 || config.totalBudgetMilliUsd <= 0 ||
    config.dailyBudgetMilliUsd < maximumReservation || config.totalBudgetMilliUsd < maximumReservation) missing.push("budget_limits");
  if (config.normalReserveMilliUsd <= 0 || config.extendedReserveMilliUsd <= 0) missing.push("operation_reservations");
  return { required: config.required, ready: !config.required || missing.length === 0, missing };
}

function requestAddress(request: Request): string {
  const value = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "unavailable";
  return value.split(",", 1)[0]?.trim().slice(0, 128) || "unavailable";
}

export function anonymousAnalysisIdentifier(request: Request, secret: string): string {
  return createHmac("sha256", secret).update(requestAddress(request)).digest("hex");
}

const ACQUIRE_SCRIPT = `
local now = tonumber(ARGV[1])
local lease_until = tonumber(ARGV[2])
local concurrency_limit = tonumber(ARGV[3])
local rate_limit = tonumber(ARGV[4])
local rate_ttl = tonumber(ARGV[5])
local reserve = tonumber(ARGV[6])
local daily_limit = tonumber(ARGV[7])
local total_limit = tonumber(ARGV[8])
local lease_token = ARGV[9]
local weight = tonumber(ARGV[10])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
local rate_count = tonumber(redis.call('GET', KEYS[1]) or '0')
if rate_count >= rate_limit then return {'RATE'} end
if tonumber(redis.call('ZCARD', KEYS[2])) + weight > concurrency_limit then return {'BUSY'} end
local daily = tonumber(redis.call('GET', KEYS[3]) or '0')
local total = tonumber(redis.call('GET', KEYS[4]) or '0')
if daily + reserve > daily_limit or total + reserve > total_limit then return {'BUDGET'} end
local next_rate = redis.call('INCR', KEYS[1])
if next_rate == 1 then redis.call('EXPIRE', KEYS[1], rate_ttl) end
for index = 1, weight do redis.call('ZADD', KEYS[2], lease_until, lease_token .. ':' .. index) end
redis.call('EXPIRE', KEYS[2], math.ceil((lease_until - now) / 1000) + 60)
redis.call('INCRBY', KEYS[3], reserve)
redis.call('EXPIRE', KEYS[3], 172800)
redis.call('INCRBY', KEYS[4], reserve)
return {'OK'}
`;

const RELEASE_SCRIPT = `
local weight = tonumber(ARGV[2])
for index = 1, weight do redis.call('ZREM', KEYS[1], ARGV[1] .. ':' .. index) end
local adjustment = tonumber(ARGV[3])
if adjustment ~= 0 then
  local daily = math.max(0, tonumber(redis.call('GET', KEYS[2]) or '0') + adjustment)
  local total = math.max(0, tonumber(redis.call('GET', KEYS[3]) or '0') + adjustment)
  redis.call('SET', KEYS[2], daily, 'KEEPTTL')
  redis.call('SET', KEYS[3], total)
end
return 1
`;

function firstResult(value: unknown): string | null {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

function safeEpoch(value: string): string {
  return createHmac("sha256", ANALYZER_VERSION).update(value).digest("hex").slice(0, 24);
}

export async function acquireSharedAnalysisAdmission(
  request: Request,
  operation: AnalysisOperation,
  options: {
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly redis?: SharedRedis | null;
    readonly now?: () => number;
    readonly tokenFactory?: () => string;
  } = {},
): Promise<SharedAdmissionDecision> {
  const environment = options.environment ?? process.env;
  const config = sharedAdmissionConfig(environment);
  const redis = options.redis === undefined ? createSharedRedis(environment) : options.redis;
  const completeConfig = analysisControlConfigurationStatus(environment).missing.length === 0;
  if (redis === null || !completeConfig) {
    return config.required
      ? { allowed: false, code: "CONTROLS_UNAVAILABLE", retryAfterSeconds: 60 }
      : { allowed: true, operation, async release() {} };
  }

  const now = options.now?.() ?? Date.now();
  const identifier = anonymousAnalysisIdentifier(request, config.identifierSecret!);
  const rateLimit = operation === "normal" ? config.normalRateLimit : config.extendedRateLimit;
  const reserve = operation === "normal" ? config.normalReserveMilliUsd : config.extendedReserveMilliUsd;
  const concurrencyWeight = operation === "normal" ? 1 : 2;
  const windowBucket = Math.floor(now / (config.rateWindowSeconds * 1_000));
  const day = new Date(now).toISOString().slice(0, 10);
  const epoch = safeEpoch(config.budgetEpoch);
  const leaseToken = options.tokenFactory?.() ?? randomUUID();
  const rateKey = `opportunity-facts:rate:${operation}:${windowBucket}:${identifier}`;
  const activeKey = "opportunity-facts:admission:active";
  const dailyKey = `opportunity-facts:budget:daily:${day}`;
  const totalKey = `opportunity-facts:budget:total:${epoch}`;
  let result: unknown;
  try {
    result = await redis.command([
      "EVAL", ACQUIRE_SCRIPT, 4,
      rateKey, activeKey, dailyKey, totalKey,
      now, now + config.leaseSeconds * 1_000, config.globalConcurrency, rateLimit,
      config.rateWindowSeconds, reserve, config.dailyBudgetMilliUsd,
      config.totalBudgetMilliUsd, leaseToken, concurrencyWeight,
    ]);
  } catch {
    return { allowed: false, code: "CONTROLS_UNAVAILABLE", retryAfterSeconds: 60 };
  }
  const outcome = firstResult(result);
  if (outcome !== "OK") {
    return {
      allowed: false,
      code: outcome === "RATE" ? "RATE_LIMITED" : outcome === "BUSY" ? "ANALYSIS_BUSY" :
        outcome === "BUDGET" ? "DEMO_BUDGET_EXHAUSTED" : "CONTROLS_UNAVAILABLE",
      retryAfterSeconds: outcome === "RATE" ? config.rateWindowSeconds : outcome === "BUSY" ? 10 : 60,
    };
  }
  let released = false;
  return {
    allowed: true,
    operation,
    async release(actualCostMilliUsd: number | null = null) {
      if (released) return;
      released = true;
      // Unknown usage keeps the full conservative reservation. Known usage reconciles it.
      const actual = actualCostMilliUsd === null ? reserve : Math.max(0, Math.ceil(actualCostMilliUsd));
      const adjustment = actual - reserve;
      try {
        await redis.command(["EVAL", RELEASE_SCRIPT, 3, activeKey, dailyKey, totalKey, leaseToken, concurrencyWeight, adjustment]);
      } catch {
        // Lease expiry releases concurrency; retaining the reservation fails toward spend safety.
      }
    },
  };
}

export class AnalysisUsageCostTracker {
  private inputTokens = 0;
  private cachedInputTokens = 0;
  private outputTokens = 0;

  readonly telemetry: AnalysisTelemetrySink = (timing: AnalysisTiming) => {
    if (!timing.usage) return;
    this.inputTokens += timing.usage.inputTokens;
    this.cachedInputTokens += timing.usage.cachedInputTokens;
    this.outputTokens += timing.usage.outputTokens;
  };

  estimatedMilliUsd(environment: Readonly<Record<string, string | undefined>> = process.env): number | null {
    const inputRate = Number(environment.ANALYSIS_INPUT_USD_PER_MILLION);
    const cachedRate = Number(environment.ANALYSIS_CACHED_INPUT_USD_PER_MILLION);
    const outputRate = Number(environment.ANALYSIS_OUTPUT_USD_PER_MILLION);
    if (!Number.isFinite(inputRate) || inputRate <= 0 ||
      !Number.isFinite(cachedRate) || cachedRate < 0 ||
      !Number.isFinite(outputRate) || outputRate <= 0) return null;
    const uncached = Math.max(0, this.inputTokens - this.cachedInputTokens);
    const usd = (uncached * inputRate + this.cachedInputTokens * cachedRate + this.outputTokens * outputRate) / 1_000_000;
    return Math.ceil(usd * 1_000);
  }
}
