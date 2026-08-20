import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createEmptyModelStructures, type ModelExtractor } from "@/lib/analysis/model-extraction";
import { analyzePastedSources } from "@/lib/analysis/pipeline";
import { createEmptyCard } from "@/lib/opportunity/schema";

describe("analysis observers", () => {
  it("do not alter the canonical card produced from identical model output", async () => {
    const facts = createEmptyCard({ slug: "observer-test" }).facts;
    facts.opportunity_name = {
      status: "disclosed",
      value: "Observer Test Program",
      displayValue: "Observer Test Program",
      normalizedValue: { kind: "text", value: "Observer Test Program" },
      sources: [{
        id: "page-fa08a4f1feaae50a",
        url: "https://program.example/",
        title: "Program",
        pageType: "user_supplied",
        accessedAt: "2026-08-20T00:00:00.000Z",
        excerpt: "Observer Test Program",
      }],
      conflictingValues: [],
      note: null,
      confidence: null,
      claimKind: "source_stated",
      calculation: null,
      projection: null,
    };
    const extractor: ModelExtractor = async () => ({
      facts,
      structures: createEmptyModelStructures(),
      attentionCandidates: [],
    });
    const input = [{
      title: "Program",
      url: "https://program.example/",
      pageType: "user_supplied" as const,
      text: "Observer Test Program",
    }];
    const options = { extractor, now: () => new Date("2026-08-20T00:00:00.000Z") };
    const plain = await analyzePastedSources(input, options);
    const observed = await analyzePastedSources(input, {
      ...options,
      onProgress: vi.fn(),
      onTelemetry: vi.fn(),
    });
    expect(observed.card).toEqual(plain.card);
  });
});
