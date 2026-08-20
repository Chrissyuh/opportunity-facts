import { z } from "zod";

export const MAX_BATCH_ANALYSES = 5;
export const DEFAULT_BATCH_CONCURRENCY = 2;

export const analysisBatchRequestSchema = z.strictObject({
  urls: z.array(z.string().trim().min(1).max(2_048)).min(1).max(MAX_BATCH_ANALYSES),
});

export interface AnalysisBatchManifest {
  readonly urls: readonly string[];
  readonly duplicateCount: number;
  readonly maximum: typeof MAX_BATCH_ANALYSES;
  readonly concurrency: typeof DEFAULT_BATCH_CONCURRENCY;
}
