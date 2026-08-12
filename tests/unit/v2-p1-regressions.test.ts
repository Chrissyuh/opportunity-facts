import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  applyOpportunityProjections,
  createEmptyCard,
  getDisclosureCount,
  opportunityCardSchema,
  type EvidenceSource,
  type OpportunityCard,
} from "../../lib/opportunity";

const ACCESSED_AT = "2026-08-12T00:00:00.000Z";

const page = {
  id: "p1-source",
  url: "https://p1-regression.example/program",
  title: "P1 regression source",
  pageType: "official_program_page" as const,
  accessedAt: ACCESSED_AT,
};

const evidence: EvidenceSource = {
  ...page,
  excerpt: "The program states this structured fact.",
};

function assertion<T>(claimId: string, value: T, displayValue: string) {
  return {
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources: [evidence],
    note: null,
    conflictingValues: [],
  };
}

function emptyScope() {
  return { variantIds: [] as string[], stageIds: [] as string[], pathwayIds: [] as string[] };
}

async function readReviewedCard(file: string): Promise<OpportunityCard> {
  return opportunityCardSchema.parse(
    JSON.parse(await readFile(`data/opportunities/${file}`, "utf8")) as unknown,
  );
}

function collectExcerpts(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectExcerpts);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.excerpt === "string" ? [record.excerpt] : []),
    ...Object.values(record).flatMap(collectExcerpts),
  ];
}

describe("Schema V2 P1 regressions", () => {
  it.each([
    ["nasa-techrise-student-challenge-2026-2027.json", { assessed: 13, applicable: 12, disclosed: 6 }],
    ["lumiere-research-scholar-program-fall-2026.json", { assessed: 13, applicable: 13, disclosed: 11 }],
    ["diamond-challenge-2027.json", { assessed: 13, applicable: 13, disclosed: 10 }],
  ] as const)("keeps the reviewed disclosure triple exact for %s", async (file, expected) => {
    const count = getDisclosureCount(await readReviewedCard(file));
    expect({
      assessed: count.assessed,
      applicable: count.applicable,
      disclosed: count.disclosed,
    }).toEqual(expected);
  });

  it("does not call a mandatory-cost total disclosed when a conditional cost amount is unresolved", () => {
    const candidate = createEmptyCard({ slug: "conditional-unresolved-cost" });
    candidate.sourcePagesChecked = [page];
    candidate.costItems = {
      status: "modeled",
      completeness: "incomplete",
      note: null,
      records: [
        {
          id: "conditional-travel",
          definition: assertion(
            "conditional-travel-definition",
            {
              label: "Travel if selected as a finalist",
              kind: "travel",
              requirement: "conditional",
              scope: emptyScope(),
            },
            "Conditional finalist travel",
          ),
          amount: {
            claimId: "conditional-travel-amount",
            status: "not_found",
            value: null,
            displayValue: null,
            claimKind: null,
            sources: [],
            note: "The participant-paid amount and coverage are not published.",
            conflictingValues: [],
          },
          chargeBasis: null,
          treatment: null,
          refundability: null,
          includedItems: [],
          excludedItems: [],
          conditions: [],
        },
      ],
    };

    const card = opportunityCardSchema.parse(applyOpportunityProjections(candidate));
    expect(card.facts.estimated_total_mandatory_cost.status).toBe("not_found");
    expect(card.facts.estimated_total_mandatory_cost.displayValue).toBeNull();
    expect(card.facts.estimated_total_mandatory_cost.note).toMatch(/unresolved|not published/i);
  });

  it("rejects person-affiliation relationship types paired with the opportunity subject", () => {
    for (const relationshipType of [
      "founders_affiliated_with",
      "mentors_affiliated_with",
      "staff_affiliated_with",
    ] as const) {
      const candidate = createEmptyCard({
        slug: `invalid-${relationshipType.replaceAll("_", "-")}`,
      });
      candidate.sourcePagesChecked = [page];
      candidate.institutionRelationships = {
        status: "modeled",
        note: null,
        records: [
          {
            id: "invalid-person-affiliation",
            assertion: assertion(
              "invalid-person-affiliation-claim",
              {
                subject: "opportunity",
                subjectOrganizationId: null,
                targetOrganizationId: null,
                targetInstitutionName: "Example University",
                relationshipType,
                description: "A deliberately inconsistent person-affiliation record.",
                scope: emptyScope(),
              },
              "Inconsistent person affiliation",
            ),
          },
        ],
      };

      const projected = applyOpportunityProjections(candidate);
      expect(
        () => opportunityCardSchema.parse(projected),
        `${relationshipType} must require its matching person subject`,
      ).toThrow(/subject|founder|mentor|staff|relationship/i);
    }
  });

  it("rejects institutional partnership semantics paired with a person subject", () => {
    for (const subject of ["founders", "mentors", "staff"] as const) {
      const candidate = createEmptyCard({ slug: `invalid-${subject}-partnership` });
      candidate.sourcePagesChecked = [page];
      candidate.institutionRelationships = {
        status: "modeled",
        note: null,
        records: [
          {
            id: `invalid-${subject}-partnership`,
            assertion: assertion(
              `invalid-${subject}-partnership-claim`,
              {
                subject,
                subjectOrganizationId: null,
                targetOrganizationId: null,
                targetInstitutionName: "Example University",
                relationshipType: "institution_partnered",
                description: "A person's affiliation was deliberately upgraded to partnership.",
                scope: emptyScope(),
              },
              "Institution partnered",
            ),
          },
        ],
      };

      expect(() => opportunityCardSchema.parse(applyOpportunityProjections(candidate)))
        .toThrow(/cannot be upgraded|affiliation|relationship/i);
    }
  });

  it("does not leave an unsupported topical-prize claim in the Diamond summary", async () => {
    const card = await readReviewedCard("diamond-challenge-2027.json");
    const mentionsTopicalPrizes = /topical prizes?/i.test(card.summary);
    const hasTopicalEvidence = collectExcerpts(card).some((excerpt) =>
      /topical prizes?|DSWA|Gore Innovation|Pathways to Prosperity|Human Flourishing/i.test(excerpt),
    );

    expect(
      mentionsTopicalPrizes && !hasTopicalEvidence,
      "A displayed summary may mention topical prizes only when an exact retained excerpt supports that claim.",
    ).toBe(false);
  });
});
