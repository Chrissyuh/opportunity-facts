import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createResponse = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: createResponse };
  },
}));

import {
  buildModelStageTextFormats,
  createEmptyModelStructures,
  createOpenAIFastExtractor,
  createOpenAIExtractor,
  extractOpportunityCard,
  ModelExtractionError,
  type AnalysisSourceContext,
} from "@/lib/analysis/model-extraction";
import { analyzePastedSources } from "@/lib/analysis/pipeline";
import { createEmptyFacts, factSchema, type EvidenceSource } from "@/lib/opportunity";

const previousKey = process.env.OPENAI_API_KEY;
const previousModel = process.env.OPENAI_MODEL;

function source(): AnalysisSourceContext {
  return {
    accessedAt: "2026-08-12T12:00:00.000Z",
    page: {
      id: "page-program",
      url: "https://program.example/current-cycle",
      title: "Current Program",
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text: "Current Program applications and official details.",
      blocks: [{ kind: "heading", headingLevel: 1, text: "Current Program" }],
      links: [],
      truncated: false,
    },
  };
}

function response(
  output: unknown,
  id: string,
  status: "completed" | "failed" | "in_progress" | "cancelled" | "queued" | "incomplete" = "completed",
) {
  return {
    id,
    status,
    output_text: typeof output === "string" ? output : JSON.stringify(output),
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    },
  };
}

function stageOutput(name: string) {
  const structures = createEmptyModelStructures();
  if (name === "opportunity_facts_summary") return { facts: createEmptyFacts() };
  if (name === "opportunity_facts_foundation") {
    return {
      cycle: structures.cycle,
      organizations: structures.organizations,
      organizationRoles: structures.organizationRoles,
      institutionRelationships: structures.institutionRelationships,
      variants: structures.variants,
    };
  }
  if (name === "opportunity_facts_process") return {
    stages: structures.stages,
    pathways: structures.pathways,
  };
  if (name === "opportunity_facts_financial") return {
    costItems: structures.costItems,
    outcomes: structures.outcomes,
  };
  throw new Error(`Unexpected structured response name: ${name}`);
}

function disclosedClaim(value: unknown, displayValue: string, claimId: string) {
  return {
    claimId,
    status: "disclosed",
    value,
    displayValue,
    claimKind: "source_stated",
    sources: [{
      id: "page-program",
      url: "https://program.example/current-cycle",
      title: "Current Program",
      pageType: "user_supplied",
      accessedAt: "2026-08-12T12:00:00.000Z",
      excerpt: displayValue,
    }],
    note: null,
    conflictingValues: [],
  };
}

function costRecord(id: string, minimum: number, maximum: number | null) {
  const amount = maximum === null
    ? { kind: "exact", amount: minimum, currency: "USD" }
    : { kind: "range", minimum, maximum, currency: "USD" };
  return {
    id,
    definition: disclosedClaim(
      { label: "Tuition", kind: "tuition", requirement: "required", scope: { variantIds: [], stageIds: [], pathwayIds: [] } },
      "Tuition",
      `${id}-definition`,
    ),
    amount: disclosedClaim(amount, "$1,000", `${id}-amount`),
    chargeBasis: null,
    treatment: null,
    refundability: null,
    includedItems: [],
    excludedItems: [],
    conditions: [],
  };
}

function stageRecord(id: string, invalidDuration = false) {
  return {
    id,
    order: id === "apply" ? 1 : 2,
    definition: disclosedClaim(
      { label: id === "apply" ? "Apply" : "Review", kind: "application", scope: { variantIds: [], stageIds: [], pathwayIds: [] } },
      id === "apply" ? "Apply" : "Review",
      `${id}-definition`,
    ),
    timings: [],
    durations: invalidDuration
      ? [disclosedClaim(
          { duration: { minimum: 10, maximum: 2, unit: "weeks" }, scope: { variantIds: [], stageIds: [], pathwayIds: [] } },
          "2 to 10 weeks",
          `${id}-duration`,
        )]
      : [],
    timeCommitments: [],
    formats: [],
    locations: [],
    selectionRules: [],
    advancement: [],
    requirements: [],
    travelRequirements: [],
  };
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-server-key";
  process.env.OPENAI_MODEL = "gpt-5.6-terra";
  createResponse.mockReset();
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  if (previousModel === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = previousModel;
});

describe("bounded model-family reliability", () => {
  it("uses one low-verbosity bounded request for normal Analyze", async () => {
    createResponse.mockResolvedValue(response({ facts: [], attentionCandidates: [] }, "normal-response"));
    await createOpenAIFastExtractor()([source()]);
    expect(createResponse).toHaveBeenCalledOnce();
    expect(createResponse.mock.calls[0]?.[0]).toMatchObject({
      store: false,
      max_output_tokens: 4_800,
      reasoning: { effort: "low" },
      text: { verbosity: "low", format: { name: "opportunity_facts_normal" } },
    });
  });

  it("retains provider usage telemetry when normal output is incomplete", async () => {
    createResponse.mockResolvedValue(response("", "normal-incomplete", "incomplete"));
    const telemetry = vi.fn();
    await expect(createOpenAIFastExtractor()([source()], { onTelemetry: telemetry }))
      .rejects.toThrow(/complete structured result/i);
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      stage: "normal_model",
      outcome: "failed",
      usage: expect.objectContaining({ inputTokens: 100, outputTokens: 50 }),
    }));
  });

  it("uses four bounded strict contracts", () => {
    const formats = buildModelStageTextFormats();
    expect(Object.keys(formats)).toEqual([
      "facts",
      "foundation",
      "process",
      "financial",
    ]);
    for (const format of Object.values(formats)) {
      expect(format.strict).toBe(true);
      expect(JSON.stringify(format.schema)).not.toContain('"not"');
    }
  });

  it("salvages independent families when one structured response is truncated", async () => {
    createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
      const name = request.text.format.name;
      if (name === "opportunity_facts_foundation") {
        return response('{"cycle":', "resp-foundation-truncated");
      }
      return response(stageOutput(name), `resp-${name}`);
    });

    const raw = await createOpenAIExtractor()([source()]);
    expect(createResponse).toHaveBeenCalledTimes(4);
    expect(raw.familyFailures).toEqual([
      expect.objectContaining({ family: "foundation", message: expect.stringMatching(/incomplete|invalid/i) }),
    ]);
    expect(raw.facts).toBeDefined();
    expect(raw.structures?.stages.status).toBe("unassessed");

    const card = await extractOpportunityCard([source()], async () => raw);
    expect(card.card.reviewState).toBe("automated_draft");
    expect(card.evidenceWarnings).toEqual([
      expect.objectContaining({ fieldId: "model.foundation", message: expect.stringMatching(/retained/i) }),
    ]);
  });

  it("does not retry a timed-out family and retains other completed families", async () => {
    createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
      const name = request.text.format.name;
      if (name === "opportunity_facts_financial") throw new Error("request timed out");
      return response(stageOutput(name), `resp-${name}`);
    });
    const raw = await createOpenAIExtractor()([source()]);
    expect(createResponse).toHaveBeenCalledTimes(4);
    expect(raw.familyFailures?.map((failure) => failure.family)).toEqual(["financial"]);
  });

  it("withholds one invalid cost record without discarding valid financial siblings", async () => {
    createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
      const name = request.text.format.name;
      if (name === "opportunity_facts_financial") {
        return response({
          costItems: {
            status: "modeled",
            records: [costRecord("valid-tuition", 1_000, null), costRecord("invalid-range", 1_000, 100)],
            note: null,
            completeness: "complete",
          },
          outcomes: createEmptyModelStructures().outcomes,
        }, "resp-financial-partial");
      }
      return response(stageOutput(name), `resp-${name}`);
    });

    const raw = await createOpenAIExtractor()([source()]);
    expect(raw.familyFailures).toEqual([]);
    expect(raw.familyWarnings).toEqual([
      expect.objectContaining({ family: "financial", message: expect.stringMatching(/1 invalid costItems record.*1 independently valid/u) }),
    ]);
    expect(raw.structures?.costItems).toMatchObject({
      status: "modeled",
      completeness: "incomplete",
      records: [expect.objectContaining({ id: "valid-tuition" })],
    });
  });

  it("withholds one invalid stage record without discarding a valid process record", async () => {
    createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
      const name = request.text.format.name;
      if (name === "opportunity_facts_process") {
        return response({
          stages: {
            status: "modeled",
            records: [stageRecord("apply"), stageRecord("review", true)],
            note: null,
          },
          pathways: createEmptyModelStructures().pathways,
        }, "resp-process-partial");
      }
      return response(stageOutput(name), `resp-${name}`);
    });

    const raw = await createOpenAIExtractor()([source()]);
    expect(raw.familyFailures).toEqual([]);
    expect(raw.familyWarnings).toEqual([
      expect.objectContaining({ family: "process", message: expect.stringMatching(/1 invalid stages record/u) }),
    ]);
    expect(raw.structures?.stages).toMatchObject({
      status: "modeled",
      records: [expect.objectContaining({ id: "apply" })],
    });
  });

  it("still rejects a family with missing or extra top-level contract keys", async () => {
    createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
      const name = request.text.format.name;
      if (name === "opportunity_facts_financial") {
        return response({
          ...stageOutput(name),
          unexpected: true,
        }, "resp-financial-extra-key");
      }
      return response(stageOutput(name), `resp-${name}`);
    });

    const raw = await createOpenAIExtractor()([source()]);
    expect(raw.familyFailures).toEqual([
      expect.objectContaining({ family: "financial", message: expect.stringMatching(/outside its contract/i) }),
    ]);
    expect(raw.structures?.costItems.status).toBe("unassessed");
  });

  it("records telemetry independently for every completed family", async () => {
    const telemetry = vi.fn();
    createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
      const name = request.text.format.name;
      return response(stageOutput(name), `resp-${name}`);
    });

    await createOpenAIExtractor({ onResponse: telemetry })([source()]);

    expect(telemetry).toHaveBeenCalledTimes(4);
    expect(new Set(
      telemetry.mock.calls.map(([entry]) => entry.family),
    )).toEqual(new Set(["facts", "foundation", "process", "financial"]));
    for (const [entry] of telemetry.mock.calls) {
      expect(entry).toMatchObject({
        model: "gpt-5.6-terra",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      });
    }
  });

  it("runs process and financial families with the completed foundation context", async () => {
    const inputs = new Map<string, unknown>();
    createResponse.mockImplementation(async (request: {
      input: Array<{ role: string; content: string }>;
      text: { format: { name: string } };
    }) => {
      const name = request.text.format.name;
      inputs.set(name, request.input);
      return response(stageOutput(name), `resp-${name}`);
    });

    await createOpenAIExtractor()([source()]);

    for (const name of ["opportunity_facts_process", "opportunity_facts_financial"]) {
      expect(JSON.stringify(inputs.get(name))).toMatch(/FOUNDATION CONTEXT/);
    }
  });

  it("starts no second-wave provider calls when the request is aborted between waves", async () => {
    const controller = new AbortController();
    createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
      const name = request.text.format.name;
      if (name === "opportunity_facts_foundation") {
        controller.abort(new DOMException("Request cancelled", "AbortError"));
      }
      return response(stageOutput(name), `resp-${name}`);
    });

    await expect(
      createOpenAIExtractor()([source()], { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(createResponse).toHaveBeenCalledTimes(2);
    expect(new Set(
      createResponse.mock.calls.map(([request]) => request.text.format.name),
    )).toEqual(new Set(["opportunity_facts_summary", "opportunity_facts_foundation"]));
  });

  it.each(["failed", "in_progress", "cancelled", "queued", "incomplete"] as const)(
    "rejects schema-valid output when the provider status is %s",
    async (status) => {
      createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
        const name = request.text.format.name;
        return response(
          stageOutput(name),
          `resp-${name}-${status}`,
          name === "opportunity_facts_foundation" ? status : "completed",
        );
      });

      const raw = await createOpenAIExtractor()([source()]);
      expect(raw.familyFailures).toEqual([
        expect.objectContaining({
          family: "foundation",
          message: expect.stringMatching(/completed state|completion limit/i),
        }),
      ]);
      expect(raw.facts).toBeDefined();
    },
  );

  it("never converts a failed summary family into false not-found claims", async () => {
    createResponse.mockImplementation(async (request: { text: { format: { name: string } } }) => {
      const name = request.text.format.name;
      if (name === "opportunity_facts_summary") {
        return response('{"facts":', "resp-summary-truncated");
      }
      return response(stageOutput(name), `resp-${name}`);
    });

    const raw = await createOpenAIExtractor()([source()]);
    expect(raw.familyFailures?.map((failure) => failure.family)).toContain("facts");
    expect(Object.values(raw.facts).every((fact) => fact.status === "unclear")).toBe(true);
    expect(raw.facts.opportunity_name.note).toMatch(/did not complete/i);
  });

  it("fails clearly when every family is incomplete", async () => {
    createResponse.mockResolvedValue(response("", "resp-empty"));
    await expect(createOpenAIExtractor()([source()])).rejects.toThrow(
      new ModelExtractionError(
        "The provider did not complete any extraction section, so no partial draft was displayed. Try again later or start from another official page.",
      ),
    );
    expect(createResponse).toHaveBeenCalledTimes(4);
  });
});

describe("critical semantic failures through the production pipeline", () => {
  it("withholds platform/legal eligibility and historical target-cycle counts", async () => {
    const result = await analyzePastedSources(
      [
        {
          title: "Innovation Program 2026",
          url: "https://program.example/2026",
          pageType: "user_supplied",
          text: "Innovation Program\n2026 competition cycle applications are open.\nInnovation Program is a six-week curriculum.\n2,550 finalists were selected in 2025.",
        },
        {
          title: "Platform Terms",
          url: "https://program.example/terms",
          pageType: "user_supplied",
          text: "Users must be at least 13 to create an account. Minor users must use the Services under supervision of a parent or guardian. Our Services may be unavailable in some jurisdictions and are governed by California law.",
        },
      ],
      {
        extractor: async (sources) => {
          const evidence = (sourceIndex: number, excerpt: string): EvidenceSource => ({
            id: sources[sourceIndex].page.id,
            url: sources[sourceIndex].page.url,
            title: sources[sourceIndex].page.title,
            pageType: sources[sourceIndex].page.pageType,
            accessedAt: sources[sourceIndex].accessedAt,
            excerpt,
          });
          const facts = createEmptyFacts();
          facts.operating_organization = factSchema.parse({
            status: "disclosed",
            value: "Innovation Program",
            displayValue: "Innovation Program",
            claimKind: "source_stated",
            sources: [evidence(0, "Innovation Program is a six-week curriculum.")],
          });
          facts.ages = factSchema.parse({
            status: "disclosed",
            value: "At least 13",
            displayValue: "At least 13",
            claimKind: "source_stated",
            sources: [evidence(1, "Users must be at least 13 to create an account.")],
          });
          facts.sponsor_requirement = factSchema.parse({
            status: "disclosed",
            value: "Parent or guardian supervision",
            displayValue: "Parent or guardian supervision",
            claimKind: "source_stated",
            sources: [evidence(1, "Minor users must use the Services under supervision of a parent or guardian.")],
          });
          facts.geographic_restrictions = factSchema.parse({
            status: "disclosed",
            value: "Unavailable in some jurisdictions",
            displayValue: "Unavailable in some jurisdictions",
            claimKind: "source_stated",
            sources: [evidence(1, "Our Services may be unavailable in some jurisdictions and are governed by California law.")],
          });
          facts.acceptance_count = factSchema.parse({
            status: "disclosed",
            value: 2550,
            displayValue: "2,550 finalists",
            normalizedValue: { kind: "number", value: 2550, unit: "people" },
            claimKind: "source_stated",
            sources: [evidence(0, "2,550 finalists were selected in 2025.")],
          });
          return { facts, structures: createEmptyModelStructures() };
        },
      },
    );

    expect(result.card.cycle.status).toBe("modeled");
    expect(result.card.cycle.status === "modeled" && result.card.cycle.value.label.value).toBe("2026");
    expect(result.card.facts.ages.status).toBe("unclear");
    expect(result.card.facts.operating_organization.status).toBe("unclear");
    expect(result.card.facts.operating_organization.note).toMatch(/does not explicitly support the primary operator/i);
    expect(result.card.facts.sponsor_requirement.status).toBe("unclear");
    expect(result.card.facts.geographic_restrictions.status).toBe("unclear");
    expect(result.card.facts.acceptance_count.status).toBe("unclear");
    expect(result.card.facts.acceptance_count.note).toMatch(/outside the resolved 2026 target cycle/i);
  });
});
