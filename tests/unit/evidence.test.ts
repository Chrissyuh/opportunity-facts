import { describe, expect, it } from "vitest";

import {
  excerptMatchesSource,
  factSchema,
  validateFactEvidence,
} from "../../lib/opportunity";

const source = {
  id: "cost",
  url: "https://evidence.example/cost",
  title: "Cost",
  pageType: "official_cost_page" as const,
  accessedAt: "2026-08-10T12:00:00Z",
  excerpt: "The program costs $450 — lodging is included.",
};

describe("evidence excerpt validation", () => {
  it("matches with deterministic whitespace and punctuation normalization", () => {
    expect(
      excerptMatchesSource(
        "The program costs $450 — lodging is included.",
        "\n The program costs $450 - lodging   is included. \n",
      ),
    ).toBe(true);
  });

  it("downgrades an unsupported disclosed value instead of displaying it", () => {
    const fact = factSchema.parse({
      status: "disclosed",
      value: 450,
      displayValue: "$450",
      sources: [source],
      claimKind: "source_stated",
    });
    const result = validateFactEvidence(fact, {
      cost: "The source only discusses the schedule.",
    });
    expect(result.fact.status).toBe("unclear");
    expect(result.fact.value).toBeNull();
    expect(result.fact.displayValue).toBeNull();
    expect(result.fact.sources).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it("keeps only supported citations when at least one still matches", () => {
    const fact = factSchema.parse({
      status: "disclosed",
      value: 450,
      displayValue: "$450",
      sources: [source, { ...source, id: "bad", excerpt: "Invented sentence." }],
      claimKind: "source_stated",
    });
    const result = validateFactEvidence(fact, {
      cost: "The program costs $450 - lodging is included.",
      bad: "No fee statement here.",
    });
    expect(result.fact.status).toBe("disclosed");
    expect(result.fact.sources.map((item) => item.id)).toEqual(["cost"]);
    expect(result.errors).toHaveLength(1);
  });

  it("does not collapse a damaged conflict into the one surviving value", () => {
    const conflict = factSchema.parse({
      status: "conflicting",
      conflictingValues: [
        { value: "$450", displayValue: "$450", sources: [source] },
        {
          value: "$500",
          displayValue: "$500",
          sources: [{ ...source, id: "faq", excerpt: "The fee is $500." }],
        },
      ],
    });
    const result = validateFactEvidence(conflict, {
      cost: "The program costs $450 - lodging is included.",
      faq: "No price appears here.",
    });
    expect(result.fact.status).toBe("unclear");
    expect(result.fact.value).toBeNull();
  });

  it("removes unmatched excerpts attached to an unclear fact", () => {
    const fact = factSchema.parse({
      status: "unclear",
      note: "The wording is ambiguous.",
      sources: [source],
    });
    const result = validateFactEvidence(fact, { cost: "Unrelated source text." });
    expect(result.fact.status).toBe("unclear");
    expect(result.fact.sources).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it("treats prototype-named unknown source IDs as unsupported data", () => {
    const fact = factSchema.parse({
      status: "disclosed",
      value: "$450",
      displayValue: "$450",
      sources: [{ ...source, id: "constructor", url: "https://unknown.example/cost" }],
      claimKind: "source_stated",
    });

    expect(() => validateFactEvidence(fact, {})).not.toThrow();
    expect(validateFactEvidence(fact, {}).fact.status).toBe("unclear");
  });
});
