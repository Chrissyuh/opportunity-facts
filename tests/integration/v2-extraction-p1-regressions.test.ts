import { describe, expect, it } from "vitest";

import {
  createEmptyModelStructures,
  extractOpportunityCard,
  type AnalysisSourceContext,
} from "@/lib/analysis/model-extraction";
import {
  createEmptyFacts,
  type EvidenceSource,
} from "@/lib/opportunity/schema";

function evidence(source: AnalysisSourceContext, excerpt: string): EvidenceSource {
  return {
    id: source.page.id,
    url: source.page.url,
    title: source.page.title,
    pageType: source.page.pageType,
    accessedAt: source.accessedAt,
    excerpt,
  };
}

function assertion<const T>(
  source: AnalysisSourceContext,
  claimId: string,
  value: T,
  displayValue: string,
  excerpt: string,
) {
  return {
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources: [evidence(source, excerpt)],
    note: null,
    conflictingValues: [],
  };
}

const emptyScope = {
  variantIds: [] as string[],
  stageIds: [] as string[],
  pathwayIds: [] as string[],
};

describe("V2 extraction P1 regressions", () => {
  it("accepts Lumiere's exact founder and mentor wording without discarding its valid credit partnership", async () => {
    const creditExcerpt = "Lumiere has a credit partnership with the University of California, San Diego Extended Studies.";
    const founderExcerpt = "Founded by Harvard and Oxford researchers, Lumiere Education enables ambitious high school and middle school students";
    const mentorExcerpt = "Our mentors are Ph.D. researchers, postdoctoral scholars, and professors from prestigious universities like Harvard, Stanford, Oxford, and MIT.";
    const source: AnalysisSourceContext = {
      accessedAt: "2026-08-11T22:32:46.281Z",
      page: {
        id: "lumiere-reviewed-wording",
        url: "https://lumiere-fixture.example/program",
        title: "Lumiere reviewed wording fixture",
        pageType: "user_supplied",
        trust: "untrusted_source_text",
        text: [creditExcerpt, founderExcerpt, mentorExcerpt].join(" "),
        blocks: [],
        links: [],
        truncated: false,
      },
    };
    const structures = createEmptyModelStructures();
    structures.institutionRelationships = {
      status: "modeled",
      note: null,
      records: [
        {
          id: "ucsd-credit-partnership",
          assertion: assertion(
            source,
            "ucsd-credit-partnership-claim",
            {
              subject: "opportunity",
              subjectOrganizationId: null,
              targetOrganizationId: null,
              targetInstitutionName: "University of California, San Diego Extended Studies",
              relationshipType: "credit_partnership",
              description: "Lumiere states that it has a credit partnership with UC San Diego Extended Studies.",
              scope: emptyScope,
            },
            "Credit partnership — UC San Diego Extended Studies",
            creditExcerpt,
          ),
        },
        {
          id: "harvard-founder-affiliation",
          assertion: assertion(
            source,
            "harvard-founder-affiliation-claim",
            {
              subject: "founders",
              subjectOrganizationId: null,
              targetOrganizationId: null,
              targetInstitutionName: "Harvard",
              relationshipType: "founders_affiliated_with",
              description: "Lumiere describes its founders as Harvard- and Oxford-affiliated researchers.",
              scope: emptyScope,
            },
            "Founders affiliated with — Harvard and Oxford",
            founderExcerpt,
          ),
        },
        {
          id: "mentor-university-affiliations",
          assertion: assertion(
            source,
            "mentor-university-affiliations-claim",
            {
              subject: "mentors",
              subjectOrganizationId: null,
              targetOrganizationId: null,
              targetInstitutionName: "Harvard, Stanford, Oxford, and MIT",
              relationshipType: "mentors_affiliated_with",
              description: "Lumiere says its mentors include researchers affiliated with named universities.",
              scope: emptyScope,
            },
            "Mentor affiliations — Harvard, Stanford, Oxford, and MIT",
            mentorExcerpt,
          ),
        },
      ],
    };

    const result = await extractOpportunityCard([source], async () => ({
      facts: createEmptyFacts(),
      structures,
    }));

    expect(result.card.institutionRelationships.status).toBe("modeled");
    if (result.card.institutionRelationships.status !== "modeled") return;
    expect(result.card.institutionRelationships.records.map((relationship) =>
      relationship.assertion.status === "disclosed"
        ? relationship.assertion.value.relationshipType
        : relationship.assertion.status,
    )).toEqual([
      "credit_partnership",
      "founders_affiliated_with",
      "mentors_affiliated_with",
    ]);
    expect(result.card.facts.institution_relationship.status).toBe("disclosed");
    expect(result.evidenceWarnings.filter((warning) =>
      warning.fieldId === "structured.institutionRelationships"
    )).toEqual([]);
  });
});
