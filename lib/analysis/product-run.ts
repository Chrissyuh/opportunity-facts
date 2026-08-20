import "server-only";

import type { AnalyzeRequest, AnalysisPipelineResult, AnalyzePipelineOptions } from "./pipeline";
import { analyzeRequest } from "./pipeline";
import { fetchPublicPage } from "./fetch";
import { extractFetchedPage } from "./html-extraction";
import {
  analysisFailureCacheKey,
  ANALYSIS_FAILURE_CACHE_TTL_SECONDS,
  createAnalysisFailureCache,
  createCachedQualityFailure,
  deleteFailureCacheSafely,
  NoopAnalysisFailureCache,
  readFailureCacheSafely,
  shouldBypassFailureCache,
  sourceTextFingerprint,
  writeFailureCacheSafely,
  type AnalysisFailureCache,
  type CachedQualityFailure,
} from "./failure-cache";
import { ANALYZER_VERSION } from "./analyzer-version";
import type { AnalysisProgressSink } from "./progress";
import type { AnalysisTelemetrySink } from "./telemetry";

export type AnalysisProductResult =
  | ({ readonly kind: "card" } & AnalysisPipelineResult)
  | {
      readonly kind: "quality_failure";
      readonly cached: boolean;
      /** Safe to retain for same-browser and durable retry suppression. */
      readonly cacheEligible: boolean;
      readonly quality: Pick<CachedQualityFailure, "classification" | "reasons" | "createdAt" | "expiresAt" | "analyzerVersion">;
    };

export interface RunProductAnalysisOptions extends AnalyzePipelineOptions {
  readonly failureCache?: AnalysisFailureCache;
  /** Injectable so cache freshness can be verified without network access in deterministic tests. */
  readonly revalidateFailureCache?: FailureCacheFreshnessRevalidator;
  readonly onProgress?: AnalysisProgressSink;
  readonly onTelemetry?: AnalysisTelemetrySink;
}

export type FailureCacheFreshnessRevalidator = (
  url: string,
  options: { readonly signal?: AbortSignal },
) => Promise<string>;

export const revalidateSubmittedPageFingerprint: FailureCacheFreshnessRevalidator = async (
  url,
  options,
) => {
  const fetched = await fetchPublicPage(url, { signal: options.signal });
  return sourceTextFingerprint(extractFetchedPage(fetched).text);
};

export async function runProductAnalysis(
  input: AnalyzeRequest,
  options: RunProductAnalysisOptions = {},
): Promise<AnalysisProductResult> {
  const totalStartedAt = performance.now();
  const finish = <T extends AnalysisProductResult>(value: T): T => {
    options.onTelemetry?.({ stage: "total", durationMs: performance.now() - totalStartedAt, outcome: "completed" });
    return value;
  };
  try {
    const {
      failureCache,
      revalidateFailureCache = revalidateSubmittedPageFingerprint,
      ...pipelineOptions
    } = options;
    const cache = failureCache ?? createAnalysisFailureCache();
    const canonicalStartedAt = performance.now();
    const url = input.mode === "url" ? input.url : null;
    const bypass = url !== null && shouldBypassFailureCache(url);
    const key = url === null || bypass ? null : analysisFailureCacheKey(url);
    options.onTelemetry?.({ stage: "canonical_url", durationMs: performance.now() - canonicalStartedAt, outcome: "completed" });
    if (bypass) {
      options.onProgress?.({ type: "cache_checked", state: "bypass" });
    } else if (key !== null && url !== null) {
      const cacheStartedAt = performance.now();
      const cached = await readFailureCacheSafely(cache, key, options.signal);
      options.onTelemetry?.({ stage: "failure_cache_lookup", durationMs: performance.now() - cacheStartedAt, outcome: "completed" });
      if (cached !== null) {
        let unchanged = true;
        if (cached.sourceFingerprint !== null) {
          const revalidationStartedAt = performance.now();
          try {
            const currentFingerprint = await revalidateFailureCache(url, { signal: options.signal });
            options.onTelemetry?.({
              stage: "failure_cache_revalidation",
              durationMs: performance.now() - revalidationStartedAt,
              outcome: "completed",
            });
            unchanged = currentFingerprint === cached.sourceFingerprint;
          } catch (error) {
            const cancelled = options.signal?.aborted === true;
            options.onTelemetry?.({
              stage: "failure_cache_revalidation",
              durationMs: performance.now() - revalidationStartedAt,
              outcome: cancelled ? "cancelled" : "failed",
            });
            if (cancelled) throw error;
            // A temporary fetch/parser failure must not spend model tokens or
            // erase a still-valid deterministic quality result.
            unchanged = true;
          }
        }
        if (unchanged) {
          options.onProgress?.({ type: "cache_checked", state: "hit" });
          options.onProgress?.({ type: "quality_complete", outcome: "insufficient_quality" });
          return finish({
            kind: "quality_failure",
            cached: true,
            cacheEligible: true,
            quality: {
              classification: cached.classification,
              reasons: cached.reasons,
              createdAt: cached.createdAt,
              expiresAt: cached.expiresAt,
              analyzerVersion: cached.analyzerVersion,
            },
          });
        }
        await deleteFailureCacheSafely(cache, key, options.signal);
      }
      options.onProgress?.({
        type: "cache_checked",
        state: cache instanceof NoopAnalysisFailureCache ? "unavailable" : "miss",
      });
    }

    const result = await analyzeRequest(input, pipelineOptions);
    if (result.quality.outcome !== "insufficient_quality") return finish({ kind: "card", ...result });
    if (key !== null && result.quality.cacheEligible) {
      await writeFailureCacheSafely(
        cache,
        key,
        createCachedQualityFailure(result.quality.reasons, { sourceFingerprint: result.sourceFingerprint }),
        options.signal,
      );
    }
    return finish({
      kind: "quality_failure",
      cached: false,
      cacheEligible: result.quality.cacheEligible,
      quality: {
        classification: "INSUFFICIENT_SOURCE_QUALITY",
        reasons: result.quality.reasons.slice(0, 5),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ANALYSIS_FAILURE_CACHE_TTL_SECONDS * 1_000).toISOString(),
        analyzerVersion: ANALYZER_VERSION,
      },
    });
  } catch (error) {
    options.onTelemetry?.({
      stage: "total",
      durationMs: performance.now() - totalStartedAt,
      outcome: options.signal?.aborted ? "cancelled" : "failed",
    });
    throw error;
  }
}
