import "server-only";

import { z } from "zod";
import type { OpportunityCard } from "@/lib/opportunity/schema";
import { formatFact } from "@/lib/opportunity/format";
import {
  hasSensitiveUrlQuery,
  isObviouslyPublicHttpUrl,
} from "@/lib/opportunity/public-url";
import { acquirePublicSourcePages, type AcquirePublicSourcePagesOptions } from "./fetch";
import { extractPlainTextPage } from "./html-extraction";
import {
  buildBoundedSourcePayload,
  createOpenAIFastExtractor,
  extractOpportunityCard,
  type AnalysisSourceContext,
  type EvidenceWarning,
  type FastCoreAreaAssessment,
  type ModelExtractor,
} from "./model-extraction";
import { parsePublicHttpUrl } from "./url-safety";
import type { PageAcquisitionFailure } from "./types";
import type { AttentionItem } from "./attention";
import { sourceTextFingerprint } from "./failure-cache";
import type { AnalysisProgressSink } from "./progress";
import { assessAnalysisQuality, assessFastAnalysisQuality, type AnalysisQualityAssessment, type AnalysisValidationStats } from "./quality-gate";
import type { AnalysisTelemetrySink } from "./telemetry";

export const MAX_PASTED_SOURCES = 7;
export const MAX_PASTED_SOURCE_CHARACTERS = 80_000;
export const MAX_PASTED_TOTAL_CHARACTERS = 400_000;

const analysisSourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine(
    (value) => isObviouslyPublicHttpUrl(value) && !hasSensitiveUrlQuery(value),
    "Enter a public HTTP(S) URL without credentials, sensitive query tokens, or an obvious local/private host.",
  )
  .transform((value) => parsePublicHttpUrl(value).href);

export const pastedSourceInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(240),
  url: analysisSourceUrlSchema,
  pageType: z.literal("user_supplied"),
  text: z.string().trim().min(1).max(MAX_PASTED_SOURCE_CHARACTERS),
});

export type PastedSourceInput = z.infer<typeof pastedSourceInputSchema>;

const pastedSourcesRequestSchema = z
  .strictObject({
    mode: z.literal("text"),
    sources: z.array(pastedSourceInputSchema).min(1).max(MAX_PASTED_SOURCES),
  })
  .superRefine((input, context) => {
    const totalCharacters = input.sources.reduce(
      (sum, source) => sum + source.text.length,
      0,
    );
    if (totalCharacters > MAX_PASTED_TOTAL_CHARACTERS) {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: `Pasted source text exceeds the ${MAX_PASTED_TOTAL_CHARACTERS}-character total limit.`,
      });
    }

    const firstIndexByUrl = new Map<string, number>();
    input.sources.forEach((source, index) => {
      const firstIndex = firstIndexByUrl.get(source.url);
      if (firstIndex === undefined) {
        firstIndexByUrl.set(source.url, index);
        return;
      }
      context.addIssue({
        code: "custom",
        path: ["sources", index, "url"],
        message: `Source URLs must be distinct; this URL duplicates source ${firstIndex + 1}.`,
      });
    });
  });

export const analyzeRequestSchema = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("url"),
    url: analysisSourceUrlSchema,
  }),
  pastedSourcesRequestSchema,
]);

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export interface ReviewedPageSummary {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly pageType: "user_supplied";
  readonly accessedAt: string;
  readonly truncated: boolean;
  readonly truncatedForModel: boolean;
  readonly contentUnavailable: boolean;
}

export interface AnalysisPipelineResult {
  readonly card: OpportunityCard;
  readonly reviewedPages: readonly ReviewedPageSummary[];
  readonly pageWarnings: readonly PageAcquisitionFailure[];
  readonly evidenceWarnings: readonly EvidenceWarning[];
  readonly attentionItems: readonly AttentionItem[];
  readonly quality: AnalysisQualityAssessment;
  readonly validationStats: AnalysisValidationStats;
  readonly sourceFingerprint: string | null;
  readonly familyFailures: readonly import("./model-extraction").ModelFamilyFailure[];
  readonly coreAreaAssessments: readonly FastCoreAreaAssessment[];
}

export interface AnalyzePipelineOptions {
  readonly extractor?: ModelExtractor;
  readonly fetch?: AcquirePublicSourcePagesOptions;
  readonly now?: () => Date;
  readonly signal?: AbortSignal;
  readonly onProgress?: AnalysisProgressSink;
  readonly onTelemetry?: AnalysisTelemetrySink;
  /** Internal handoff for bounded server-side Extended Research reuse. */
  readonly onSourcesReady?: (
    sources: readonly AnalysisSourceContext[],
    pageWarnings: readonly PageAcquisitionFailure[],
  ) => void;
  readonly qualityMode?: "normal" | "extended";
}

function summarizeSources(sources: readonly AnalysisSourceContext[]): ReviewedPageSummary[] {
  const modelPayloadById = new Map(
    buildBoundedSourcePayload(sources).map((page) => [page.id, page]),
  );
  return sources.map(({ page, accessedAt }) => ({
    id: page.id,
    url: page.url,
    title: page.title,
    pageType: page.pageType,
    accessedAt,
    truncated: page.truncated,
    truncatedForModel: modelPayloadById.get(page.id)?.truncatedForModel ?? false,
    contentUnavailable: page.text.trim().length === 0,
  }));
}

async function finishAnalysis(
  sources: readonly AnalysisSourceContext[],
  pageWarnings: readonly PageAcquisitionFailure[],
  extractor?: ModelExtractor,
  signal?: AbortSignal,
  onProgress?: AnalysisProgressSink,
  onTelemetry?: AnalysisTelemetrySink,
  qualityMode: "normal" | "extended" = "normal",
): Promise<AnalysisPipelineResult> {
  const extracted = await extractOpportunityCard(
    sources,
    extractor ?? createOpenAIFastExtractor(),
    { signal, onProgress, onTelemetry, analysisDepth: qualityMode },
  );
  const reviewedPages = summarizeSources(sources);
  const qualityStartedAt = performance.now();
  const attentionItems = extracted.attentionItems.slice(0, qualityMode === "normal" ? 3 : 5);
  const qualityInput = {
    card: extracted.card,
    acquiredPages: reviewedPages.length,
    pageWarnings,
    evidenceWarnings: extracted.evidenceWarnings,
    attentionItems,
    validationStats: extracted.validationStats,
    familyFailures: extracted.familyFailures,
    coreAreaAssessments: extracted.coreAreaAssessments,
  };
  const quality = qualityMode === "normal"
    ? assessFastAnalysisQuality(qualityInput)
    : assessAnalysisQuality(qualityInput);
  onTelemetry?.({ stage: "quality_gate", durationMs: performance.now() - qualityStartedAt, outcome: "completed" });
  const previewFields = [
    "opportunity_name",
    "application_deadline",
    "participation_format",
    "estimated_total_mandatory_cost",
    "financial_aid",
    "operating_organization",
    "selection_process",
    "other_benefits",
  ] as const;
  for (const fieldId of previewFields) {
    const fact = extracted.card.facts[fieldId];
    if (fact.status !== "disclosed" && fact.status !== "conflicting") continue;
    onProgress?.({
      type: "validated_fact",
      fieldId,
      label: fieldId.replaceAll("_", " "),
      displayValue: formatFact(fact),
      evidenceCount: fact.status === "conflicting"
        ? fact.conflictingValues.reduce((sum, candidate) => sum + candidate.sources.length, 0)
        : fact.sources.length,
    });
  }
  onProgress?.({ type: "quality_complete", outcome: quality.outcome });
  return {
    card: extracted.card,
    reviewedPages,
    pageWarnings,
    evidenceWarnings: extracted.evidenceWarnings,
    attentionItems,
    quality,
    validationStats: extracted.validationStats,
    sourceFingerprint: sources[0]?.page.text ? sourceTextFingerprint(sources[0].page.text) : null,
    familyFailures: extracted.familyFailures,
    coreAreaAssessments: extracted.coreAreaAssessments,
  };
}

export async function analyzePublicUrl(
  url: string,
  options: AnalyzePipelineOptions = {},
): Promise<AnalysisPipelineResult> {
  const acquired = await acquirePublicSourcePages(url, {
      ...options.fetch,
      signal: options.signal ?? options.fetch?.signal,
      onPageAcquired(page) {
        options.fetch?.onPageAcquired?.(page);
        options.onProgress?.({
          type: "source_acquired",
          sourceId: page.extracted.id,
          title: page.extracted.title,
          url: page.fetched.url,
        });
      },
      onPageFailure(failure) {
        options.fetch?.onPageFailure?.(failure);
        options.onProgress?.({ type: "source_failed", code: failure.code, url: failure.url });
      },
      onDiscoveryComplete(candidateCount) {
        options.fetch?.onDiscoveryComplete?.(candidateCount);
      },
      onTiming(stage, durationMs) {
        options.fetch?.onTiming?.(stage, durationMs);
        options.onTelemetry?.({ stage, durationMs, outcome: "completed" });
      },
    });
  const sourcePages = [acquired.submitted, ...acquired.discovered];
  const sources = sourcePages.map(({ fetched, extracted }) => ({
    page: extracted,
    accessedAt: fetched.fetchedAt,
  }));
  options.onSourcesReady?.(sources, acquired.failures);
  options.onProgress?.({
    type: "source_set_complete",
    acquired: sourcePages.length,
    failed: acquired.failures.length,
  });
  return finishAnalysis(
    sources,
    acquired.failures,
    options.extractor,
    options.signal,
    options.onProgress,
    options.onTelemetry,
    options.qualityMode,
  );
}

export async function analyzePastedSources(
  inputs: readonly PastedSourceInput[],
  options: AnalyzePipelineOptions = {},
): Promise<AnalysisPipelineResult> {
  const parsed = pastedSourcesRequestSchema.parse({ mode: "text", sources: inputs }).sources;
  const accessedAt = (options.now ?? (() => new Date()))().toISOString();
  const sources = parsed.map((source) => ({
    page: extractPlainTextPage(source.text, source.url, {
      title: source.title,
      maxCharacters: MAX_PASTED_SOURCE_CHARACTERS,
    }),
    accessedAt,
  }));
  options.onSourcesReady?.(sources, []);
  for (const source of sources) {
    options.onProgress?.({
      type: "source_acquired",
      sourceId: source.page.id,
      title: source.page.title,
      url: source.page.url,
    });
  }
  options.onProgress?.({ type: "source_set_complete", acquired: sources.length, failed: 0 });
  return finishAnalysis(
    sources,
    [],
    options.extractor,
    options.signal,
    options.onProgress,
    options.onTelemetry,
    options.qualityMode,
  );
}

/** Reuses an already-acquired, server-held source set without fetching again. */
export async function analyzeSourceContexts(
  sources: readonly AnalysisSourceContext[],
  pageWarnings: readonly PageAcquisitionFailure[],
  options: AnalyzePipelineOptions = {},
): Promise<AnalysisPipelineResult> {
  options.onSourcesReady?.(sources, pageWarnings);
  return finishAnalysis(
    sources,
    pageWarnings,
    options.extractor,
    options.signal,
    options.onProgress,
    options.onTelemetry,
    options.qualityMode ?? "extended",
  );
}

export async function analyzeRequest(
  input: AnalyzeRequest,
  options: AnalyzePipelineOptions = {},
) {
  return input.mode === "url"
    ? analyzePublicUrl(input.url, options)
    : analyzePastedSources(input.sources, options);
}
