import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface CaseDefinition {
  groundFile: string;
  correctFields: readonly string[];
  incorrectEvidenceFields: readonly string[];
  structured: { correct: number; automated: number; ground: number };
  acquisition: {
    exactReviewedUrls: { acquired: number; reviewed: number };
    sourceCategories: { acquired: number; reviewed: number };
    irrelevantPages: number;
  };
  correctionBurden: Record<string, number>;
  criticalErrors: readonly string[];
  judgments: Record<string, string>;
}

const CASES = {
  "congressional-app-challenge-2026": {
    groundFile: "congressional-app-challenge-2026.json",
    correctFields: [
      "opportunity_name", "opportunity_category", "official_url", "grade_levels",
      "geographic_restrictions", "citizenship_restrictions", "entry_format",
      "participation_format", "selection_process", "in_kind_value", "personal_information",
    ],
    incorrectEvidenceFields: ["location", "cancellation_rights", "material_terms"],
    structured: { correct: 6, automated: 10, ground: 10 },
    acquisition: {
      exactReviewedUrls: { acquired: 4, reviewed: 5 },
      sourceCategories: { acquired: 4, reviewed: 4 },
      irrelevantPages: 0,
    },
    correctionBurden: { missingClaim: 6, unsupportedClaimRemoval: 11, statusCorrection: 14, valueCorrection: 2, relationshipOrScopeCorrection: 2, evidenceCorrection: 3, structuralCorrection: 6 },
    criticalErrors: [],
    judgments: {
      location: "District residence/school eligibility was attached to the participation-location field.",
      cancellation_rights: "A right to change the optional SMS program was attached as challenge cancellation rights.",
      material_terms: "Optional SMS rates and opt-out text were presented as material participation terms.",
    },
  },
  "coca-cola-scholars-program-2027": {
    groundFile: "coca-cola-scholars-program-2027.json",
    correctFields: [],
    incorrectEvidenceFields: [],
    structured: { correct: 0, automated: 0, ground: 11 },
    acquisition: {
      exactReviewedUrls: { acquired: 2, reviewed: 3 },
      sourceCategories: { acquired: 2, reviewed: 2 },
      irrelevantPages: 3,
    },
    correctionBurden: { missingClaim: 18, unsupportedClaimRemoval: 0, statusCorrection: 59, valueCorrection: 0, relationshipOrScopeCorrection: 0, evidenceCorrection: 0, structuralCorrection: 11 },
    criticalErrors: [],
    judgments: {},
  },
  "yale-young-global-scholars-summer-2027": {
    groundFile: "yale-young-global-scholars-summer-2027.json",
    correctFields: [
      "opportunity_name", "opportunity_category", "named_institution",
      "geographic_restrictions", "duration", "participation_format", "location",
      "financial_aid", "selection_process", "program_seat",
    ],
    incorrectEvidenceFields: ["application_fee", "cancellation_rights"],
    structured: { correct: 4, automated: 8, ground: 9 },
    acquisition: {
      exactReviewedUrls: { acquired: 3, reviewed: 4 },
      sourceCategories: { acquired: 3, reviewed: 3 },
      irrelevantPages: 0,
    },
    correctionBurden: { missingClaim: 9, unsupportedClaimRemoval: 22, statusCorrection: 32, valueCorrection: 2, relationshipOrScopeCorrection: 2, evidenceCorrection: 3, structuralCorrection: 9 },
    criticalErrors: [],
    judgments: {
      application_fee: "Two application-plan fees were flattened as program/cohort variation.",
      cancellation_rights: "A health-protocol modification right was attached as program cancellation rights.",
    },
  },
  "polygence-core-program-fall-2026": {
    groundFile: "polygence-core-program-fall-2026.json",
    correctFields: [
      "opportunity_name", "opportunity_category", "operating_organization", "organization_type",
      "participation_format", "financial_aid", "selection_process", "personal_information",
      "data_sharing", "project_license", "cancellation_rights",
    ],
    incorrectEvidenceFields: ["ages", "geographic_restrictions", "sponsor_requirement", "program_seat"],
    structured: { correct: 2, automated: 4, ground: 11 },
    acquisition: {
      exactReviewedUrls: { acquired: 5, reviewed: 6 },
      sourceCategories: { acquired: 4, reviewed: 4 },
      irrelevantPages: 0,
    },
    correctionBurden: { missingClaim: 10, unsupportedClaimRemoval: 11, statusCorrection: 23, valueCorrection: 3, relationshipOrScopeCorrection: 4, evidenceCorrection: 4, structuralCorrection: 11 },
    criticalErrors: [
      "Platform minimum-use age was presented as Core Program eligibility.",
      "Terms-of-service jurisdiction access language was presented as program geographic eligibility.",
      "Minor supervision for platform use was presented as a program sponsor requirement.",
    ],
    judgments: {
      ages: "Platform-use age in the Terms is not Core Program admissions eligibility.",
      geographic_restrictions: "Service-access legal restrictions are not program geographic eligibility.",
      sponsor_requirement: "Parent supervision for platform use is not a program application sponsor requirement.",
      program_seat: "Enrollment in a paid service was treated as a participant outcome.",
    },
  },
  "mites-summer-2027": {
    groundFile: "mites-summer-2027.json",
    correctFields: [
      "opportunity_name", "opportunity_category", "official_url", "organization_type",
      "named_institution", "institution_relationship", "grade_levels", "citizenship_restrictions",
      "participation_format", "location", "tuition", "travel_included", "lodging_included",
      "meals_included", "program_seat",
    ],
    incorrectEvidenceFields: ["geographic_restrictions", "selection_process"],
    structured: { correct: 4, automated: 4, ground: 15 },
    acquisition: {
      exactReviewedUrls: { acquired: 4, reviewed: 5 },
      sourceCategories: { acquired: 2, reviewed: 2 },
      irrelevantPages: 0,
    },
    correctionBurden: { missingClaim: 8, unsupportedClaimRemoval: 10, statusCorrection: 24, valueCorrection: 1, relationshipOrScopeCorrection: 2, evidenceCorrection: 3, structuralCorrection: 11 },
    criticalErrors: [],
    judgments: {
      geographic_restrictions: "Calling the program national does not establish a geographic-eligibility restriction.",
      selection_process: "The program description was attached as a selection process without selection steps.",
    },
  },
  "breakthrough-junior-challenge-2026": {
    groundFile: "breakthrough-junior-challenge-2026.json",
    correctFields: [
      "opportunity_name", "opportunity_category", "official_url", "operating_organization",
      "ages", "geographic_restrictions", "entry_format", "sponsor_requirement",
      "participation_format", "selection_process", "in_kind_value", "personal_information",
      "project_ownership", "project_license", "publicity_rights", "cancellation_rights",
    ],
    incorrectEvidenceFields: ["other_benefits"],
    structured: { correct: 0, automated: 0, ground: 10 },
    acquisition: {
      exactReviewedUrls: { acquired: 5, reviewed: 5 },
      sourceCategories: { acquired: 5, reviewed: 5 },
      irrelevantPages: 0,
    },
    correctionBurden: { missingClaim: 4, unsupportedClaimRemoval: 14, statusCorrection: 43, valueCorrection: 0, relationshipOrScopeCorrection: 1, evidenceCorrection: 1, structuralCorrection: 10 },
    criticalErrors: [],
    judgments: {
      other_benefits: "The teacher's cash prize was placed in the participant other-benefits field instead of a teacher-scoped outcome.",
    },
  },
  "questbridge-national-college-match-2026": {
    groundFile: "questbridge-national-college-match-2026.json",
    correctFields: [
      "opportunity_name", "opportunity_category", "official_url", "operating_organization",
      "institution_relationship", "relationship_explanation", "grade_levels",
      "geographic_restrictions", "citizenship_restrictions", "entry_format",
      "sponsor_requirement", "application_fee", "estimated_total_mandatory_cost",
      "financial_aid", "selection_process", "personal_information", "data_sharing",
      "publicity_rights", "material_terms",
    ],
    incorrectEvidenceFields: ["acceptance_count"],
    structured: { correct: 0, automated: 0, ground: 16 },
    acquisition: {
      exactReviewedUrls: { acquired: 4, reviewed: 7 },
      sourceCategories: { acquired: 2, reviewed: 4 },
      irrelevantPages: 3,
    },
    correctionBurden: { missingClaim: 9, unsupportedClaimRemoval: 4, statusCorrection: 20, valueCorrection: 2, relationshipOrScopeCorrection: 1, evidenceCorrection: 1, structuralCorrection: 16 },
    criticalErrors: ["A 2025 matched-finalist count was presented as the 2026 cycle's acceptance count."],
    judgments: {
      acceptance_count: "The cited number is explicitly a 2025 result, not a 2026-cycle acceptance count.",
    },
  },
} as const satisfies Record<string, CaseDefinition>;

interface EvidenceSource { excerpt: string }
interface Fact {
  status: string;
  displayValue: string | null;
  sources: EvidenceSource[];
}
interface Artifact {
  program: { slug: string };
  provider: { telemetry: { usage: Usage } | null };
  result: { draftCard: { facts: Record<string, Fact>; cycle: { status: string } } | null };
  acquisition: { successfullyAcquired: unknown[]; failures: unknown[] };
  failure: unknown;
  timing: { totalRuntimeMs: number };
}
interface Ground { facts: Record<string, Fact> }
interface Usage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

function ratio(numerator: number, denominator: number) {
  return { numerator, denominator, value: denominator === 0 ? null : numerator / denominator };
}

function sum(values: Iterable<number>) {
  return [...values].reduce((total, value) => total + value, 0);
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

const reportDir = join("research", "extraction-evaluation", "reports");
mkdirSync(reportDir, { recursive: true });
const aggregate = {
  supportedCorrect: 0,
  supportedAutomated: 0,
  recalled: 0,
  groundSupported: 0,
  statusAgreement: 0,
  statusTotal: 0,
  evidenceCorrect: 0,
  evidenceTotal: 0,
  structuredCorrect: 0,
  structuredAutomated: 0,
  structuredGround: 0,
  exactUrlsAcquired: 0,
  exactUrlsReviewed: 0,
  categoriesAcquired: 0,
  categoriesReviewed: 0,
  acquiredPages: 0,
  irrelevantPages: 0,
  fetchFailures: 0,
  criticalErrors: 0,
  runtimeMs: 0,
  usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 },
  costUsd: 0,
  correctionBurden: {} as Record<string, number>,
};

const caseScores = [];
for (const [slug, rawDefinition] of Object.entries(CASES)) {
  const definition: CaseDefinition = rawDefinition;
  const artifact = readJson<Artifact>(join("research", "extraction-evaluation", "first-pass", `${slug}-run-01.json`));
  const ground = readJson<Ground>(join("data", "opportunities", definition.groundFile));
  const draft = artifact.result.draftCard;
  const claims = draft
    ? Object.entries(draft.facts)
        .filter(([, value]) => value.status === "disclosed" || value.status === "conflicting")
        .map(([fieldId, value]) => ({
          fieldId,
          displayValue: value.displayValue,
          evidenceAttachments: value.sources.length,
          groundMatch: definition.correctFields.includes(fieldId),
          evidenceCorrect: !definition.incorrectEvidenceFields.includes(fieldId),
          judgment: definition.judgments[fieldId] ?? (
            definition.correctFields.includes(fieldId)
              ? "The displayed claim matches the frozen human-reviewed summary and its attached evidence supports the same object and scope."
              : "The displayed claim does not match a supported summary dimension in the frozen human-reviewed card."
          ),
        }))
    : [];
  const groundSupported = Object.values(ground.facts).filter((value) => value.status === "disclosed" || value.status === "conflicting").length;
  const statusAgreement = draft
    ? Object.entries(ground.facts).filter(([fieldId, value]) => draft.facts[fieldId]?.status === value.status).length
    : 0;
  const evidenceTotal = sum(claims.map((claim) => claim.evidenceAttachments));
  const evidenceIncorrect = sum(claims.filter((claim) => !claim.evidenceCorrect).map((claim) => claim.evidenceAttachments));
  const burdenTotal = sum(Object.values(definition.correctionBurden));
  const usage = artifact.provider.telemetry?.usage ?? {
    inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0,
  };
  const uncachedInput = usage.inputTokens - usage.cachedInputTokens;
  const costUsd = (uncachedInput * 2 + usage.cachedInputTokens * 0.2 + usage.outputTokens * 12) / 1_000_000;
  const score = {
    artifactVersion: 1,
    developmentSet: false,
    preregistered: true,
    primaryRun: `${slug}-run-01.json`,
    groundTruthCard: definition.groundFile,
    completedDraft: draft !== null,
    semanticReview: { reviewer: "human_manual_review", claims },
    acquisition: {
      ...definition.acquisition,
      acquiredPages: artifact.acquisition.successfullyAcquired.length,
      fetchFailures: artifact.acquisition.failures.length,
    },
    metrics: {
      supportedClaimPrecision: ratio(definition.correctFields.length, claims.length),
      supportedSummaryRecall: ratio(definition.correctFields.length, groundSupported),
      statusAgreement: ratio(statusAgreement, Object.keys(ground.facts).length),
      semanticEvidenceCorrectness: ratio(evidenceTotal - evidenceIncorrect, evidenceTotal),
      structuredEntityPrecision: ratio(definition.structured.correct, definition.structured.automated),
      structuredEntityRecall: ratio(definition.structured.correct, definition.structured.ground),
      cycleModeled: ratio(draft?.cycle.status === "modeled" ? 1 : 0, 1),
      correctionBurden: { ...definition.correctionBurden, total: burdenTotal },
      criticalMisleadingErrors: { count: definition.criticalErrors.length, errors: definition.criticalErrors },
    },
    provider: {
      usage,
      estimatedCostUsd: costUsd,
      pricing: {
        inputPerMillionUsd: 2,
        cachedInputPerMillionUsd: 0.2,
        outputPerMillionUsd: 12,
        source: "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
      },
      usageUnavailableAfterProviderFailure: draft === null && usage.totalTokens === 0,
    },
    runtimeMs: artifact.timing.totalRuntimeMs,
    failure: artifact.failure,
  };
  writeFileSync(join(reportDir, `${slug}-score.json`), `${JSON.stringify(score, null, 2)}\n`, "utf8");
  caseScores.push({ slug, score });

  aggregate.supportedCorrect += definition.correctFields.length;
  aggregate.supportedAutomated += claims.length;
  aggregate.recalled += definition.correctFields.length;
  aggregate.groundSupported += groundSupported;
  aggregate.statusAgreement += statusAgreement;
  aggregate.statusTotal += Object.keys(ground.facts).length;
  aggregate.evidenceCorrect += evidenceTotal - evidenceIncorrect;
  aggregate.evidenceTotal += evidenceTotal;
  aggregate.structuredCorrect += definition.structured.correct;
  aggregate.structuredAutomated += definition.structured.automated;
  aggregate.structuredGround += definition.structured.ground;
  aggregate.exactUrlsAcquired += definition.acquisition.exactReviewedUrls.acquired;
  aggregate.exactUrlsReviewed += definition.acquisition.exactReviewedUrls.reviewed;
  aggregate.categoriesAcquired += definition.acquisition.sourceCategories.acquired;
  aggregate.categoriesReviewed += definition.acquisition.sourceCategories.reviewed;
  aggregate.acquiredPages += artifact.acquisition.successfullyAcquired.length;
  aggregate.irrelevantPages += definition.acquisition.irrelevantPages;
  aggregate.fetchFailures += artifact.acquisition.failures.length;
  aggregate.criticalErrors += definition.criticalErrors.length;
  aggregate.runtimeMs += artifact.timing.totalRuntimeMs;
  for (const key of Object.keys(aggregate.usage) as Array<keyof Usage>) aggregate.usage[key] += usage[key];
  aggregate.costUsd += costUsd;
  for (const [key, value] of Object.entries(definition.correctionBurden)) {
    aggregate.correctionBurden[key] = (aggregate.correctionBurden[key] ?? 0) + value;
  }
}

const aggregateReport = {
  artifactVersion: 1,
  developmentSet: false,
  preregistered: true,
  cases: caseScores.map(({ slug }) => slug),
  metrics: {
    supportedClaimPrecision: ratio(aggregate.supportedCorrect, aggregate.supportedAutomated),
    supportedSummaryRecall: ratio(aggregate.recalled, aggregate.groundSupported),
    statusAgreement: ratio(aggregate.statusAgreement, aggregate.statusTotal),
    semanticEvidenceCorrectness: ratio(aggregate.evidenceCorrect, aggregate.evidenceTotal),
    structuredEntityPrecision: ratio(aggregate.structuredCorrect, aggregate.structuredAutomated),
    structuredEntityRecall: ratio(aggregate.structuredCorrect, aggregate.structuredGround),
    cycleModeled: ratio(0, 7),
    exactReviewedUrlAcquisition: ratio(aggregate.exactUrlsAcquired, aggregate.exactUrlsReviewed),
    reviewedSourceCategoryAcquisition: ratio(aggregate.categoriesAcquired, aggregate.categoriesReviewed),
    acquiredPages: aggregate.acquiredPages,
    irrelevantPages: aggregate.irrelevantPages,
    fetchFailures: aggregate.fetchFailures,
    correctionBurden: {
      ...aggregate.correctionBurden,
      total: sum(Object.values(aggregate.correctionBurden)),
    },
    criticalMisleadingErrors: aggregate.criticalErrors,
  },
  provider: {
    usage: aggregate.usage,
    recordedUsageEstimatedCostUsd: aggregate.costUsd,
    billedTotalUnknownBecauseFailedRunReportedZeroUsage: true,
  },
  totalRuntimeMs: aggregate.runtimeMs,
};
writeFileSync(join(reportDir, "aggregate-score.json"), `${JSON.stringify(aggregateReport, null, 2)}\n`, "utf8");
console.log(JSON.stringify(aggregateReport));
