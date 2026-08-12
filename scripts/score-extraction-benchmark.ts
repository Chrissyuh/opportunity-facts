import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Judgment = {
  readonly reason: string;
  readonly correctEvidenceAttachments: number;
};

type CaseDefinition = {
  readonly run: string;
  readonly ground: string;
  readonly incorrect: Readonly<Record<string, Judgment>>;
  readonly recalledSummaryFacts: readonly string[];
  readonly structured: { readonly correct: number; readonly automated: number; readonly ground: number };
  readonly correctionBurden: Readonly<Record<string, number>>;
  readonly criticalErrors: readonly string[];
};

const CASES = {
  "nasa-techrise-2026-2027": {
    run: "nasa-techrise-2026-2027-run-03.json",
    ground: "nasa-techrise-student-challenge-2026-2027.json",
    incorrect: {},
    recalledSummaryFacts: [
      "opportunity_name", "opportunity_category", "operating_organization",
      "organization_type", "grade_levels", "geographic_restrictions", "entry_format",
      "sponsor_requirement", "acceptance_count", "selection_process",
      "selection_evidence", "personal_information", "data_sharing", "project_license",
      "cancellation_rights", "material_terms",
    ],
    structured: { correct: 5, automated: 5, ground: 13 },
    correctionBurden: {
      missingClaim: 7, unsupportedClaimRemoval: 0, statusCorrection: 11,
      valueCorrection: 2, relationshipOrScopeCorrection: 2, evidenceCorrection: 0,
      structuralCorrection: 8,
    },
    criticalErrors: [],
  },
  "lumiere-fall-2026": {
    run: "lumiere-fall-2026-run-02.json",
    ground: "lumiere-research-scholar-program-fall-2026.json",
    incorrect: {
      other_benefits: {
        reason: "Journal-submission support is tier-scoped, but the flat display made it appear universal.",
        correctEvidenceAttachments: 0,
      },
    },
    recalledSummaryFacts: [
      "opportunity_name", "opportunity_category", "official_url",
      "operating_organization", "named_institution", "institution_relationship",
      "relationship_explanation", "prerequisite_skills", "financial_aid",
      "selection_process", "college_credit", "mentorship",
    ],
    structured: { correct: 0, automated: 0, ground: 33 },
    correctionBurden: {
      missingClaim: 18, unsupportedClaimRemoval: 1, statusCorrection: 24,
      valueCorrection: 0, relationshipOrScopeCorrection: 1, evidenceCorrection: 1,
      structuralCorrection: 33,
    },
    criticalErrors: [],
  },
  "diamond-challenge-2027": {
    run: "diamond-challenge-2027-run-03.json",
    ground: "diamond-challenge-2027.json",
    incorrect: {
      organization_type: {
        reason: "The excerpt describes the Diamond Challenge as an initiative; it does not establish Horn Entrepreneurship's organization type.",
        correctEvidenceAttachments: 0,
      },
    },
    recalledSummaryFacts: [
      "opportunity_name", "opportunity_category", "operating_organization",
      "named_institution", "institution_relationship", "relationship_explanation",
      "grade_levels", "ages", "geographic_restrictions", "entry_format",
      "sponsor_requirement", "participation_format", "travel_requirements",
      "selection_process", "selection_evidence", "other_benefits",
      "personal_information", "project_license", "publicity_rights", "confidentiality",
      "cancellation_rights", "material_terms",
    ],
    structured: { correct: 7, automated: 7, ground: 23 },
    correctionBurden: {
      missingClaim: 13, unsupportedClaimRemoval: 1, statusCorrection: 9,
      valueCorrection: 0, relationshipOrScopeCorrection: 4, evidenceCorrection: 1,
      structuralCorrection: 16,
    },
    criticalErrors: [],
  },
} as const satisfies Record<string, CaseDefinition>;

type EvidenceAttachment = { readonly excerpt: string };
type ConflictCandidate = {
  readonly displayValue: string;
  readonly sources: readonly EvidenceAttachment[];
};
type ScoredFact = {
  readonly status: string;
  readonly displayValue: string | null;
  readonly sources: readonly EvidenceAttachment[];
  readonly conflictingValues: readonly ConflictCandidate[];
};
type BenchmarkArtifact = {
  readonly result: { readonly draftCard: { readonly facts: Readonly<Record<string, ScoredFact>> } | null };
};
type GroundCard = { readonly facts: Readonly<Record<string, ScoredFact>> };
type ClaimRecord = {
  readonly id: string;
  readonly fieldId: string;
  readonly displayedValue: string;
  readonly evidenceAttachments: number;
  readonly semanticallySupported: boolean;
  readonly correctEvidenceAttachments: number;
  readonly judgment: string;
};

function ratio(numerator: number, denominator: number) {
  return { numerator, denominator, value: denominator === 0 ? null : numerator / denominator };
}

function sumRecord(record: Readonly<Record<string, number>>) {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

for (const [slug, definition] of Object.entries(CASES)) {
  const artifact = readJson<BenchmarkArtifact>(
    join("research", "extraction-benchmark", "post-fix", definition.run),
  );
  const ground = readJson<GroundCard>(join("data", "opportunities", definition.ground));
  const draft = artifact.result.draftCard;
  if (!draft) throw new Error(`${slug} has no draft to score.`);

  const incorrect: Readonly<Record<string, Judgment>> = definition.incorrect;
  const claims: ClaimRecord[] = [];
  for (const [fieldId, fact] of Object.entries(draft.facts)) {
    if (fact.status === "disclosed") {
      const judgment = incorrect[fieldId];
      claims.push({
        id: fieldId,
        fieldId,
        displayedValue: fact.displayValue ?? "",
        evidenceAttachments: fact.sources.length,
        semanticallySupported: judgment === undefined,
        correctEvidenceAttachments: judgment?.correctEvidenceAttachments ?? fact.sources.length,
        judgment: judgment?.reason ?? "The exact excerpt supports the displayed claim in the attached object and scope.",
      });
    }
    if (fact.status === "conflicting") {
      fact.conflictingValues.forEach((candidate, index) => {
        const id = `${fieldId}#${index}`;
        const judgment = incorrect[id];
        claims.push({
          id,
          fieldId,
          displayedValue: candidate.displayValue,
          evidenceAttachments: candidate.sources.length,
          semanticallySupported: judgment === undefined,
          correctEvidenceAttachments: judgment?.correctEvidenceAttachments ?? candidate.sources.length,
          judgment: judgment?.reason ?? "The exact excerpt supports this displayed conflict candidate in the attached object and scope.",
        });
      });
    }
  }

  const unusedJudgments = Object.keys(incorrect).filter(
    (id) => !claims.some((claim) => claim.id === id),
  );
  if (unusedJudgments.length > 0) {
    throw new Error(`${slug} has unused semantic judgments: ${unusedJudgments.join(", ")}.`);
  }

  const groundSupported = Object.values(ground.facts).filter(
    (fact) => fact.status === "disclosed" || fact.status === "conflicting",
  ).length;
  const fieldIds = Object.keys(ground.facts);
  const statusAgreements = fieldIds.filter(
    (fieldId) => draft.facts[fieldId]?.status === ground.facts[fieldId].status,
  ).length;
  const evidenceAttachments = claims.reduce((sum, claim) => sum + claim.evidenceAttachments, 0);
  const correctEvidenceAttachments = claims.reduce(
    (sum, claim) => sum + claim.correctEvidenceAttachments,
    0,
  );

  const score = {
    artifactVersion: 1,
    developmentSet: true,
    runArtifact: definition.run,
    groundTruthCard: definition.ground,
    semanticReview: { reviewer: "human_manual_review", claims },
    metrics: {
      supportedClaimPrecision: ratio(claims.filter((claim) => claim.semanticallySupported).length, claims.length),
      supportedSummaryRecall: ratio(definition.recalledSummaryFacts.length, groundSupported),
      statusAgreement: ratio(statusAgreements, fieldIds.length),
      semanticEvidenceCorrectness: ratio(correctEvidenceAttachments, evidenceAttachments),
      structuredEntityPrecision: ratio(definition.structured.correct, definition.structured.automated),
      structuredEntityRecall: ratio(definition.structured.correct, definition.structured.ground),
      correctionBurden: { ...definition.correctionBurden, total: sumRecord(definition.correctionBurden) },
      criticalMisleadingErrors: { count: definition.criticalErrors.length, errors: definition.criticalErrors },
    },
  };

  writeFileSync(
    join("research", "extraction-benchmark", "reports", `${slug}-post-fix-score.json`),
    `${JSON.stringify(score, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify({ slug, metrics: score.metrics }));
}
