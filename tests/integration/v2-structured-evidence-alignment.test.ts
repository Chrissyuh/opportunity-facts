import { describe, expect, it } from "vitest";

import {
  createEmptyModelStructures,
  extractOpportunityCard,
  type AnalysisSourceContext,
} from "@/lib/analysis/model-extraction";
import { createEmptyFacts, type EvidenceSource } from "@/lib/opportunity/schema";

const emptyScope = {
  variantIds: [] as string[],
  stageIds: [] as string[],
  pathwayIds: [] as string[],
};

function sourceWith(text: string): AnalysisSourceContext {
  return {
    accessedAt: "2026-08-11T23:00:00.000Z",
    page: {
      id: "semantic-alignment-source",
      url: "https://semantic-alignment.example/program",
      title: "Semantic alignment fixture",
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text,
      blocks: [],
      links: [],
      truncated: false,
    },
  };
}

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

describe("v2 structured evidence semantic alignment", () => {
  it("drops a cost whose typed money contradicts its excerpt while preserving a supported sibling", async () => {
    const tuitionExcerpt = "Required tuition is USD 1,000 per participant.";
    const feeExcerpt = "The application fee is USD 25 per application.";
    const source = sourceWith(`${tuitionExcerpt} ${feeExcerpt}`);
    const structures = createEmptyModelStructures();
    structures.costItems = {
      status: "modeled",
      completeness: "complete",
      note: null,
      records: [
        {
          id: "tuition",
          definition: assertion(
            source,
            "tuition-definition",
            { label: "Required tuition", kind: "tuition", requirement: "required", scope: emptyScope },
            "Required tuition",
            tuitionExcerpt,
          ),
          amount: assertion(
            source,
            "tuition-amount",
            { kind: "exact", amount: 999, currency: "USD" },
            "USD 999",
            tuitionExcerpt,
          ),
          chargeBasis: null,
          treatment: null,
          refundability: null,
          includedItems: [],
          excludedItems: [],
          conditions: [],
        },
        {
          id: "application-fee",
          definition: assertion(
            source,
            "application-fee-definition",
            { label: "Application fee", kind: "application_fee", requirement: "required", scope: emptyScope },
            "Application fee",
            feeExcerpt,
          ),
          amount: assertion(
            source,
            "application-fee-amount",
            { kind: "exact", amount: 25, currency: "USD" },
            "USD 25",
            feeExcerpt,
          ),
          chargeBasis: null,
          treatment: null,
          refundability: null,
          includedItems: [],
          excludedItems: [],
          conditions: [],
        },
      ],
    };

    const result = await extractOpportunityCard([source], async () => ({
      facts: createEmptyFacts(),
      structures,
    }));

    expect(result.card.costItems.status).toBe("modeled");
    if (result.card.costItems.status !== "modeled") return;
    expect(result.card.costItems.records.map((record) => record.id)).toEqual(["application-fee"]);
    expect(result.card.costItems.completeness).toBe("incomplete");
    expect(result.card.facts.tuition.status).toBe("not_found");
    expect(result.card.facts.application_fee.displayValue).toBe("USD 25");
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldId: "structured.costItems",
        sourceId: "tuition-amount",
        message: expect.stringMatching(/typed money value/i),
      }),
    ]));
  });

  it("removes a mismatched typed date without discarding the supported stage", async () => {
    const definitionExcerpt = "The process begins with an application stage.";
    const timingExcerpt = "The application deadline is January 15, 2027.";
    const source = sourceWith(`${definitionExcerpt} ${timingExcerpt}`);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "application",
        order: 1,
        definition: assertion(
          source,
          "application-definition",
          { label: "Application", kind: "application", scope: emptyScope },
          "Application",
          definitionExcerpt,
        ),
        timings: [assertion(
          source,
          "application-deadline",
          {
            event: "deadline",
            when: { precision: "date", date: "2027-01-16", certainty: "stated" },
            scope: emptyScope,
          },
          "Deadline: January 16, 2027",
          timingExcerpt,
        )],
        durations: [],
        timeCommitments: [],
        formats: [],
        locations: [],
        selectionRules: [],
        advancement: [],
        requirements: [],
        travelRequirements: [],
      }],
    };

    const result = await extractOpportunityCard([source], async () => ({
      facts: createEmptyFacts(),
      structures,
    }));

    expect(result.card.stages.status).toBe("modeled");
    if (result.card.stages.status !== "modeled") return;
    expect(result.card.stages.records).toHaveLength(1);
    expect(result.card.stages.records[0].timings).toEqual([]);
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldId: "structured.stages",
        sourceId: "application-deadline",
        message: expect.stringMatching(/typed date/i),
      }),
    ]));
  });

  it("removes a mismatched typed count while preserving other supported stage claims", async () => {
    const definitionExcerpt = "A proposal review stage selects advancing teams.";
    const advancementExcerpt = "Exactly 50 teams advance to the next stage.";
    const ruleExcerpt = "Judges review each submitted proposal.";
    const source = sourceWith(`${definitionExcerpt} ${advancementExcerpt} ${ruleExcerpt}`);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "proposal-review",
        order: 1,
        definition: assertion(
          source,
          "proposal-review-definition",
          { label: "Proposal review", kind: "proposal_review", scope: emptyScope },
          "Proposal review",
          definitionExcerpt,
        ),
        timings: [],
        durations: [],
        timeCommitments: [],
        formats: [],
        locations: [],
        selectionRules: [assertion(
          source,
          "proposal-review-rule",
          { rule: ruleExcerpt, scope: emptyScope },
          ruleExcerpt,
          ruleExcerpt,
        )],
        advancement: [assertion(
          source,
          "proposal-review-advancement",
          { count: 60, description: "60 teams advance", scope: emptyScope },
          "60 teams advance",
          advancementExcerpt,
        )],
        requirements: [],
        travelRequirements: [],
      }],
    };

    const result = await extractOpportunityCard([source], async () => ({
      facts: createEmptyFacts(),
      structures,
    }));

    expect(result.card.stages.status).toBe("modeled");
    if (result.card.stages.status !== "modeled") return;
    expect(result.card.stages.records[0].advancement).toEqual([]);
    expect(result.card.stages.records[0].selectionRules).toHaveLength(1);
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldId: "structured.stages",
        sourceId: "proposal-review-advancement",
        message: expect.stringMatching(/typed numeric value/i),
      }),
    ]));
  });

  it("removes a typed participation format contradicted by its excerpt", async () => {
    const definitionExcerpt = "Finalists attend a pitch stage.";
    const formatExcerpt = "The pitch takes place in person at the final event.";
    const source = sourceWith(`${definitionExcerpt} ${formatExcerpt}`);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "pitch",
        order: 1,
        definition: assertion(
          source,
          "pitch-definition",
          { label: "Pitch", kind: "pitch", scope: emptyScope },
          "Pitch",
          definitionExcerpt,
        ),
        timings: [],
        durations: [],
        timeCommitments: [],
        formats: [assertion(
          source,
          "pitch-format",
          { formats: ["online"], scope: emptyScope },
          "Online",
          formatExcerpt,
        )],
        locations: [],
        selectionRules: [],
        advancement: [],
        requirements: [],
        travelRequirements: [],
      }],
    };

    const result = await extractOpportunityCard([source], async () => ({
      facts: createEmptyFacts(),
      structures,
    }));

    expect(result.card.stages.status).toBe("modeled");
    if (result.card.stages.status !== "modeled") return;
    expect(result.card.stages.records[0].formats).toEqual([]);
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldId: "structured.stages",
        sourceId: "pitch-format",
        message: expect.stringMatching(/typed enum value/i),
      }),
    ]));
  });
});
