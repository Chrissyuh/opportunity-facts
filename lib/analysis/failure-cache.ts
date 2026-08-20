import "server-only";

import { z } from "zod";
import { sha256Hex } from "@/lib/opportunity/canonical";
import { normalizePublicUrlHostname } from "@/lib/opportunity/public-url";
import { parsePublicHttpUrl } from "./url-safety";
import { ANALYZER_VERSION } from "./analyzer-version";
import type { QualityReason } from "./quality-gate";

export const ANALYSIS_FAILURE_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60;
export const ANALYSIS_FAILURE_CACHE_TIMEOUT_MS = 1_500;

const cachedReasonSchema = z.strictObject({
  code: z.string().min(1).max(100),
  title: z.string().min(1).max(160),
  explanation: z.string().min(1).max(500),
  priority: z.enum(["high", "medium"]),
});

export const cachedQualityFailureSchema = z.strictObject({
  classification: z.literal("INSUFFICIENT_SOURCE_QUALITY"),
  reasons: z.array(cachedReasonSchema).min(1).max(5),
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  analyzerVersion: z.string().min(1).max(100),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
});

export type CachedQualityFailure = z.infer<typeof cachedQualityFailureSchema>;

export interface AnalysisFailureCache {
  get(key: string, signal?: AbortSignal): Promise<CachedQualityFailure | null>;
  set(key: string, value: CachedQualityFailure, ttlSeconds: number, signal?: AbortSignal): Promise<void>;
  delete(key: string, signal?: AbortSignal): Promise<void>;
}

export class NoopAnalysisFailureCache implements AnalysisFailureCache {
  async get(): Promise<null> { return null; }
  async set(): Promise<void> {}
  async delete(): Promise<void> {}
}

interface UpstashRestResponse { readonly result?: unknown; readonly error?: string }

export class UpstashRestAnalysisFailureCache implements AnalysisFailureCache {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async command(command: readonly unknown[], signal?: AbortSignal): Promise<unknown> {
    const timeoutSignal = AbortSignal.timeout(ANALYSIS_FAILURE_CACHE_TIMEOUT_MS);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: combinedSignal,
    });
    if (!response.ok) throw new Error("The durable analysis cache did not accept the request.");
    const payload = await response.json() as UpstashRestResponse;
    if (payload.error) throw new Error("The durable analysis cache returned an error.");
    return payload.result;
  }

  async get(key: string, signal?: AbortSignal): Promise<CachedQualityFailure | null> {
    const result = await this.command(["GET", key], signal);
    if (result === null || result === undefined) return null;
    let parsedJson: unknown;
    try {
      parsedJson = typeof result === "string" ? JSON.parse(result) : result;
    } catch {
      return null;
    }
    const parsed = cachedQualityFailureSchema.safeParse(parsedJson);
    if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now()) return null;
    return parsed.data;
  }

  async set(key: string, value: CachedQualityFailure, ttlSeconds: number, signal?: AbortSignal): Promise<void> {
    cachedQualityFailureSchema.parse(value);
    await this.command(["SET", key, JSON.stringify(value), "EX", ttlSeconds], signal);
  }

  async delete(key: string, signal?: AbortSignal): Promise<void> {
    await this.command(["DEL", key], signal);
  }
}

export function createAnalysisFailureCache(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AnalysisFailureCache {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token
    ? new UpstashRestAnalysisFailureCache(url, token)
    : new NoopAnalysisFailureCache();
}

export function canonicalAnalysisUrl(input: string): string {
  return parsePublicHttpUrl(input).href;
}

export function analysisFailureCacheKey(
  canonicalUrl: string,
  analyzerVersion = ANALYZER_VERSION,
): string {
  return `opportunity-facts:quality-failure:${sha256Hex(`${analyzerVersion}\n${canonicalAnalysisUrl(canonicalUrl)}`)}`;
}

export function sourceTextFingerprint(text: string): string {
  return sha256Hex(text.replace(/\s+/gu, " ").trim());
}

export function configuredFailureCacheBypassHosts(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ReadonlySet<string> {
  return new Set((environment.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS ?? "")
    .split(",")
    .map((entry) => normalizePublicUrlHostname(entry.trim()))
    .filter(Boolean));
}

export function shouldBypassFailureCache(
  input: string | URL,
  hosts = configuredFailureCacheBypassHosts(),
): boolean {
  const hostname = normalizePublicUrlHostname(parsePublicHttpUrl(input).hostname);
  return [...hosts].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function createCachedQualityFailure(
  reasons: readonly QualityReason[],
  options: { readonly now?: Date; readonly sourceFingerprint?: string | null } = {},
): CachedQualityFailure {
  const now = options.now ?? new Date();
  return cachedQualityFailureSchema.parse({
    classification: "INSUFFICIENT_SOURCE_QUALITY",
    reasons: reasons.slice(0, 5),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ANALYSIS_FAILURE_CACHE_TTL_SECONDS * 1_000).toISOString(),
    analyzerVersion: ANALYZER_VERSION,
    sourceFingerprint: options.sourceFingerprint ?? null,
  });
}

export async function readFailureCacheSafely(
  cache: AnalysisFailureCache,
  key: string,
  signal?: AbortSignal,
): Promise<CachedQualityFailure | null> {
  try { return await cache.get(key, signal); } catch { return null; }
}

export async function writeFailureCacheSafely(
  cache: AnalysisFailureCache,
  key: string,
  value: CachedQualityFailure,
  signal?: AbortSignal,
): Promise<void> {
  try { await cache.set(key, value, ANALYSIS_FAILURE_CACHE_TTL_SECONDS, signal); } catch { /* Cache failure never changes analysis output. */ }
}

export async function deleteFailureCacheSafely(
  cache: AnalysisFailureCache,
  key: string,
  signal?: AbortSignal,
): Promise<void> {
  try { await cache.delete(key, signal); } catch { /* A stale entry must not prevent a fresh analysis. */ }
}
