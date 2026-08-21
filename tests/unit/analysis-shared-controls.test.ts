import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  acquireSharedAnalysisAdmission,
  analysisControlConfigurationStatus,
  AnalysisUsageCostTracker,
  anonymousAnalysisIdentifier,
} from "@/lib/analysis/admission-control";
import type { SharedRedis } from "@/lib/analysis/shared-redis";

const productionEnvironment = {
  VERCEL_ENV: "production",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "private-token",
  ANALYSIS_RATE_LIMIT_SECRET: "a-private-identifier-secret-at-least-32-characters",
  ANALYSIS_RATE_LIMIT_WINDOW_SECONDS: "3600",
  ANALYSIS_RATE_LIMIT_MAX_REQUESTS: "6",
  ANALYSIS_EXTENDED_RATE_LIMIT_MAX_REQUESTS: "3",
  ANALYSIS_GLOBAL_MAX_CONCURRENCY: "2",
  ANALYSIS_GLOBAL_LEASE_SECONDS: "300",
  ANALYSIS_DAILY_BUDGET_USD: "5",
  ANALYSIS_TOTAL_BUDGET_USD: "25",
  ANALYSIS_NORMAL_RESERVE_USD: "0.20",
  ANALYSIS_EXTENDED_RESERVE_USD: "0.40",
  ANALYSIS_BUDGET_EPOCH: "release-1",
} as const;

function request() {
  return new Request("https://opportunityfacts.vercel.app/api/analyze", {
    headers: { "x-vercel-forwarded-for": "203.0.113.42" },
  });
}

class RecordedRedis implements SharedRedis {
  readonly commands: readonly unknown[][] = [];
  constructor(private readonly outcomes: unknown[] = [["OK"], 1]) {}
  async command(command: readonly unknown[]): Promise<unknown> {
    (this.commands as unknown[][]).push([...command]);
    return this.outcomes.shift() ?? 1;
  }
}

describe("deployment-wide paid-analysis controls", () => {
  it("fails closed in production when any shared protection is missing", async () => {
    expect(analysisControlConfigurationStatus({ VERCEL_ENV: "production" })).toEqual({
      required: true,
      ready: false,
      missing: ["shared_store", "identifier_secret", "budget_limits", "operation_reservations"],
    });
    await expect(acquireSharedAnalysisAdmission(request(), "normal", {
      environment: { VERCEL_ENV: "production" },
      redis: null,
    })).resolves.toMatchObject({ allowed: false, code: "CONTROLS_UNAVAILABLE" });
  });

  it("atomically reserves rate, weighted global concurrency, and hard budget without storing a raw IP", async () => {
    const redis = new RecordedRedis();
    const lease = await acquireSharedAnalysisAdmission(request(), "extended", {
      environment: productionEnvironment,
      redis,
      now: () => Date.parse("2026-08-20T12:00:00.000Z"),
      tokenFactory: () => "lease-token",
    });
    expect(lease.allowed).toBe(true);
    const serialized = JSON.stringify(redis.commands[0]);
    expect(serialized).not.toContain("203.0.113.42");
    expect(serialized).not.toContain(productionEnvironment.ANALYSIS_RATE_LIMIT_SECRET);
    expect(redis.commands[0]).toContain(2); // Extended Research occupies both provider-family slots.
    if (lease.allowed) await lease.release(125);
    expect(redis.commands[1]).toEqual(expect.arrayContaining(["lease-token", 2, -275]));
  });

  it.each([
    ["RATE", "RATE_LIMITED"],
    ["BUSY", "ANALYSIS_BUSY"],
    ["BUDGET", "DEMO_BUDGET_EXHAUSTED"],
  ] as const)("maps atomic %s rejection to %s", async (redisOutcome, code) => {
    const decision = await acquireSharedAnalysisAdmission(request(), "normal", {
      environment: productionEnvironment,
      redis: new RecordedRedis([[redisOutcome]]),
    });
    expect(decision).toMatchObject({ allowed: false, code });
  });

  it("uses an HMAC identifier and never exposes the address", () => {
    const identifier = anonymousAnalysisIdentifier(request(), productionEnvironment.ANALYSIS_RATE_LIMIT_SECRET);
    expect(identifier).toMatch(/^[a-f0-9]{64}$/u);
    expect(identifier).not.toContain("203.0.113.42");
  });

  it("reconciles known token usage only when deployment pricing is explicit", () => {
    const tracker = new AnalysisUsageCostTracker();
    tracker.telemetry({
      stage: "normal_model",
      durationMs: 1,
      outcome: "completed",
      usage: { inputTokens: 1_000, cachedInputTokens: 200, outputTokens: 500, reasoningTokens: 0, totalTokens: 1_500 },
    });
    expect(tracker.estimatedMilliUsd({})).toBeNull();
    expect(tracker.estimatedMilliUsd({
      ANALYSIS_INPUT_USD_PER_MILLION: "2",
      ANALYSIS_CACHED_INPUT_USD_PER_MILLION: "0.2",
      ANALYSIS_OUTPUT_USD_PER_MILLION: "8",
    })).toBe(6);
  });
});
