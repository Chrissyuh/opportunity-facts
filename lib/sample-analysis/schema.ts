import { z } from "zod";

import { ATTENTION_CATEGORIES } from "@/lib/analysis/attention";
import type { AnalysisProgressEvent } from "@/lib/analysis/progress";
import { FIELD_IDS } from "@/lib/opportunity/fields";
import { opportunityCardSchema } from "@/lib/opportunity/schema";
import { SAMPLE_ANALYSIS_CATALOG } from "./catalog";

const sampleIdSchema = z.enum(SAMPLE_ANALYSIS_CATALOG.map((sample) => sample.id));
const fieldIdSchema = z.enum(FIELD_IDS);

const reviewedPageSchema = z.strictObject({
  id: z.string().min(1),
  url: z.url(),
  title: z.string().min(1),
  pageType: z.literal("user_supplied"),
  accessedAt: z.string().datetime({ offset: true }),
  truncated: z.boolean(),
  truncatedForModel: z.boolean(),
  contentUnavailable: z.boolean(),
});

const attentionItemSchema = z.strictObject({
  id: z.string(),
  category: z.enum(ATTENTION_CATEGORIES),
  priority: z.enum(["high", "medium", "low"]),
  title: z.string(),
  explanation: z.string(),
  fieldIds: z.array(fieldIdSchema),
  claimIds: z.array(z.string()),
  sourceIds: z.array(z.string()),
  suggestedNextStep: z.string().nullable(),
  origin: z.enum(["model_grounded", "deterministic_fallback"]),
});

const progressEventSchema = z.custom<AnalysisProgressEvent>((value) => {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return typeof event.type === "string" &&
    Number.isInteger(event.sequence) &&
    typeof event.elapsedMs === "number" &&
    event.elapsedMs >= 0;
}, "Invalid saved analysis progress event.");

export const sampleAnalysisSchema = z.strictObject({
  artifactVersion: z.literal("1.0.0"),
  id: sampleIdSchema,
  label: z.string().min(1),
  category: z.string().min(1),
  submittedUrl: z.url(),
  recordedAt: z.string().datetime({ offset: true }),
  recordedDurationMs: z.number().int().positive(),
  captureKind: z.literal("compact_production"),
  progressProvenance: z.enum(["captured_stream", "recorded_stage_telemetry"]),
  sourceArtifact: z.string().min(1),
  progress: z.array(z.strictObject({
    replayAtMs: z.number().int().nonnegative(),
    event: progressEventSchema,
  })).min(1),
  result: z.strictObject({
    card: opportunityCardSchema,
    reviewedPages: z.array(reviewedPageSchema),
    pageWarnings: z.array(z.strictObject({
      url: z.string(),
      code: z.string(),
      message: z.string(),
    })),
    evidenceWarnings: z.array(z.strictObject({
      fieldId: z.string(),
      sourceId: z.string(),
      message: z.string(),
    })),
    attentionItems: z.array(attentionItemSchema).max(3),
    qualityOutcome: z.enum(["good", "usable_with_caveats"]),
    assessedFieldIds: z.array(fieldIdSchema),
  }),
});

export type SampleAnalysis = z.infer<typeof sampleAnalysisSchema>;
