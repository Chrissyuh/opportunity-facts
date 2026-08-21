import { CORE_FIELD_IDS, type FieldId } from "@/lib/opportunity/fields";
import type { OpportunityCard } from "@/lib/opportunity/schema";
import type {
  EvidenceWarning,
  FastCoreAreaAssessment,
  FastCoreAreaId,
  ModelFamilyFailure,
} from "./model-extraction";
import type { AttentionItem } from "./attention";
import type { PageAcquisitionFailure } from "./types";
import type { AnalysisQualityOutcome } from "./progress";

export const QUALITY_GATE_VERSION = "student-research-v2-fast";

export type QualityReasonCode =
  | "TARGET_IDENTITY_UNRESOLVED"
  | "MOST_EXTRACTION_FAMILIES_FAILED"
  | "SUMMARY_EXTRACTION_FAILED"
  | "TOO_FEW_SUPPORTED_FACTS"
  | "EXCESSIVE_CANDIDATE_REJECTION"
  | "CYCLE_CONTEXT_UNRESOLVED"
  | "INSUFFICIENT_SOURCE_COVERAGE"
  | "CORE_CLAIMS_WITHHELD"
  | "PRIMARY_COVERAGE_GAPS"
  | "HIGH_PRIORITY_CAVEATS"
  | "PARTIAL_EXTRACTION";

export interface QualityReason {
  readonly code: QualityReasonCode;
  readonly title: string;
  readonly explanation: string;
  readonly priority: "high" | "medium";
}

export interface AnalysisValidationStats {
  readonly attemptedSupportedClaims: number;
  readonly retainedSupportedClaims: number;
  readonly withheldSupportedClaims: number;
}

export interface AnalysisQualitySignals {
  readonly completedFamilies: number;
  readonly failedFamilies: number;
  readonly supportedSummaryFacts: number;
  readonly supportedStructuredClaims: number;
  readonly applicableCoreFacts: number;
  readonly disclosedCoreFacts: number;
  readonly unresolvedCoreFacts: number;
  readonly attemptedSupportedClaims: number;
  readonly withheldSupportedClaims: number;
  readonly acquiredPages: number;
  readonly importantPageFailures: number;
  readonly cycleMaterial: boolean;
  readonly cycleResolved: boolean;
  readonly activelyCheckedCoreAreas: number;
  readonly retainedCoreAreas: number;
  readonly unresolvedPrimaryAreas: number;
  readonly withheldCoreAreas: number;
}

export interface AnalysisQualityAssessment {
  readonly version: typeof QUALITY_GATE_VERSION;
  readonly outcome: AnalysisQualityOutcome;
  readonly reasons: readonly QualityReason[];
  readonly signals: AnalysisQualitySignals;
  readonly cacheEligible: boolean;
}

const DECISION_FIELDS = [
  "operating_organization",
  "grade_levels",
  "application_deadline",
  "participation_format",
  "estimated_total_mandatory_cost",
  "financial_aid",
  "selection_process",
  "other_benefits",
] as const satisfies readonly FieldId[];

const FAST_DECISION_FIELDS = [
  "operating_organization",
  "grade_levels",
  "ages",
  "application_deadline",
  "start_date",
  "duration",
  "participation_format",
  "location",
  "tuition",
  "estimated_total_mandatory_cost",
  "financial_aid",
  "selection_process",
  "other_benefits",
] as const satisfies readonly FieldId[];

const FAST_PRIMARY_AREAS = [
  "eligibility",
  "deadline",
  "schedule",
  "format_location",
  "cost",
] as const satisfies readonly FastCoreAreaId[];

const IMPORTANT_FAILURE_CODES = new Set([
  "UNSUPPORTED_CONTENT_TYPE",
  "MISSING_CONTENT_TYPE",
  "RESPONSE_TOO_LARGE",
  "HTTP_STATUS",
]);

const TRANSIENT_FAILURE_CODES = new Set([
  "ABORTED",
  "TIMEOUT",
  "NETWORK_ERROR",
  "HTTP_STATUS",
  "DNS_LOOKUP_FAILED",
  "VALIDATION_ABORTED",
  "FETCH_FAILED",
]);

function countStructuredClaims(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countStructuredClaims(item), 0);
  if (typeof value !== "object" || value === null) return 0;
  const record = value as Record<string, unknown>;
  const own = typeof record.claimId === "string" && record.status === "disclosed" ? 1 : 0;
  return own + Object.entries(record).reduce((sum, [key, child]) =>
    key === "facts" || key === "sources" || key === "conflictingValues"
      ? sum
      : sum + countStructuredClaims(child), 0);
}

function familyFailures(warnings: readonly EvidenceWarning[]): Set<string> {
  return new Set(warnings
    .filter((warning) => warning.fieldId.startsWith("model."))
    .map((warning) => warning.fieldId.slice("model.".length)));
}

export function assessAnalysisQuality(input: {
  readonly card: OpportunityCard;
  readonly acquiredPages: number;
  readonly pageWarnings: readonly PageAcquisitionFailure[];
  readonly evidenceWarnings: readonly EvidenceWarning[];
  readonly attentionItems: readonly AttentionItem[];
  readonly validationStats?: AnalysisValidationStats;
  readonly familyFailures?: readonly ModelFamilyFailure[];
}): AnalysisQualityAssessment {
  const { card } = input;
  const failed = input.familyFailures
    ? new Set(input.familyFailures.map((failure) => failure.family))
    : familyFailures(input.evidenceWarnings);
  const supportedSummaryFacts = Object.values(card.facts).filter((fact) =>
    fact.status === "disclosed" || fact.status === "conflicting",
  ).length;
  const supportedStructuredClaims = countStructuredClaims({
    cycle: card.cycle,
    organizations: card.organizations,
    organizationRoles: card.organizationRoles,
    institutionRelationships: card.institutionRelationships,
    variants: card.variants,
    stages: card.stages,
    pathways: card.pathways,
    costItems: card.costItems,
    outcomes: card.outcomes,
  });
  const coreStatuses = CORE_FIELD_IDS.map((fieldId) => card.facts[fieldId].status);
  const disclosedCoreFacts = coreStatuses.filter((status) => status === "disclosed" || status === "conflicting").length;
  const applicableCoreFacts = coreStatuses.filter((status) => status !== "not_applicable").length;
  const unresolvedCoreFacts = coreStatuses.filter((status) => status === "not_found" || status === "unclear").length;
  const decisionAreas = DECISION_FIELDS.filter((fieldId) => {
    const status = card.facts[fieldId].status;
    return status === "disclosed" || status === "conflicting" || status === "not_applicable";
  }).length;
  const cycleMaterial = ["application_deadline", "decision_date", "start_date", "end_date", "acceptance_count"]
    .some((fieldId) => card.facts[fieldId as FieldId].status === "disclosed" || card.facts[fieldId as FieldId].status === "conflicting");
  const attempted = input.validationStats?.attemptedSupportedClaims ?? supportedSummaryFacts + supportedStructuredClaims;
  const withheld = input.validationStats?.withheldSupportedClaims ?? input.evidenceWarnings.filter((warning) => !warning.fieldId.startsWith("model.")).length;
  const rejectionRatio = attempted > 0 ? withheld / attempted : 0;
  const importantPageFailures = input.pageWarnings.filter((warning) => IMPORTANT_FAILURE_CODES.has(warning.code)).length;
  const signals: AnalysisQualitySignals = {
    completedFamilies: 4 - failed.size,
    failedFamilies: failed.size,
    supportedSummaryFacts,
    supportedStructuredClaims,
    applicableCoreFacts,
    disclosedCoreFacts,
    unresolvedCoreFacts,
    attemptedSupportedClaims: attempted,
    withheldSupportedClaims: withheld,
    acquiredPages: input.acquiredPages,
    importantPageFailures,
    cycleMaterial,
    cycleResolved: card.cycle.status === "modeled",
    activelyCheckedCoreAreas: 0,
    retainedCoreAreas: 0,
    unresolvedPrimaryAreas: 0,
    withheldCoreAreas: 0,
  };

  const reasons: QualityReason[] = [];
  if (card.facts.opportunity_name.status !== "disclosed") reasons.push({
    code: "TARGET_IDENTITY_UNRESOLVED",
    priority: "high",
    title: "Opportunity identity could not be established",
    explanation: "The retained evidence does not establish the name of the specific opportunity represented by this page.",
  });
  if (failed.size >= 3) reasons.push({
    code: "MOST_EXTRACTION_FAMILIES_FAILED",
    priority: "high",
    title: "Most analysis sections did not complete",
    explanation: "At least three independent extraction sections failed, leaving the result structurally incomplete.",
  });
  if (failed.has("facts") && supportedSummaryFacts < 6) reasons.push({
    code: "SUMMARY_EXTRACTION_FAILED",
    priority: "high",
    title: "The practical summary could not be completed",
    explanation: "The summary section failed and too few supported facts survived elsewhere to build a useful overview.",
  });
  if (supportedSummaryFacts < 6 && decisionAreas < 3) reasons.push({
    code: "TOO_FEW_SUPPORTED_FACTS",
    priority: "high",
    title: "Too little decision-useful information survived validation",
    explanation: "Fewer than six supported summary facts and fewer than three practical decision areas are available.",
  });
  if (attempted >= 10 && rejectionRatio >= 0.8 && supportedSummaryFacts < 10) reasons.push({
    code: "EXCESSIVE_CANDIDATE_REJECTION",
    priority: "high",
    title: "Most candidate claims were withheld",
    explanation: "Deterministic evidence and scope checks rejected most proposed claims, leaving too little safe information for a normal card.",
  });
  if (cycleMaterial && card.cycle.status !== "modeled" && decisionAreas < 4) reasons.push({
    code: "CYCLE_CONTEXT_UNRESOLVED",
    priority: "high",
    title: "The applicable cycle could not be identified",
    explanation: "Cycle-sensitive dates or counts appear in the retained record, but the applicable cycle remains unresolved and the remaining overview is sparse.",
  });
  if (input.acquiredPages <= 1 && importantPageFailures >= 2 && disclosedCoreFacts < 6) reasons.push({
    code: "INSUFFICIENT_SOURCE_COVERAGE",
    priority: "high",
    title: "Important source coverage was insufficient",
    explanation: "Only one page was available, multiple relevant pages could not be reviewed, and fewer than six core areas were supported.",
  });

  const insufficientCodes = new Set(reasons.map((reason) => reason.code));
  const insufficient = insufficientCodes.size > 0;
  const highAttention = input.attentionItems.filter((item) => item.priority === "high").length;
  if (!insufficient && failed.size > 0) reasons.push({
    code: "PARTIAL_EXTRACTION",
    priority: "medium",
    title: "Part of the automated extraction did not complete",
    explanation: "Independent completed sections were retained, but at least one section remains incomplete.",
  });
  if (!insufficient && highAttention > 0) reasons.push({
    code: "HIGH_PRIORITY_CAVEATS",
    priority: "medium",
    title: "Important questions still need checking",
    explanation: "At least one cost, deadline, eligibility, relationship, or other decision-critical issue remains unresolved.",
  });
  const outcome: AnalysisQualityOutcome = insufficient
    ? "insufficient_quality"
    : failed.size === 0 && highAttention === 0 && disclosedCoreFacts >= 6
      ? "good"
      : "usable_with_caveats";
  const hasTransientFailure = input.pageWarnings.some((warning) => TRANSIENT_FAILURE_CODES.has(warning.code));
  return {
    version: QUALITY_GATE_VERSION,
    outcome,
    reasons,
    signals,
    cacheEligible: outcome === "insufficient_quality" && !hasTransientFailure && failed.size === 0,
  };
}

/**
 * The normal result is judged on safe decision usefulness, not whether the
 * optional research workspace has been exhaustively populated.
 */
export function assessFastAnalysisQuality(input: {
  readonly card: OpportunityCard;
  readonly acquiredPages: number;
  readonly pageWarnings: readonly PageAcquisitionFailure[];
  readonly evidenceWarnings: readonly EvidenceWarning[];
  readonly attentionItems: readonly AttentionItem[];
  readonly validationStats: AnalysisValidationStats;
  readonly coreAreaAssessments?: readonly FastCoreAreaAssessment[];
}): AnalysisQualityAssessment {
  const supportedSummaryFacts = Object.values(input.card.facts).filter((fact) =>
    fact.status === "disclosed" || fact.status === "conflicting",
  ).length;
  const practicalAreas = FAST_DECISION_FIELDS.filter((fieldId) => {
    const status = input.card.facts[fieldId].status;
    return status === "disclosed" || status === "conflicting" || status === "not_applicable";
  }).length;
  const coreStatuses = CORE_FIELD_IDS.map((fieldId) => input.card.facts[fieldId].status);
  const applicableCoreFacts = coreStatuses.filter((status) => status !== "not_applicable").length;
  const disclosedCoreFacts = coreStatuses.filter((status) => status === "disclosed" || status === "conflicting").length;
  const unresolvedCoreFacts = coreStatuses.filter((status) => status === "not_found" || status === "unclear").length;
  const cycleMaterial = ["application_deadline", "start_date", "end_date", "decision_date"]
    .some((fieldId) => ["disclosed", "conflicting"].includes(input.card.facts[fieldId as FieldId].status));
  const rejectionRatio = input.validationStats.attemptedSupportedClaims > 0
    ? input.validationStats.withheldSupportedClaims / input.validationStats.attemptedSupportedClaims
    : 0;
  const importantPageFailures = input.pageWarnings.filter((warning) => IMPORTANT_FAILURE_CODES.has(warning.code)).length;
  const coreAreaAssessments = input.coreAreaAssessments ?? [];
  const primaryAreas = new Set<FastCoreAreaId>(FAST_PRIMARY_AREAS);
  const unresolvedPrimaryAreas = coreAreaAssessments.filter((assessment) =>
    primaryAreas.has(assessment.area) &&
    (assessment.status === "checked_not_found" || assessment.status === "unclear" || assessment.status === "withheld"),
  ).length;
  const withheldCoreAreas = coreAreaAssessments.filter((assessment) => assessment.status === "withheld").length;
  const retainedCoreAreas = coreAreaAssessments.filter((assessment) =>
    assessment.status === "retained" || assessment.status === "not_applicable",
  ).length;
  const reasons: QualityReason[] = [];
  if (input.card.facts.opportunity_name.status !== "disclosed") reasons.push({
    code: "TARGET_IDENTITY_UNRESOLVED",
    priority: "high",
    title: "Opportunity identity could not be established",
    explanation: "The retained evidence does not establish the name of the specific opportunity represented by this page.",
  });
  if (supportedSummaryFacts < 5 || practicalAreas < 3) reasons.push({
    code: "TOO_FEW_SUPPORTED_FACTS",
    priority: "high",
    title: "Too little practical information survived validation",
    explanation: "The normal analysis did not retain enough evidence-backed identity, eligibility, timing, cost, format, selection, or outcome information for a reliable overview.",
  });
  if (input.validationStats.attemptedSupportedClaims >= 6 && rejectionRatio >= 0.75 && supportedSummaryFacts < 8) reasons.push({
    code: "EXCESSIVE_CANDIDATE_REJECTION",
    priority: "high",
    title: "Most candidate claims were withheld",
    explanation: "Deterministic evidence and scope checks rejected most proposed claims, leaving too little safe information for a normal result.",
  });
  if (cycleMaterial && input.card.cycle.status !== "modeled" && practicalAreas < 5) reasons.push({
    code: "CYCLE_CONTEXT_UNRESOLVED",
    priority: "high",
    title: "The applicable cycle could not be identified",
    explanation: "Cycle-sensitive dates appear in the retained record, but their target cycle remains unresolved and the rest of the practical overview is sparse.",
  });
  if (input.acquiredPages <= 1 && importantPageFailures >= 2 && practicalAreas < 5) reasons.push({
    code: "INSUFFICIENT_SOURCE_COVERAGE",
    priority: "high",
    title: "Important source coverage was insufficient",
    explanation: "Too few practical areas could be established after multiple relevant source pages failed acquisition.",
  });
  const insufficient = reasons.some((reason) => reason.priority === "high");
  const highAttention = input.attentionItems.filter((item) => item.priority === "high").length;
  if (!insufficient && withheldCoreAreas > 0) reasons.push({
    code: "CORE_CLAIMS_WITHHELD",
    priority: "medium",
    title: "A core answer did not survive verification",
    explanation: "At least one candidate in a required practical area was withheld by evidence, scope, cycle, or projection checks. It is unresolved rather than treated as absent from the source.",
  });
  if (!insufficient && unresolvedPrimaryAreas >= 3) reasons.push({
    code: "PRIMARY_COVERAGE_GAPS",
    priority: "medium",
    title: "Several primary questions remain unresolved",
    explanation: "The compact analysis did not establish at least three of eligibility, deadline, schedule, format or location, and cost. This does not claim those details are absent from the source.",
  });
  if (!insufficient && highAttention > 0) reasons.push({
    code: "HIGH_PRIORITY_CAVEATS",
    priority: "medium",
    title: "Important questions still need checking",
    explanation: "At least one cost, deadline, eligibility, relationship, or other decision-critical issue remains unresolved.",
  });
  const outcome: AnalysisQualityOutcome = insufficient
    ? "insufficient_quality"
    : highAttention === 0 && practicalAreas >= 7 && withheldCoreAreas === 0 && unresolvedPrimaryAreas < 3
      ? "good"
      : "usable_with_caveats";
  const hasTransientFailure = input.pageWarnings.some((warning) => TRANSIENT_FAILURE_CODES.has(warning.code));
  return {
    version: QUALITY_GATE_VERSION,
    outcome,
    reasons,
    signals: {
      completedFamilies: 1,
      failedFamilies: 0,
      supportedSummaryFacts,
      supportedStructuredClaims: countStructuredClaims({ cycle: input.card.cycle }),
      applicableCoreFacts,
      disclosedCoreFacts,
      unresolvedCoreFacts,
      attemptedSupportedClaims: input.validationStats.attemptedSupportedClaims,
      withheldSupportedClaims: input.validationStats.withheldSupportedClaims,
      acquiredPages: input.acquiredPages,
      importantPageFailures,
      cycleMaterial,
      cycleResolved: input.card.cycle.status === "modeled",
      activelyCheckedCoreAreas: coreAreaAssessments.length,
      retainedCoreAreas,
      unresolvedPrimaryAreas,
      withheldCoreAreas,
    },
    cacheEligible: outcome === "insufficient_quality" && !hasTransientFailure,
  };
}
