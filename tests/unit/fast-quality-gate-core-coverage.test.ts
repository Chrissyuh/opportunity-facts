import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type {
  FastAnalysisFieldId,
  FastCoreAreaAssessment,
  FastCoreAreaAssessmentStatus,
  FastCoreAreaId,
} from "@/lib/analysis/model-extraction";
import { assessFastAnalysisQuality } from "@/lib/analysis/quality-gate";
import { createEmptyCard, factSchema } from "@/lib/opportunity/schema";

const AREA_FIELDS = {
  identity: ["opportunity_name"],
  eligibility: ["grade_levels"],
  deadline: ["application_deadline"],
  schedule: ["start_date", "duration"],
  format_location: ["participation_format", "location"],
  cost: ["tuition"],
  financial_aid: ["financial_aid"],
  operator: ["operating_organization"],
  institution_relationship: ["institution_relationship"],
  selection: ["selection_process"],
  outcomes: ["other_benefits"],
} as const satisfies Record<FastCoreAreaId, readonly FastAnalysisFieldId[]>;

const AREA_IDS = Object.keys(AREA_FIELDS) as FastCoreAreaId[];

function disclosed(value: string) {
  return factSchema.parse({
    status: "disclosed",
    value,
    displayValue: value,
    claimKind: "source_stated",
    sources: [{
      id: "program",
      url: "https://program.example/",
      title: "Program",
      pageType: "user_supplied",
      accessedAt: "2026-08-21T00:00:00.000Z",
      excerpt: value,
    }],
  });
}

function fixture(statuses: Partial<Record<FastCoreAreaId, FastCoreAreaAssessmentStatus>> = {}) {
  const card = createEmptyCard({
    slug: "core-coverage",
    summary: "Automated analysis draft.",
    reviewState: "automated_draft",
  });
  const assessments: FastCoreAreaAssessment[] = AREA_IDS.map((area) => {
    const status = statuses[area] ?? "retained";
    const retained = status === "retained" ? [...AREA_FIELDS[area]] : [];
    for (const fieldId of retained) card.facts[fieldId] = disclosed(`${area} supported`);
    return {
      area,
      modelStatus: status === "checked_not_found"
        ? "not_found"
        : status === "not_applicable"
          ? "not_applicable"
          : status === "unclear"
            ? "unclear"
            : "supported",
      status,
      candidateFieldIds: status === "checked_not_found" ? [] : [...AREA_FIELDS[area]],
      retainedFieldIds: retained,
    };
  });
  return { card, assessments };
}

function assess(fixtureValue: ReturnType<typeof fixture>) {
  return assessFastAnalysisQuality({
    card: fixtureValue.card,
    acquiredPages: 3,
    pageWarnings: [],
    evidenceWarnings: [],
    attentionItems: [],
    validationStats: {
      attemptedSupportedClaims: 12,
      retainedSupportedClaims: 12,
      withheldSupportedClaims: 0,
    },
    coreAreaAssessments: fixtureValue.assessments,
  });
}

describe("fast quality gate core coverage", () => {
  it("does not call a superficially dense result good when three primary areas remain unresolved", () => {
    const result = assess(fixture({
      eligibility: "checked_not_found",
      deadline: "checked_not_found",
      cost: "checked_not_found",
    }));

    expect(result.signals.supportedSummaryFacts).toBeGreaterThanOrEqual(7);
    expect(result.signals.unresolvedPrimaryAreas).toBe(3);
    expect(result.outcome).toBe("usable_with_caveats");
    expect(result.reasons).toContainEqual(expect.objectContaining({
      code: "PRIMARY_COVERAGE_GAPS",
      priority: "medium",
    }));
    expect(result.reasons.find((reason) => reason.code === "PRIMARY_COVERAGE_GAPS")?.explanation)
      .toMatch(/does not claim.*absent/i);
  });

  it("does not suppress an otherwise useful result for one actively checked area with no supported statement", () => {
    const result = assess(fixture({ eligibility: "checked_not_found" }));

    expect(result.outcome).toBe("good");
    expect(result.signals.unresolvedPrimaryAreas).toBe(1);
    expect(result.reasons.map((reason) => reason.code)).not.toContain("PRIMARY_COVERAGE_GAPS");
  });

  it("distinguishes a supported core candidate withheld by validation from checked-not-found", () => {
    const result = assess(fixture({ cost: "withheld" }));

    expect(result.outcome).toBe("usable_with_caveats");
    expect(result.signals.withheldCoreAreas).toBe(1);
    expect(result.reasons).toContainEqual(expect.objectContaining({
      code: "CORE_CLAIMS_WITHHELD",
      priority: "medium",
    }));
    expect(result.reasons.map((reason) => reason.code)).not.toContain("PRIMARY_COVERAGE_GAPS");
  });
});
