import "server-only";

import { z } from "zod";
import type { OpportunityCard } from "@/lib/opportunity/schema";
import {
  hasSensitiveUrlQuery,
  isObviouslyPublicHttpUrl,
} from "@/lib/opportunity/public-url";
import { acquirePublicSourcePages, type AcquirePublicSourcePagesOptions } from "./fetch";
import { extractPlainTextPage } from "./html-extraction";
import {
  buildBoundedSourcePayload,
  extractOpportunityCard,
  type AnalysisSourceContext,
  type EvidenceWarning,
  type ModelExtractor,
} from "./model-extraction";
import { parsePublicHttpUrl } from "./url-safety";
import type { PageAcquisitionFailure } from "./types";

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
}

export interface AnalyzePipelineOptions {
  readonly extractor?: ModelExtractor;
  readonly fetch?: AcquirePublicSourcePagesOptions;
  readonly now?: () => Date;
  readonly signal?: AbortSignal;
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
): Promise<AnalysisPipelineResult> {
  const extracted = await extractOpportunityCard(sources, extractor, { signal });
  return {
    card: extracted.card,
    reviewedPages: summarizeSources(sources),
    pageWarnings,
    evidenceWarnings: extracted.evidenceWarnings,
  };
}

export async function analyzePublicUrl(
  url: string,
  options: AnalyzePipelineOptions = {},
): Promise<AnalysisPipelineResult> {
  const acquired = await acquirePublicSourcePages(url, {
    ...options.fetch,
    signal: options.signal ?? options.fetch?.signal,
  });
  const sourcePages = [acquired.submitted, ...acquired.discovered];
  const sources = sourcePages.map(({ fetched, extracted }) => ({
    page: extracted,
    accessedAt: fetched.fetchedAt,
  }));
  return finishAnalysis(sources, acquired.failures, options.extractor, options.signal);
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
  return finishAnalysis(sources, [], options.extractor, options.signal);
}

export async function analyzeRequest(
  input: AnalyzeRequest,
  options: AnalyzePipelineOptions = {},
) {
  return input.mode === "url"
    ? analyzePublicUrl(input.url, options)
    : analyzePastedSources(input.sources, options);
}
