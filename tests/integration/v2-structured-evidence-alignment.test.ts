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

function sourceWithBlocks(blocks: readonly string[]): AnalysisSourceContext {
  const source = sourceWith(blocks.join("\n"));
  return {
    ...source,
    page: {
      ...source.page,
      blocks: blocks.map((text, index) => ({
        kind: index === 0 ? "heading" as const : "paragraph" as const,
        text,
      })),
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

  it("aligns a natural-language date-time with its exact ISO time and named zone", async () => {
    const definitionExcerpt = "The application stage ends at the published deadline.";
    const timingExcerpt = "Application deadline: September 15, 2026 at 11:59 PM PDT.";
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
            when: {
              precision: "date_time",
              dateTime: "2026-09-15T23:59:00-07:00",
              certainty: "stated",
            },
            scope: { ...emptyScope, stageIds: ["application"] },
          },
          "September 15, 2026 at 11:59 PM PDT",
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
    expect(result.card.stages.records[0].timings).toHaveLength(1);
    expect(result.evidenceWarnings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "application-deadline" }),
    ]));
  });

  it("uses an omitted year only from one explicit cycle on the same anchor source", async () => {
    const timingExcerpt = "The application stage starts September 17.";
    const source = sourceWithBlocks(["2026 program cycle", timingExcerpt]);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "application",
        order: 1,
        definition: assertion(
          source,
          "implicit-year-application-definition",
          { label: "Application", kind: "application", scope: emptyScope },
          "Application",
          timingExcerpt,
        ),
        timings: [assertion(
          source,
          "implicit-year-application-start",
          {
            event: "starts",
            when: { precision: "date", date: "2026-09-17", certainty: "stated" },
            scope: { ...emptyScope, stageIds: ["application"] },
          },
          "September 17, 2026",
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
    expect(result.card.stages.records[0].timings).toHaveLength(1);
  });

  it("uses the application year on an adjacent-year target lifecycle timeline", async () => {
    const timingExcerpt = "October 1 | National Match application deadline.";
    const source = sourceWithBlocks([
      "The 2026 National Match application",
      timingExcerpt,
      "Fall 2027 | Finalists attending a partner college join the community.",
    ]);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "application",
        order: 1,
        definition: assertion(
          source,
          "adjacent-year-application-definition",
          { label: "Application", kind: "application", scope: emptyScope },
          "Application",
          timingExcerpt,
        ),
        timings: [assertion(
          source,
          "adjacent-year-application-deadline",
          {
            event: "deadline",
            when: { precision: "date", date: "2026-10-01", certainty: "stated" },
            scope: { ...emptyScope, stageIds: ["application"] },
          },
          "October 1, 2026",
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
    expect(result.card.stages.records[0].timings).toHaveLength(1);
  });

  it.each([
    {
      label: "wrong model year",
      cycleHeading: "2026 program cycle",
      timingExcerpt: "The application stage starts September 17.",
      date: "2025-09-17",
    },
    {
      label: "multi-year cycle",
      cycleHeading: "2026–2027 program cycle",
      timingExcerpt: "The application stage starts September 17.",
      date: "2026-09-17",
    },
    {
      label: "historical wording",
      cycleHeading: "2026 program cycle",
      timingExcerpt: "Last year's application stage starts September 17.",
      date: "2026-09-17",
    },
  ])("rejects implicit-year timing under $label", async ({ cycleHeading, timingExcerpt, date }) => {
    const source = sourceWithBlocks([cycleHeading, timingExcerpt]);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "application",
        order: 1,
        definition: assertion(
          source,
          `rejected-${date}-definition`,
          { label: "Application", kind: "application", scope: emptyScope },
          "Application",
          timingExcerpt,
        ),
        timings: [assertion(
          source,
          `rejected-${date}-timing`,
          {
            event: "starts",
            when: { precision: "date", date, certainty: "stated" },
            scope: { ...emptyScope, stageIds: ["application"] },
          },
          date,
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

    const retainedTimings = result.card.stages.status === "modeled"
      ? result.card.stages.records.flatMap((stage) => stage.timings)
      : [];
    expect(retainedTimings).toEqual([]);
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldId: "structured.stages" }),
    ]));
  });

  it("maps explicit range endpoints only to start and end events", async () => {
    const rangeExcerpt = "September 17 \u2013 30 Peer-To-Peer Review";
    const source = sourceWithBlocks(["2026 program cycle", rangeExcerpt]);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "peer-review",
        order: 2,
        definition: assertion(
          source,
          "range-peer-review-definition",
          { label: "Peer-To-Peer Review", kind: "proposal_review", scope: emptyScope },
          "Peer-To-Peer Review",
          rangeExcerpt,
        ),
        timings: [
          assertion(
            source,
            "range-peer-review-start",
            {
              event: "starts",
              when: { precision: "date", date: "2026-09-17", certainty: "stated" },
              scope: { ...emptyScope, stageIds: ["peer-review"] },
            },
            "September 17, 2026",
            rangeExcerpt,
          ),
          assertion(
            source,
            "range-peer-review-end",
            {
              event: "ends",
              when: { precision: "date", date: "2026-09-30", certainty: "stated" },
              scope: { ...emptyScope, stageIds: ["peer-review"] },
            },
            "September 30, 2026",
            rangeExcerpt,
          ),
        ],
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
    expect(result.card.stages.records[0].timings.map((timing) =>
      timing.status === "disclosed" ? timing.value.event : timing.status
    )).toEqual([
      "starts",
      "ends",
    ]);
  });

  it.each([
    {
      label: "wrong range endpoint",
      excerpt: "September 17 \u2013 30 Peer-To-Peer Review",
      date: "2026-09-30",
    },
    {
      label: "nonrange date label",
      excerpt: "Peer-To-Peer Review: September 17",
      date: "2026-09-17",
    },
  ])("does not invent a start event from a $label", async ({ excerpt, date }) => {
    const source = sourceWithBlocks(["2026 program cycle", excerpt]);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "peer-review",
        order: 2,
        definition: assertion(
          source,
          "invalid-range-" + date + "-definition",
          { label: "Peer-To-Peer Review", kind: "proposal_review", scope: emptyScope },
          "Peer-To-Peer Review",
          excerpt,
        ),
        timings: [assertion(
          source,
          "invalid-range-" + date + "-start",
          {
            event: "starts",
            when: { precision: "date", date, certainty: "stated" },
            scope: { ...emptyScope, stageIds: ["peer-review"] },
          },
          date,
          excerpt,
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
    expect(result.card.stages.records[0].timings).toEqual([]);
  });

  it("accepts an exact participant-action 'by' date as a deadline event", async () => {
    const deadlineExcerpt =
      "Entries must be received by September 15, 2026 at 11:59 PM PDT.";
    const source = sourceWithBlocks(["2026 program cycle", deadlineExcerpt]);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "application",
        order: 1,
        definition: assertion(
          source,
          "by-deadline-definition",
          { label: "Application", kind: "application", scope: emptyScope },
          "Application",
          deadlineExcerpt,
        ),
        timings: [assertion(
          source,
          "by-deadline-timing",
          {
            event: "deadline",
            when: {
              precision: "date_time",
              dateTime: "2026-09-15T23:59:00-07:00",
              certainty: "stated",
            },
            scope: { ...emptyScope, stageIds: ["application"] },
          },
          "September 15, 2026 at 11:59 PM PDT",
          deadlineExcerpt,
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
    expect(result.card.stages.records[0].timings).toHaveLength(1);
  });

  it.each([
    {
      label: "wrong time",
      dateTime: "2026-09-15T22:59:00-07:00",
    },
    {
      label: "wrong named-zone offset",
      dateTime: "2026-09-15T23:59:00-08:00",
    },
  ])("rejects a natural date-time with the $label", async ({ dateTime }) => {
    const definitionExcerpt = "The application stage ends at the published deadline.";
    const timingExcerpt = "Application deadline: September 15, 2026 at 11:59 PM PDT.";
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
            when: { precision: "date_time", dateTime, certainty: "stated" },
            scope: { ...emptyScope, stageIds: ["application"] },
          },
          "September 15, 2026 at 11:59 PM PDT",
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
    expect(result.card.stages.records[0].timings).toEqual([]);
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: "application-deadline",
        message: expect.stringMatching(/typed date/i),
      }),
    ]));
  });

  it("repairs only a unique whitespace-boundary excerpt mismatch and retains exact source text", async () => {
    const exactExcerpt = "September 17 – 30Peer-To-Peer Review";
    const proposedExcerpt = "September 17 – 30 Peer-To-Peer Review";
    const source = sourceWith(`2026 schedule: ${exactExcerpt}`);
    const structures = createEmptyModelStructures();
    structures.stages = {
      status: "modeled",
      note: null,
      records: [{
        id: "peer-review",
        order: 2,
        definition: assertion(
          source,
          "peer-review-definition",
          { label: "Peer-To-Peer Review", kind: "proposal_review", scope: emptyScope },
          "Peer-To-Peer Review",
          proposedExcerpt,
        ),
        timings: [],
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
    expect(result.card.stages.records[0].definition.sources[0]?.excerpt).toBe(exactExcerpt);
  });
});
