import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ analyzeRequest: vi.fn() }));
vi.mock("@/lib/analysis/pipeline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analysis/pipeline")>("@/lib/analysis/pipeline");
  return { ...actual, analyzeRequest: mocks.analyzeRequest };
});

import { createCachedQualityFailure, type AnalysisFailureCache } from "@/lib/analysis/failure-cache";
import { runProductAnalysis } from "@/lib/analysis/product-run";
import { opportunityCardSchema } from "@/lib/opportunity/schema";

const previousBypass = process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS;
afterEach(() => {
  mocks.analyzeRequest.mockReset();
  if (previousBypass === undefined) delete process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS;
  else process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS = previousBypass;
});

function fakeCache(value: ReturnType<typeof createCachedQualityFailure> | null) {
  return {
    get: vi.fn(async (...args: Parameters<AnalysisFailureCache["get"]>) => {
      void args;
      return value;
    }),
    set: vi.fn(async (...args: Parameters<AnalysisFailureCache["set"]>) => {
      void args;
    }),
    delete: vi.fn(async (...args: Parameters<AnalysisFailureCache["delete"]>) => {
      void args;
    }),
  } satisfies AnalysisFailureCache;
}

const reviewedCard = opportunityCardSchema.parse(JSON.parse(readFileSync("data/opportunities/mites-summer-2027.json", "utf8")));

function pipelineResult(outcome: "good" | "insufficient_quality", cacheEligible: boolean) {
  return {
    card: reviewedCard,
    reviewedPages: [],
    pageWarnings: [],
    evidenceWarnings: [],
    attentionItems: [],
    quality: {
      outcome,
      cacheEligible,
      reasons: outcome === "insufficient_quality" ? [{
        code: "TOO_FEW_SUPPORTED_FACTS",
        priority: "high",
        title: "Not enough information",
        explanation: "Too few supported facts survived validation.",
      }] : [],
    },
    validationStats: { attemptedSupportedClaims: 1, retainedSupportedClaims: 1, withheldSupportedClaims: 0 },
    sourceFingerprint: "a".repeat(64),
    familyFailures: [],
  };
}

describe("analysis product orchestration", () => {
  it("returns a durable quality failure without starting extraction", async () => {
    const cached = createCachedQualityFailure([{
      code: "TOO_FEW_SUPPORTED_FACTS",
      priority: "high",
      title: "Not enough information",
      explanation: "Too few supported facts survived validation.",
    }], { sourceFingerprint: "a".repeat(64) });
    const cache = fakeCache(cached);
    const revalidateFailureCache = vi.fn(async () => "a".repeat(64));
    const telemetry = vi.fn();
    const result = await runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: cache, revalidateFailureCache, onTelemetry: telemetry },
    );
    expect(result).toMatchObject({ kind: "quality_failure", cached: true, cacheEligible: true });
    expect(revalidateFailureCache).toHaveBeenCalledWith("https://program.example/", { signal: undefined });
    expect(mocks.analyzeRequest).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      stage: "failure_cache_revalidation",
      outcome: "completed",
    }));
  });

  it("invalidates a durable failure and analyzes when submitted-page content changed", async () => {
    const cache = fakeCache(createCachedQualityFailure([{
      code: "TOO_FEW_SUPPORTED_FACTS",
      priority: "high",
      title: "Not enough information",
      explanation: "Too few supported facts survived validation.",
    }], { sourceFingerprint: "a".repeat(64) }));
    const revalidateFailureCache = vi.fn(async () => "b".repeat(64));
    mocks.analyzeRequest.mockResolvedValue(pipelineResult("good", false));
    await expect(runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: cache, revalidateFailureCache },
    )).resolves.toMatchObject({ kind: "card" });
    expect(cache.delete).toHaveBeenCalledOnce();
    expect(mocks.analyzeRequest).toHaveBeenCalledOnce();
  });

  it("retains a valid cached failure when freshness acquisition fails", async () => {
    const cache = fakeCache(createCachedQualityFailure([{
      code: "TOO_FEW_SUPPORTED_FACTS",
      priority: "high",
      title: "Not enough information",
      explanation: "Too few supported facts survived validation.",
    }], { sourceFingerprint: "a".repeat(64) }));
    const revalidateFailureCache = vi.fn(async () => { throw new Error("temporary fetch failure"); });
    const telemetry = vi.fn();
    await expect(runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: cache, revalidateFailureCache, onTelemetry: telemetry },
    )).resolves.toMatchObject({ kind: "quality_failure", cached: true, cacheEligible: true });
    expect(cache.delete).not.toHaveBeenCalled();
    expect(mocks.analyzeRequest).not.toHaveBeenCalled();
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      stage: "failure_cache_revalidation",
      outcome: "failed",
    }));
  });

  it("makes bypass hosts skip cache reads without changing the pipeline input", async () => {
    process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS = "program.example";
    const cache = fakeCache(createCachedQualityFailure([{
      code: "TOO_FEW_SUPPORTED_FACTS",
      priority: "high",
      title: "Not enough information",
      explanation: "Too few supported facts survived validation.",
    }]));
    mocks.analyzeRequest.mockResolvedValue(pipelineResult("good", false));
    const revalidateFailureCache = vi.fn(async () => "a".repeat(64));
    const input = { mode: "url" as const, url: "https://program.example/" };
    const result = await runProductAnalysis(input, { failureCache: cache, revalidateFailureCache });
    expect(result.kind).toBe("card");
    expect(cache.get).not.toHaveBeenCalled();
    expect(revalidateFailureCache).not.toHaveBeenCalled();
    expect(mocks.analyzeRequest).toHaveBeenCalledWith(input, expect.not.objectContaining({ failureCache: cache }));
  });

  it("does not durable-cache a temporary or provider failure", async () => {
    const cache = fakeCache(null);
    mocks.analyzeRequest.mockRejectedValue(new Error("temporary provider failure"));
    await expect(runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: cache },
    )).rejects.toThrow("temporary provider failure");
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("writes only eligible deterministic quality failures", async () => {
    const eligibleCache = fakeCache(null);
    mocks.analyzeRequest.mockResolvedValueOnce(pipelineResult("insufficient_quality", true));
    await expect(runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: eligibleCache },
    )).resolves.toMatchObject({ kind: "quality_failure", cached: false, cacheEligible: true });
    expect(eligibleCache.set).toHaveBeenCalledOnce();
    expect(eligibleCache.set.mock.calls[0]?.[2]).toBe(14 * 24 * 60 * 60);

    const ineligibleCache = fakeCache(null);
    mocks.analyzeRequest.mockResolvedValueOnce(pipelineResult("insufficient_quality", false));
    await expect(runProductAnalysis(
      { mode: "url", url: "https://temporary.example/" },
      { failureCache: ineligibleCache },
    )).resolves.toMatchObject({ kind: "quality_failure", cached: false, cacheEligible: false });
    expect(ineligibleCache.set).not.toHaveBeenCalled();
  });

  it("makes bypass skip both cache reads and writes", async () => {
    process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS = "program.example";
    const cache = fakeCache(null);
    mocks.analyzeRequest.mockResolvedValue(pipelineResult("insufficient_quality", true));
    await runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: cache },
    );
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("fails open when durable reads or writes are unavailable", async () => {
    const unavailable: AnalysisFailureCache = {
      get: vi.fn(async () => { throw new Error("cache offline"); }),
      set: vi.fn(async () => { throw new Error("cache offline"); }),
      delete: vi.fn(async () => undefined),
    };
    mocks.analyzeRequest.mockResolvedValueOnce(pipelineResult("good", false));
    await expect(runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: unavailable },
    )).resolves.toMatchObject({ kind: "card" });

    mocks.analyzeRequest.mockResolvedValueOnce(pipelineResult("insufficient_quality", true));
    await expect(runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: unavailable },
    )).resolves.toMatchObject({ kind: "quality_failure", cached: false });
  });

  it("records failed total telemetry when the pipeline throws", async () => {
    const telemetry = vi.fn();
    mocks.analyzeRequest.mockRejectedValue(new Error("provider stopped"));
    await expect(runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: fakeCache(null), onTelemetry: telemetry },
    )).rejects.toThrow("provider stopped");
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({ stage: "total", outcome: "failed" }));
  });

  it("records cancelled total telemetry when the request signal is aborted", async () => {
    const telemetry = vi.fn();
    const controller = new AbortController();
    mocks.analyzeRequest.mockImplementation(async () => {
      controller.abort();
      throw new DOMException("The request was cancelled.", "AbortError");
    });
    await expect(runProductAnalysis(
      { mode: "url", url: "https://program.example/" },
      { failureCache: fakeCache(null), onTelemetry: telemetry, signal: controller.signal },
    )).rejects.toThrow("The request was cancelled.");
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({ stage: "total", outcome: "cancelled" }));
  });
});
