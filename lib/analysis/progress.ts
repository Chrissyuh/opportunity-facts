import type { FieldId } from "@/lib/opportunity/fields";
import type { ModelExtractionStage } from "./model-extraction";

export type AnalysisQualityOutcome =
  | "good"
  | "usable_with_caveats"
  | "insufficient_quality";

interface ProgressBase {
  readonly sequence: number;
  readonly elapsedMs: number;
}

export type AnalysisProgressEvent = ProgressBase & (
  | { readonly type: "accepted" }
  | { readonly type: "cache_checked"; readonly state: "miss" | "hit" | "bypass" | "unavailable" }
  | { readonly type: "source_acquired"; readonly sourceId: string; readonly title: string; readonly url: string }
  | { readonly type: "source_failed"; readonly code: string; readonly url: string }
  | { readonly type: "source_set_complete"; readonly acquired: number; readonly failed: number }
  | { readonly type: "cycle_resolved"; readonly status: "resolved" | "ambiguous"; readonly label?: string }
  | { readonly type: "family_started"; readonly family: ModelExtractionStage }
  | { readonly type: "family_completed"; readonly family: ModelExtractionStage }
  | { readonly type: "family_failed"; readonly family: ModelExtractionStage; readonly message: string }
  | { readonly type: "validated_fact"; readonly fieldId: FieldId; readonly label: string; readonly displayValue: string; readonly evidenceCount: number }
  | { readonly type: "validation_complete"; readonly retained: number; readonly withheld: number }
  | { readonly type: "attention_ready"; readonly count: number }
  | { readonly type: "quality_complete"; readonly outcome: AnalysisQualityOutcome }
  | { readonly type: "heartbeat" }
);

export type AnalysisProgressInput = AnalysisProgressEvent extends infer Event
  ? Event extends AnalysisProgressEvent
    ? Omit<Event, "sequence" | "elapsedMs">
    : never
  : never;

export type AnalysisProgressSink = (event: AnalysisProgressInput) => void;

export function createSequencedProgressSink(
  sink: (event: AnalysisProgressEvent) => void,
  now: () => number = () => performance.now(),
): AnalysisProgressSink {
  const startedAt = now();
  let sequence = 0;
  return (event) => sink({
    ...event,
    sequence: ++sequence,
    elapsedMs: Math.max(0, Math.round(now() - startedAt)),
  } as AnalysisProgressEvent);
}
