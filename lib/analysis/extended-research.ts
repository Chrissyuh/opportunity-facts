import "server-only";

import { opportunityCardSchema } from "@/lib/opportunity/schema";
import {
  createOpenAIExtendedExtractor,
  EXTENDED_RESEARCH_FIELD_IDS,
  type ExtendedModelExtractor,
  type ModelExtractor,
} from "./model-extraction";
import { analyzeSourceContexts, type AnalysisPipelineResult } from "./pipeline";
import type { AnalysisProgressSink } from "./progress";
import { assessAnalysisQuality } from "./quality-gate";
import {
  createResearchSessionStore,
  type ResearchSessionStore,
} from "./research-session";
import type { AnalysisTelemetrySink } from "./telemetry";

export class ResearchSessionUnavailableError extends Error {
  constructor() {
    super("The Extended Research handoff expired or is incompatible. Run Analyze again to create a fresh result.");
    this.name = "ResearchSessionUnavailableError";
  }
}

export interface ExtendedResearchResult extends AnalysisPipelineResult {
  readonly kind: "card";
  readonly research: {
    readonly depth: "extended";
    readonly extendedAvailable: false;
    readonly sessionId: string;
    readonly completedSections: readonly ("details" | "financial")[];
    readonly failedSections: readonly ("details" | "financial")[];
    readonly reused: boolean;
    readonly assessedFieldIds: typeof EXTENDED_RESEARCH_FIELD_IDS;
  };
}

export interface RunExtendedResearchOptions {
  readonly store?: ResearchSessionStore;
  readonly extractor?: ExtendedModelExtractor;
  readonly signal?: AbortSignal;
  readonly onProgress?: AnalysisProgressSink;
  readonly onTelemetry?: AnalysisTelemetrySink;
}

const inFlight = new Map<string, Promise<ExtendedResearchResult>>();

export function mergeExtendedAttention(
  normal: AnalysisPipelineResult,
  extended: AnalysisPipelineResult,
) {
  const extendedClaimIds = new Set<string>();
  const collectClaimIds = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collectClaimIds);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.claimId === "string") extendedClaimIds.add(record.claimId);
    Object.entries(record).forEach(([key, child]) => {
      if (key !== "sources" && key !== "conflictingValues") collectClaimIds(child);
    });
  };
  collectClaimIds({
    cycle: extended.card.cycle,
    organizations: extended.card.organizations,
    organizationRoles: extended.card.organizationRoles,
    institutionRelationships: extended.card.institutionRelationships,
    variants: extended.card.variants,
    stages: extended.card.stages,
    pathways: extended.card.pathways,
    costItems: extended.card.costItems,
    outcomes: extended.card.outcomes,
  });
  const stillApplies = normal.attentionItems.filter((item) =>
    item.fieldIds.every((fieldId) =>
      JSON.stringify(normal.card.facts[fieldId]) === JSON.stringify(extended.card.facts[fieldId]),
    ) && item.claimIds.every((claimId) => extendedClaimIds.has(claimId)),
  );
  const unique = new Map<string, (typeof extended.attentionItems)[number]>();
  for (const item of [...stillApplies, ...extended.attentionItems]) {
    const key = `${item.category}:${[...item.fieldIds].sort().join(",")}:${[...item.claimIds].sort().join(",")}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].slice(0, 5);
}

function asExtendedResult(
  sessionId: string,
  normal: AnalysisPipelineResult,
  result: AnalysisPipelineResult,
  completedSections: readonly ("details" | "financial")[],
  failedSections: readonly ("details" | "financial")[],
  reused: boolean,
): ExtendedResearchResult {
  const attentionItems = mergeExtendedAttention(normal, result);
  const card = opportunityCardSchema.parse({
    ...result.card,
    slug: normal.card.slug,
    summary: normal.card.summary,
    cardVersion: normal.card.cardVersion,
  });
  const quality = assessAnalysisQuality({
    card,
    acquiredPages: result.reviewedPages.length,
    pageWarnings: result.pageWarnings,
    evidenceWarnings: result.evidenceWarnings,
    attentionItems,
    validationStats: result.validationStats,
    familyFailures: result.familyFailures,
  });
  return {
    ...result,
    kind: "card",
    card,
    attentionItems,
    quality,
    research: {
      depth: "extended",
      extendedAvailable: false,
      sessionId,
      completedSections,
      failedSections,
      reused,
      assessedFieldIds: EXTENDED_RESEARCH_FIELD_IDS,
    },
  };
}

export async function runExtendedResearch(
  sessionId: string,
  options: RunExtendedResearchOptions = {},
): Promise<ExtendedResearchResult> {
  const store = options.store ?? createResearchSessionStore();
  const session = store.get(sessionId);
  if (!session) throw new ResearchSessionUnavailableError();
  if (session.extendedResult !== null) {
    options.onProgress?.({ type: "extended_started" });
    options.onProgress?.({ type: "extended_complete", partial: false });
    return asExtendedResult(
      sessionId,
      session.normalResult,
      session.extendedResult,
      session.extendedCompletedSections,
      session.extendedFailedSections,
      true,
    );
  }
  const existing = inFlight.get(sessionId);
  if (existing) return existing;

  const operation = (async () => {
    const extractor = options.extractor ?? createOpenAIExtendedExtractor();
    let completedSections: readonly ("details" | "financial")[] = [];
    let failedSections: readonly ("details" | "financial")[] = [];
    const modelExtractor: ModelExtractor = async (sources, extractionOptions) => {
      const extracted = await extractor(sources, session.normalResult.card, extractionOptions);
      completedSections = extracted.completedSections;
      failedSections = extracted.failedSections;
      const facts = structuredClone(extracted.extraction.facts);
      for (const [fieldId, baselineFact] of Object.entries(session.normalResult.card.facts)) {
        if (
          baselineFact.status === "disclosed" ||
          baselineFact.status === "conflicting" ||
          baselineFact.status === "not_applicable"
        ) {
          facts[fieldId as keyof typeof facts] = baselineFact;
        }
      }
      return { ...extracted.extraction, facts };
    };
    const result = await analyzeSourceContexts(session.sources, session.pageWarnings, {
      extractor: modelExtractor,
      signal: options.signal,
      onProgress: options.onProgress,
      onTelemetry: options.onTelemetry,
      qualityMode: "extended",
    });
    options.signal?.throwIfAborted();
    const extended = asExtendedResult(
      sessionId,
      session.normalResult,
      result,
      completedSections,
      failedSections,
      false,
    );
    store.saveExtended(sessionId, extended, completedSections, failedSections);
    options.onProgress?.({
      type: "extended_validation_complete",
      retained: extended.validationStats.retainedSupportedClaims,
      withheld: extended.validationStats.withheldSupportedClaims,
      completedSections,
      failedSections,
    });
    options.onProgress?.({ type: "extended_complete", partial: failedSections.length > 0 });
    return extended;
  })();
  inFlight.set(sessionId, operation);
  try {
    return await operation;
  } finally {
    if (inFlight.get(sessionId) === operation) inFlight.delete(sessionId);
  }
}
