import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildFastModelTextFormat,
  buildFastSourcePayload,
  compactCandidateFacts,
  createEmptyFastCoreChecks,
  createEmptyModelStructures,
  extractOpportunityCard,
  fastModelExtractionSchema,
  FAST_ANALYSIS_FIELD_IDS,
  FAST_CORE_AREA_FIELD_IDS,
  FAST_CORE_AREA_IDS,
  FAST_MODEL_INPUT_CHARACTERS,
  flattenFastCandidates,
  type AnalysisSourceContext,
  type ModelExtraction,
} from "@/lib/analysis/model-extraction";
import { analyzeSourceContexts } from "@/lib/analysis/pipeline";

const ACCESSED_AT = "2026-08-21T12:00:00.000Z";

function source(id: string, lines: readonly string[]): AnalysisSourceContext {
  return {
    accessedAt: ACCESSED_AT,
    page: {
      id,
      url: `https://program.example/${id}`,
      title: `${id} official page`,
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text: lines.join("\n"),
      blocks: lines.map((text) => ({ kind: "paragraph" as const, text })),
      links: [],
      truncated: false,
    },
  };
}

function disclosed(fieldId: Parameters<typeof compactCandidateFacts>[0][number]["fieldId"], excerpt: string, value: string) {
  return {
    fieldId,
    status: "disclosed" as const,
    value,
    displayValue: value,
    normalizedValue: null,
    claimKind: "source_stated" as const,
    sources: [{ sourceId: "program", excerpt }],
    note: null,
  };
}

describe("compact core recall", () => {
  it("keeps late tuition and eligibility blocks instead of prefix-slicing them away", () => {
    const competingFiller = Array.from({ length: 2_200 }, (_, index) =>
      `Program application mentor cohort selection overview ${index}: ${"x".repeat(72)}`,
    );
    const context = source("long", [
      "North Star Fellowship",
      ...competingFiller,
      "Eligible students are high-school juniors and seniors in grades 11–12.",
      "Program tuition is $4,500 USD per participant.",
    ]);

    const payload = buildFastSourcePayload([context]);
    expect(context.page.text.length).toBeGreaterThan(FAST_MODEL_INPUT_CHARACTERS);
    expect(payload[0].text.length).toBeLessThanOrEqual(FAST_MODEL_INPUT_CHARACTERS);
    expect(payload[0].text).toContain("Eligible students are high-school juniors and seniors");
    expect(payload[0].text).toContain("Program tuition is $4,500 USD per participant");
  });

  it("preserves representative core topics when several long pages compete for one budget", () => {
    const contexts = Array.from({ length: 7 }, (_, sourceIndex) => {
      const filler = Array.from({ length: 420 }, (_, index) =>
        `Program application selection schedule and mentor detail ${sourceIndex}-${index}: ${"z".repeat(60)}`,
      );
      const tail = sourceIndex === 5
        ? "Tuition is $3,250; this statement is a charge, not a complete mandatory-cost total."
        : sourceIndex === 6
          ? "Students currently enrolled in grades 9 through 12 may apply."
          : `Applications close October ${sourceIndex + 1}, 2026.`;
      return source(`page-${sourceIndex}`, [`Official page ${sourceIndex}`, ...filler, tail]);
    });

    const payload = buildFastSourcePayload(contexts);
    expect(payload.reduce((sum, page) => sum + page.text.length, 0))
      .toBeLessThanOrEqual(FAST_MODEL_INPUT_CHARACTERS);
    expect(payload[5].text).toContain("Tuition is $3,250");
    expect(payload[6].text).toContain("grades 9 through 12 may apply");
  });

  it("requires every named core area through a fixed strict object", () => {
    const assignedFields = Object.values(FAST_CORE_AREA_FIELD_IDS).flat();
    expect(new Set(assignedFields)).toEqual(new Set(FAST_ANALYSIS_FIELD_IDS));
    expect(assignedFields).toHaveLength(FAST_ANALYSIS_FIELD_IDS.length);
    const coreChecks = createEmptyFastCoreChecks();
    expect(fastModelExtractionSchema.safeParse({
      coreChecks,
      attentionCandidates: [],
    }).success).toBe(true);
    const missingEligibility = structuredClone(coreChecks) as Record<string, unknown>;
    delete missingEligibility.eligibility;
    expect(fastModelExtractionSchema.safeParse({
      coreChecks: missingEligibility,
      attentionCandidates: [],
    }).success).toBe(false);

    const providerSchema = JSON.stringify(buildFastModelTextFormat().schema);
    for (const area of FAST_CORE_AREA_IDS) expect(providerSchema).toContain(`\"${area}\"`);
  });

  it("salvages valid candidates when provider area metadata is inconsistent", () => {
    const coreChecks = createEmptyFastCoreChecks();
    coreChecks.eligibility = {
      status: "not_found",
      facts: [disclosed("tuition", "Tuition is $4,500.", "$4,500")],
    };
    const parsed = fastModelExtractionSchema.parse({ coreChecks, attentionCandidates: [] });
    const flattened = flattenFastCandidates(parsed);

    expect(flattened.some((candidate) => candidate.fieldId === "tuition")).toBe(true);
    expect(compactCandidateFacts(flattened, FAST_ANALYSIS_FIELD_IDS, [
      source("program", ["Tuition is $4,500."]),
    ]).tuition.status).toBe("disclosed");
  });

  it("recovers explicit tuition and eligibility while withholding tempting operator and relationship claims", async () => {
    const context = source("program", [
      "North Star Fellowship is a six-week online student program.",
      "High school and college students may apply from anywhere in the world.",
      "Program tuition is $4,500 USD per participant.",
      "Meet mentor Alan Chen — Duke University alumnus.",
    ]);
    const coreChecks = createEmptyFastCoreChecks();
    coreChecks.eligibility = {
      status: "supported",
      facts: [disclosed("grade_levels", "High school and college students may apply", "High school and college students")],
    };
    coreChecks.cost = {
      status: "supported",
      facts: [disclosed("tuition", "Program tuition is $4,500 USD per participant.", "$4,500 USD")],
    };
    coreChecks.operator = {
      status: "supported",
      facts: [disclosed("operating_organization", "North Star Fellowship is a six-week online student program.", "North Star Fellowship")],
    };
    coreChecks.institution_relationship = {
      status: "supported",
      facts: [disclosed("institution_relationship", "Meet mentor Alan Chen — Duke University alumnus.", "Duke University partner")],
    };
    const parsed = fastModelExtractionSchema.parse({
      coreChecks,
      attentionCandidates: [],
    });
    const extraction: ModelExtraction = {
      facts: compactCandidateFacts(flattenFastCandidates(parsed), FAST_ANALYSIS_FIELD_IDS, [context]),
      structures: createEmptyModelStructures(),
      attentionCandidates: [],
      fastCoreChecks: parsed.coreChecks,
    };
    const result = await extractOpportunityCard([context], async () => extraction, {
      analysisDepth: "normal",
    });

    expect(result.card.facts.grade_levels.status).toBe("disclosed");
    expect(result.card.facts.tuition.status).toBe("disclosed");
    expect(result.card.facts.estimated_total_mandatory_cost.status).toBe("not_found");
    expect(result.card.facts.operating_organization.status).not.toBe("disclosed");
    expect(result.card.facts.institution_relationship.status).not.toBe("disclosed");
    expect(result.coreAreaAssessments.find(({ area }) => area === "eligibility")?.status).toBe("retained");
    expect(result.coreAreaAssessments.find(({ area }) => area === "cost")?.status).toBe("retained");
    expect(result.coreAreaAssessments.find(({ area }) => area === "operator")?.status).toBe("withheld");
    expect(result.coreAreaAssessments.find(({ area }) => area === "institution_relationship")?.status).toBe("withheld");
  });

  it("carries a withheld core candidate through the pipeline into the compact quality gate", async () => {
    const context = source("program", [
      "North Star Fellowship",
      "Fall 2026 application",
      "Operated by North Star Learning.",
      "Students in grades 9 through 12 may apply.",
      "Applications close October 1, 2026.",
      "The six-week program is online.",
      "Financial aid is available.",
      "Applications are reviewed before finalist interviews.",
      "Participants receive one-to-one mentorship.",
      "Tuition is $500.",
    ]);
    const coreChecks = createEmptyFastCoreChecks();
    coreChecks.identity = {
      status: "supported",
      facts: [disclosed("opportunity_name", "North Star Fellowship", "North Star Fellowship")],
    };
    coreChecks.eligibility = {
      status: "supported",
      facts: [disclosed("grade_levels", "Students in grades 9 through 12 may apply.", "Grades 9-12")],
    };
    coreChecks.deadline = {
      status: "supported",
      facts: [disclosed("application_deadline", "Applications close October 1, 2026.", "October 1, 2026")],
    };
    coreChecks.schedule = {
      status: "supported",
      facts: [disclosed("duration", "The six-week program is online.", "Six weeks")],
    };
    coreChecks.format_location = {
      status: "supported",
      facts: [disclosed("participation_format", "The six-week program is online.", "Online")],
    };
    coreChecks.cost = {
      status: "supported",
      facts: [{
        ...disclosed("tuition", "Tuition is $500.", "$500"),
        sources: [{ sourceId: "unknown-source", excerpt: "Tuition is $500." }],
      }],
    };
    coreChecks.financial_aid = {
      status: "supported",
      facts: [disclosed("financial_aid", "Financial aid is available.", "Available")],
    };
    coreChecks.operator = {
      status: "supported",
      facts: [disclosed("operating_organization", "Operated by North Star Learning.", "North Star Learning")],
    };
    coreChecks.selection = {
      status: "supported",
      facts: [disclosed("selection_process", "Applications are reviewed before finalist interviews.", "Application review and finalist interview")],
    };
    coreChecks.outcomes = {
      status: "supported",
      facts: [disclosed("mentorship", "Participants receive one-to-one mentorship.", "One-to-one mentorship")],
    };
    const parsed = fastModelExtractionSchema.parse({
      coreChecks,
      attentionCandidates: [],
    });
    const extraction: ModelExtraction = {
      facts: compactCandidateFacts(flattenFastCandidates(parsed), FAST_ANALYSIS_FIELD_IDS, [context]),
      structures: createEmptyModelStructures(),
      attentionCandidates: [],
      fastCoreChecks: parsed.coreChecks,
    };

    const result = await analyzeSourceContexts([context], [], {
      extractor: async () => extraction,
      qualityMode: "normal",
    });

    expect(result.coreAreaAssessments.find(({ area }) => area === "cost")?.status).toBe("withheld");
    expect(result.quality.outcome).toBe("usable_with_caveats");
    expect(result.quality.reasons.map((reason) => reason.code)).toContain("CORE_CLAIMS_WITHHELD");
    expect(result.quality.signals.withheldCoreAreas).toBe(1);
  });
});
