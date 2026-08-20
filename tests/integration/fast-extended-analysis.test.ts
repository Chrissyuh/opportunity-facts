import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deriveDeterministicAttention } from "@/lib/analysis/attention";
import { mergeExtendedAttention, runExtendedResearch } from "@/lib/analysis/extended-research";
import {
  buildExtendedDetailSourcePayload,
  buildFastAnalysisInstructions,
  buildFastModelTextFormat,
  buildFastSourcePayload,
  compactCandidateFacts,
  createEmptyModelStructures,
  FAST_ANALYSIS_FIELD_IDS,
  FAST_MODEL_INPUT_CHARACTERS,
  FAST_MODEL_OUTPUT_TOKENS,
  type AnalysisSourceContext,
  type ExtendedModelExtractor,
  type ModelExtraction,
} from "@/lib/analysis/model-extraction";
import { analyzeSourceContexts, type AnalysisPipelineResult } from "@/lib/analysis/pipeline";
import { assessFastAnalysisQuality } from "@/lib/analysis/quality-gate";
import {
  extendedResearchRequestSchema,
  InMemoryResearchSessionStore,
  RESEARCH_SESSION_MAX_ENTRIES,
  RESEARCH_SESSION_MAX_SOURCE_CHARACTERS,
  RESEARCH_SESSION_TTL_MS,
} from "@/lib/analysis/research-session";
import { createEmptyCard, createEmptyFacts, factSchema, type EvidenceSource, type OpportunityCard } from "@/lib/opportunity/schema";

const ACCESSED_AT = "2026-08-20T12:00:00.000Z";

function source(text: string): AnalysisSourceContext {
  return {
    accessedAt: ACCESSED_AT,
    page: {
      id: "program-page",
      url: "https://program.example/apply",
      title: "North Star Research Program — Fall 2026",
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text,
      blocks: text.split("\n").map((line) => ({ kind: "paragraph" as const, text: line })),
      links: [],
      truncated: false,
    },
  };
}

function evidence(context: AnalysisSourceContext, excerpt: string): EvidenceSource {
  return {
    id: context.page.id,
    url: context.page.url,
    title: context.page.title,
    pageType: context.page.pageType,
    accessedAt: context.accessedAt,
    excerpt,
  };
}

function disclosed(context: AnalysisSourceContext, excerpt: string, value: string) {
  return factSchema.parse({
    status: "disclosed",
    value,
    displayValue: value,
    claimKind: "source_stated",
    sources: [evidence(context, excerpt)],
  });
}

function normalExtraction(context: AnalysisSourceContext): ModelExtraction {
  const facts = createEmptyFacts();
  facts.opportunity_name = disclosed(context, "North Star Research Program", "North Star Research Program");
  facts.operating_organization = disclosed(context, "Operated by North Star Learning", "North Star Learning");
  facts.grade_levels = disclosed(context, "Students in grades 9–12 may apply", "Grades 9–12");
  facts.application_deadline = disclosed(context, "Applications close October 1, 2026", "October 1, 2026");
  facts.participation_format = disclosed(context, "The program is online", "Online");
  facts.tuition = disclosed(context, "Tuition is $500", "$500");
  facts.selection_process = disclosed(context, "Applications are reviewed and finalists interview", "Application review and finalist interview");
  return { facts, structures: createEmptyModelStructures(), attentionCandidates: [] };
}

async function normalResult(context: AnalysisSourceContext): Promise<AnalysisPipelineResult> {
  return analyzeSourceContexts([context], [], {
    extractor: async () => normalExtraction(context),
    qualityMode: "normal",
  });
}

describe("fast Analyze and Extended Research", () => {
  it("keeps the normal provider contract sparse and bounded", () => {
    const format = buildFastModelTextFormat();
    const serialized = JSON.stringify(format.schema);
    expect(FAST_ANALYSIS_FIELD_IDS.length).toBeLessThan(45);
    expect(FAST_MODEL_OUTPUT_TOKENS).toBe(4_800);
    expect(serialized).toContain("fieldId");
    expect(serialized).not.toContain('"organizations"');
    expect(serialized).not.toContain('"pathways"');
    expect(serialized).not.toContain('"costItems"');
    expect(serialized).not.toContain('"accessedAt"');
    expect(serialized).not.toContain('"pageType"');
    expect(serialized).not.toContain('"calculation"');
    expect(serialized.length).toBeLessThan(35_000);
  });

  it("hydrates compact source references and rejects unknown source ids", () => {
    const context = source("North Star Research Program");
    const facts = compactCandidateFacts([{
      fieldId: "opportunity_name",
      status: "disclosed",
      value: "North Star Research Program",
      displayValue: "North Star Research Program",
      normalizedValue: null,
      claimKind: "source_stated",
      sources: [{ sourceId: context.page.id, excerpt: "North Star Research Program" }],
      note: null,
    }, {
      fieldId: "operating_organization",
      status: "disclosed",
      value: "Invented operator",
      displayValue: "Invented operator",
      normalizedValue: null,
      claimKind: "source_stated",
      sources: [{ sourceId: "unknown-source", excerpt: "Invented operator" }],
      note: null,
    }], FAST_ANALYSIS_FIELD_IDS, [context]);
    expect(facts.opportunity_name.sources).toEqual([expect.objectContaining({
      id: context.page.id,
      url: context.page.url,
      title: context.page.title,
      accessedAt: context.accessedAt,
      excerpt: "North Star Research Program",
    })]);
    expect(facts.operating_organization.status).toBe("not_found");
  });

  it("hydrates compact conflicts without selecting one value", () => {
    const context = source("Deadline is October 1. Another official section says October 15.");
    const facts = compactCandidateFacts([{
      fieldId: "application_deadline",
      status: "conflicting",
      note: "Two official dates conflict.",
      conflictingValues: [{
        value: "October 1",
        displayValue: "October 1",
        normalizedValue: null,
        sources: [{ sourceId: context.page.id, excerpt: "Deadline is October 1" }],
        note: null,
      }, {
        value: "October 15",
        displayValue: "October 15",
        normalizedValue: null,
        sources: [{ sourceId: context.page.id, excerpt: "Another official section says October 15" }],
        note: null,
      }],
    }], FAST_ANALYSIS_FIELD_IDS, [context]);
    expect(facts.application_deadline.status).toBe("conflicting");
    expect(facts.application_deadline.value).toBeNull();
    expect(facts.application_deadline.conflictingValues).toHaveLength(2);
  });

  it("prioritizes explicit student-decision facts without requiring filler", () => {
    const system = buildFastAnalysisInstructions();
    expect(system).toContain("final application deadline");
    expect(system).toContain("participation dates and duration");
    expect(system).toContain("Do not omit an explicit high-priority statement");
  });

  it("bounds compact source passages and preserves late practical and terms passages", () => {
    const long = `${"intro filler\n".repeat(8_000)}\nTuition is $500 and applications close October 1.\nParticipants retain project ownership under the IP terms.`;
    const context = source(long);
    const fast = buildFastSourcePayload([context]);
    const extended = buildExtendedDetailSourcePayload([context]);
    expect(fast.reduce((sum, page) => sum + page.text.length, 0)).toBeLessThanOrEqual(FAST_MODEL_INPUT_CHARACTERS);
    expect(fast[0].text).toContain("Tuition is $500");
    expect(extended[0].text).toContain("project ownership");
  });

  it("treats the compact result as complete without assessing every stable field", async () => {
    const context = source([
      "North Star Research Program",
      "Operated by North Star Learning",
      "Students in grades 9–12 may apply",
      "Applications close October 1, 2026",
      "The program is online",
      "Tuition is $500",
      "Applications are reviewed and finalists interview",
    ].join("\n"));
    const result = await normalResult(context);
    const compactFacts = compactCandidateFacts([], FAST_ANALYSIS_FIELD_IDS);
    expect(result.quality.outcome).not.toBe("insufficient_quality");
    expect(compactFacts.project_ownership.status).toBe("not_found");
    // Research coverage, not this schema-required placeholder, determines that
    // project ownership was never assessed by normal Analyze.
    expect(FAST_ANALYSIS_FIELD_IDS).not.toContain("project_ownership");
    expect(compactFacts.project_ownership.note).toMatch(/not assessed by normal analysis/i);
    expect(compactFacts.application_deadline.note).toBeNull();
  });

  it("retains a directly supported normal-analysis duration without requiring a cohort ledger", async () => {
    const context = source([
      "North Star Research Program",
      "Fall 2026 application",
      "The program lasts 6 weeks.",
      "Applications close October 1, 2026.",
      "The program is online.",
    ].join("\n"));
    const extraction = normalExtraction(context);
    extraction.facts.duration = factSchema.parse({
      status: "disclosed",
      value: "6 weeks",
      displayValue: "6 weeks",
      normalizedValue: { kind: "duration", amount: 6, unit: "weeks" },
      claimKind: "source_stated",
      sources: [evidence(context, "The program lasts 6 weeks.")],
    });
    const result = await analyzeSourceContexts([context], [], {
      extractor: async () => extraction,
      qualityMode: "normal",
    });
    expect(result.card.variants.status).toBe("unassessed");
    expect(result.card.facts.duration.status).toBe("disclosed");
    expect(result.card.facts.duration.displayValue).toBe("6 weeks");
  });

  it("retains a flat deadline whose year is supplied by one unambiguous target cycle", async () => {
    const context = source([
      "North Star Research Program",
      "Fall 2026 application",
      "Applications close October 1.",
      "The program is online.",
    ].join("\n"));
    const extraction = normalExtraction(context);
    extraction.facts.application_deadline = factSchema.parse({
      status: "disclosed",
      value: "October 1, 2026",
      displayValue: "October 1, 2026",
      normalizedValue: { kind: "date", isoDate: "2026-10-01" },
      claimKind: "source_stated",
      sources: [
        evidence(context, "Fall 2026 application"),
        evidence(context, "Applications close October 1."),
      ],
    });
    const result = await analyzeSourceContexts([context], [], {
      extractor: async () => extraction,
      qualityMode: "normal",
    });
    expect(result.card.cycle.status).toBe("modeled");
    expect(result.card.facts.application_deadline.status).toBe("disclosed");
    expect(result.card.facts.application_deadline.displayValue).toBe("October 1, 2026");
    expect(result.card.facts.application_deadline.sources.map((source) => source.excerpt)).toEqual([
      "Applications close October 1.",
    ]);
  });

  it("requires selection context before warning about missing selectivity numbers", () => {
    const selective = createEmptyCard({ slug: "selective", summary: "Draft", reviewState: "automated_draft" });
    selective.facts.selection_process = factSchema.parse({
      status: "disclosed",
      value: "Applications are reviewed and finalists interview.",
      displayValue: "Applications are reviewed and finalists interview.",
      claimKind: "source_stated",
      sources: [{ id: "s", url: "https://program.example", title: "Program", pageType: "user_supplied", accessedAt: ACCESSED_AT, excerpt: "Applications are reviewed and finalists interview." }],
    });
    expect(deriveDeterministicAttention(selective).map((item) => item.id)).toContain("selectivity-not-quantified");

    const open = createEmptyCard({ slug: "open", summary: "Draft", reviewState: "automated_draft" });
    open.facts.selection_process = factSchema.parse({
      status: "disclosed",
      value: "Enrollment is open while spaces remain.",
      displayValue: "Enrollment is open while spaces remain.",
      claimKind: "source_stated",
      sources: [{ id: "s", url: "https://program.example", title: "Program", pageType: "user_supplied", accessedAt: ACCESSED_AT, excerpt: "Enrollment is open while spaces remain." }],
    });
    expect(deriveDeterministicAttention(open).map((item) => item.id)).not.toContain("selectivity-not-quantified");
  });

  it("flags an unknown total when tuition is supported but the rest of the mandatory cost inventory is not", () => {
    const card = createEmptyCard({ slug: "paid", summary: "Draft", reviewState: "automated_draft" });
    card.facts.tuition = factSchema.parse({
      status: "disclosed",
      value: 500,
      displayValue: "$500",
      normalizedValue: { kind: "money", amount: 500, currency: "USD", classification: "fee" },
      claimKind: "source_stated",
      sources: [{ id: "s", url: "https://program.example", title: "Program", pageType: "user_supplied", accessedAt: ACCESSED_AT, excerpt: "Tuition is $500." }],
    });
    expect(deriveDeterministicAttention(card).map((item) => item.id)).toContain("mandatory-cost-incomplete");
  });

  it("only creates a refund warning after the compact path assessed a paid program", () => {
    expect(FAST_ANALYSIS_FIELD_IDS).toContain("refund_policy");
    const paid = createEmptyCard({ slug: "paid", summary: "Draft", reviewState: "automated_draft" });
    paid.facts.tuition = factSchema.parse({ status: "disclosed", value: "$500", displayValue: "$500", claimKind: "source_stated", sources: [{ id: "s", url: "https://program.example", title: "Program", pageType: "user_supplied", accessedAt: ACCESSED_AT, excerpt: "Tuition is $500" }] });
    expect(deriveDeterministicAttention(paid).map((item) => item.id)).toContain("refund-unresolved");
    paid.facts.refund_policy = factSchema.parse({ status: "disclosed", value: "Refunds through May 1", displayValue: "Refunds through May 1", claimKind: "source_stated", sources: [{ id: "s", url: "https://program.example", title: "Program", pageType: "user_supplied", accessedAt: ACCESSED_AT, excerpt: "Refunds are available through May 1" }] });
    expect(deriveDeterministicAttention(paid).map((item) => item.id)).not.toContain("refund-unresolved");
  });

  it("uses a normal-specific gate rather than requiring rich structures", async () => {
    const context = source("North Star Research Program\nOperated by North Star Learning\nStudents in grades 9–12 may apply\nApplications close October 1, 2026\nThe program is online\nTuition is $500\nApplications are reviewed and finalists interview");
    const result = await normalResult(context);
    const quality = assessFastAnalysisQuality({
      card: result.card,
      acquiredPages: 1,
      pageWarnings: [],
      evidenceWarnings: result.evidenceWarnings,
      attentionItems: result.attentionItems,
      validationStats: result.validationStats,
    });
    expect(quality.signals.completedFamilies).toBe(1);
    expect(quality.outcome).not.toBe("insufficient_quality");
  });

  it("enriches the same result without replacing a supported normal fact", async () => {
    const context = source("North Star Research Program\nOperated by North Star Learning\nStudents in grades 9–12 may apply\nApplications close October 1, 2026\nThe program is online\nTuition is $500\nApplications are reviewed and finalists interview\nParticipants retain ownership of their projects.");
    const normal = await normalResult(context);
    const store = new InMemoryResearchSessionStore();
    const sessionId = store.create({ sources: [context], pageWarnings: [], normalResult: normal })!;
    const extractor: ExtendedModelExtractor = async (_sources, baseline) => {
      const facts = structuredClone(baseline.facts);
      facts.opportunity_name = disclosed(context, "North Star Research Program", "Wrong regenerated name");
      facts.project_ownership = disclosed(context, "Participants retain ownership of their projects", "Participants retain ownership");
      return {
        extraction: { facts, structures: createEmptyModelStructures(), attentionCandidates: [] },
        completedSections: ["details"],
        failedSections: ["financial"],
      };
    };
    const result = await runExtendedResearch(sessionId, { store, extractor });
    expect(result.card.slug).toBe(normal.card.slug);
    expect(result.card.summary).toBe(normal.card.summary);
    expect(result.card.facts.opportunity_name.displayValue).toBe(normal.card.facts.opportunity_name.displayValue);
    expect(result.card.facts.project_ownership.status).toBe("disclosed");
    expect(result.research.completedSections).toEqual(["details"]);
    expect(result.research.failedSections).toEqual(["financial"]);
  });

  it("deduplicates concurrent and repeated Extended Research calls", async () => {
    const context = source("North Star Research Program\nOperated by North Star Learning\nStudents in grades 9–12 may apply\nApplications close October 1, 2026\nThe program is online\nTuition is $500\nApplications are reviewed and finalists interview");
    const normal = await normalResult(context);
    const store = new InMemoryResearchSessionStore();
    const sessionId = store.create({ sources: [context], pageWarnings: [], normalResult: normal })!;
    let resolve!: () => void;
    const pending = new Promise<void>((done) => { resolve = done; });
    const extractor = vi.fn<ExtendedModelExtractor>(async (_sources, baseline) => {
      await pending;
      return { extraction: { facts: baseline.facts, structures: createEmptyModelStructures(), attentionCandidates: [] }, completedSections: ["details", "financial"], failedSections: [] };
    });
    const first = runExtendedResearch(sessionId, { store, extractor });
    const second = runExtendedResearch(sessionId, { store, extractor });
    resolve();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    await expect(runExtendedResearch(sessionId, { store, extractor })).resolves.toMatchObject({ research: { reused: true } });
    expect(extractor).toHaveBeenCalledOnce();
  });

  it("leaves the normal result intact when Extended Research fails", async () => {
    const context = source("North Star Research Program\nOperated by North Star Learning\nStudents in grades 9–12 may apply\nApplications close October 1, 2026\nThe program is online\nTuition is $500\nApplications are reviewed and finalists interview");
    const normal = await normalResult(context);
    const store = new InMemoryResearchSessionStore();
    const sessionId = store.create({ sources: [context], pageWarnings: [], normalResult: normal })!;
    await expect(runExtendedResearch(sessionId, {
      store,
      extractor: async () => { throw new Error("provider failed"); },
    })).rejects.toThrow("provider failed");
    expect(store.get(sessionId)?.normalResult.card).toEqual(normal.card);
    expect(store.get(sessionId)?.extendedResult).toBeNull();
  });

  it("drops resolved normal caveats while retaining unrelated unchanged attention", async () => {
    const context = source("North Star Research Program\nOperated by North Star Learning\nStudents in grades 9–12 may apply\nApplications close October 1, 2026\nThe program is online\nTuition is $500\nApplications are reviewed and finalists interview\nRefunds are available through May 1\n100 applicants and 20 accepted students");
    const normal = await normalResult(context);
    const normalWithAttention: AnalysisPipelineResult = {
      ...normal,
      attentionItems: [
        ...deriveDeterministicAttention(normal.card),
        {
          id: "eligibility-check",
          category: "eligibility",
          priority: "high",
          title: "Eligibility needs checking",
          explanation: "Verify the supported grade requirement.",
          fieldIds: ["grade_levels"],
          claimIds: [], sourceIds: [context.page.id], suggestedNextStep: null, origin: "model_grounded",
        },
      ],
    };
    const card: OpportunityCard = structuredClone(normal.card);
    card.facts.refund_policy = disclosed(context, "Refunds are available through May 1", "Refunds through May 1");
    card.facts.applicant_count = disclosed(context, "100 applicants", "100 applicants");
    card.facts.acceptance_count = disclosed(context, "20 accepted students", "20 accepted students");
    const extended: AnalysisPipelineResult = {
      ...normal,
      card,
      attentionItems: deriveDeterministicAttention(card),
    };
    const ids = mergeExtendedAttention(normalWithAttention, extended).map((item) => item.id);
    expect(ids).not.toContain("refund-unresolved");
    expect(ids).not.toContain("selectivity-not-quantified");
    expect(ids).toContain("eligibility-check");
  });
});

describe("Extended Research session security", () => {
  const minimalResult = {
    card: createEmptyCard({ slug: "draft", summary: "Draft", reviewState: "automated_draft" }),
    reviewedPages: [], pageWarnings: [], evidenceWarnings: [], attentionItems: [],
    quality: { version: "student-research-v2-fast", outcome: "insufficient_quality", reasons: [], signals: {} as never, cacheEligible: false },
    validationStats: { attemptedSupportedClaims: 0, retainedSupportedClaims: 0, withheldSupportedClaims: 0 },
    sourceFingerprint: null, familyFailures: [],
  } satisfies AnalysisPipelineResult;

  it("uses opaque bounded versioned sessions and rejects browser-supplied cards", () => {
    let now = 1_000;
    let counter = 0;
    const ids = Array.from({ length: RESEARCH_SESSION_MAX_ENTRIES + 2 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
    const store = new InMemoryResearchSessionStore(() => now, () => ids[counter++]);
    const context = source("public source text");
    const first = store.create({ sources: [context], pageWarnings: [], normalResult: minimalResult })!;
    expect(first).toMatch(/^[0-9a-f-]{36}$/u);
    expect(first).not.toContain("public");
    expect(extendedResearchRequestSchema.safeParse({ sessionId: first, card: minimalResult.card }).success).toBe(false);
    for (let index = 1; index <= RESEARCH_SESSION_MAX_ENTRIES; index += 1) {
      store.create({ sources: [context], pageWarnings: [], normalResult: minimalResult });
    }
    expect(store.get(first)).toBeNull();
    const latest = ids[RESEARCH_SESSION_MAX_ENTRIES];
    now += RESEARCH_SESSION_TTL_MS + 1;
    expect(store.get(latest)).toBeNull();
  });

  it("refuses an oversized in-memory source handoff", () => {
    const store = new InMemoryResearchSessionStore();
    const large = source("x".repeat(RESEARCH_SESSION_MAX_SOURCE_CHARACTERS + 1));
    expect(store.create({ sources: [large], pageWarnings: [], normalResult: minimalResult })).toBeNull();
  });

  it("invalidates analyzer-version-incompatible handoffs", () => {
    const store = new InMemoryResearchSessionStore();
    const id = store.create({ sources: [source("public source")], pageWarnings: [], normalResult: minimalResult })!;
    const held = store.get(id)!;
    Object.assign(held, { analyzerVersion: "older-analyzer" });
    expect(store.get(id)).toBeNull();
  });
});
