import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  configuredAnalysisMaxConcurrency,
  DEFAULT_ANALYSIS_MAX_CONCURRENCY,
  isAnalysisEnabled,
  tryAcquireAnalysisSlot,
} from "@/lib/analysis/admission-control";

const previousEnabled = process.env.ANALYSIS_ENABLED;
const previousConcurrency = process.env.ANALYSIS_MAX_CONCURRENCY;

afterEach(() => {
  if (previousEnabled === undefined) delete process.env.ANALYSIS_ENABLED;
  else process.env.ANALYSIS_ENABLED = previousEnabled;
  if (previousConcurrency === undefined) delete process.env.ANALYSIS_MAX_CONCURRENCY;
  else process.env.ANALYSIS_MAX_CONCURRENCY = previousConcurrency;
});

describe("per-process analysis admission control", () => {
  it("uses an explicit fail-closed kill switch", () => {
    expect(isAnalysisEnabled({})).toBe(false);
    expect(isAnalysisEnabled({ ANALYSIS_ENABLED: "" })).toBe(false);
    expect(isAnalysisEnabled({ ANALYSIS_ENABLED: "true" })).toBe(true);
    expect(isAnalysisEnabled({ ANALYSIS_ENABLED: "1" })).toBe(true);
    expect(isAnalysisEnabled({ ANALYSIS_ENABLED: "false" })).toBe(false);
    expect(isAnalysisEnabled({ ANALYSIS_ENABLED: "off" })).toBe(false);
    expect(isAnalysisEnabled({ ANALYSIS_ENABLED: "typo" })).toBe(false);
  });

  it("bounds configured concurrency and falls back conservatively", () => {
    expect(configuredAnalysisMaxConcurrency({})).toBe(DEFAULT_ANALYSIS_MAX_CONCURRENCY);
    expect(configuredAnalysisMaxConcurrency({ ANALYSIS_MAX_CONCURRENCY: "4" })).toBe(4);
    expect(configuredAnalysisMaxConcurrency({ ANALYSIS_MAX_CONCURRENCY: "0" })).toBe(1);
    expect(configuredAnalysisMaxConcurrency({ ANALYSIS_MAX_CONCURRENCY: "100" })).toBe(1);
    expect(configuredAnalysisMaxConcurrency({ ANALYSIS_MAX_CONCURRENCY: "many" })).toBe(1);
  });

  it("rejects excess work and releases a slot exactly once", () => {
    process.env.ANALYSIS_MAX_CONCURRENCY = "1";
    const releaseFirst = tryAcquireAnalysisSlot();
    expect(releaseFirst).toBeTypeOf("function");
    expect(tryAcquireAnalysisSlot()).toBeNull();

    releaseFirst?.();
    releaseFirst?.();
    const releaseSecond = tryAcquireAnalysisSlot();
    expect(releaseSecond).toBeTypeOf("function");
    releaseSecond?.();
  });
});
