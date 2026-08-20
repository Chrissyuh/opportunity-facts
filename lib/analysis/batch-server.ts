import "server-only";

import {
  analysisBatchRequestSchema,
  DEFAULT_BATCH_CONCURRENCY,
  MAX_BATCH_ANALYSES,
  type AnalysisBatchManifest,
} from "./batch";
import { canonicalAnalysisUrl } from "./failure-cache";

export function createAnalysisBatchManifest(input: unknown): AnalysisBatchManifest {
  const parsed = analysisBatchRequestSchema.parse(input);
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const rawUrl of parsed.urls) {
    const url = canonicalAnalysisUrl(rawUrl);
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return {
    urls,
    duplicateCount: parsed.urls.length - urls.length,
    maximum: MAX_BATCH_ANALYSES,
    concurrency: DEFAULT_BATCH_CONCURRENCY,
  };
}
