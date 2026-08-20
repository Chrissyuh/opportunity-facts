import type { ModelExtractionStage, ModelUsageTelemetry } from "./model-extraction";

export type AnalysisTimingStage =
  | "canonical_url"
  | "failure_cache_lookup"
  | "failure_cache_revalidation"
  | "submitted_source_acquisition"
  | "source_discovery"
  | "discovered_source_acquisition"
  | "text_processing"
  | "cycle_resolution"
  | "facts_model"
  | "foundation_model"
  | "process_model"
  | "financial_model"
  | "deterministic_validation"
  | "projection_assembly"
  | "quality_gate"
  | "total";

export interface AnalysisTiming {
  readonly stage: AnalysisTimingStage;
  readonly durationMs: number;
  readonly outcome: "completed" | "failed" | "cancelled";
  readonly family?: ModelExtractionStage;
  readonly usage?: ModelUsageTelemetry | null;
}

export type AnalysisTelemetrySink = (timing: AnalysisTiming) => void;

export async function measureAnalysisStage<T>(
  stage: AnalysisTimingStage,
  operation: () => Promise<T>,
  sink?: AnalysisTelemetrySink,
  now: () => number = () => performance.now(),
): Promise<T> {
  const startedAt = now();
  try {
    const value = await operation();
    sink?.({ stage, durationMs: Math.max(0, now() - startedAt), outcome: "completed" });
    return value;
  } catch (error) {
    sink?.({
      stage,
      durationMs: Math.max(0, now() - startedAt),
      outcome: error instanceof Error && error.name === "AbortError" ? "cancelled" : "failed",
    });
    throw error;
  }
}
