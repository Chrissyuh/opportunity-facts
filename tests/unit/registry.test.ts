import { describe, expect, it } from "vitest";

import {
  CORE_DISCLOSURE_TOTAL,
  CORE_FIELD_IDS,
  FIELD_IDS,
  FIELD_REGISTRY,
  SECTIONS,
  createEmptyCard,
  compareOpportunityCards,
  factSchema,
  formatFact,
  getDisclosureCount,
} from "../../lib/opportunity";

describe("field registry", () => {
  it("defines every required section and exactly 13 unique core facts", () => {
    expect(new Set(FIELD_REGISTRY.map((field) => field.id)).size).toBe(FIELD_IDS.length);
    expect(new Set(FIELD_REGISTRY.map((field) => field.section))).toEqual(new Set(SECTIONS));
    expect(CORE_FIELD_IDS).toHaveLength(13);
    expect(CORE_DISCLOSURE_TOTAL).toBe(13);
    expect(FIELD_REGISTRY.filter((field) => field.core).map((field) => field.id)).toEqual(
      CORE_FIELD_IDS,
    );
  });

  it("provides description, formatter, comparison behavior, and statuses for every field", () => {
    for (const field of FIELD_REGISTRY) {
      expect(field.label.length).toBeGreaterThan(0);
      expect(field.description.length).toBeGreaterThan(0);
      expect(typeof field.format).toBe("function");
      expect(field.comparison.length).toBeGreaterThan(0);
      expect(field.allowedStatuses).toContain("unclear");
    }
  });

  it("counts disclosed core facts as completeness, not a rating", () => {
    const card = createEmptyCard({ slug: "count-test" });
    const evidence = {
      id: "source",
      url: "https://count.example/program",
      title: "Program",
      pageType: "official_program_page" as const,
      accessedAt: "2026-08-10T12:00:00Z",
      excerpt: "The operator is Example Operator.",
    };
    card.facts.operating_organization = factSchema.parse({
      status: "disclosed",
      value: "Example Operator",
      displayValue: "Example Operator",
      sources: [evidence],
      claimKind: "source_stated",
    });
    card.facts.refund_policy = factSchema.parse({
      status: "conflicting",
      conflictingValues: [
        { value: "Refundable", displayValue: "Refundable", sources: [evidence] },
        { value: "Not refundable", displayValue: "Not refundable", sources: [{ ...evidence, id: "faq" }] },
      ],
    });

    expect(getDisclosureCount(card)).toEqual({
      disclosed: 1,
      total: 13,
      label: "1 of 13 core facts disclosed",
    });
  });

  it("formats normalized values and aligns differences through the registry", () => {
    const left = createEmptyCard({ slug: "left" });
    const right = createEmptyCard({ slug: "right" });
    const evidence = {
      id: "cost",
      url: "https://compare.example/cost",
      title: "Cost",
      pageType: "official_cost_page" as const,
      accessedAt: "2026-08-10T12:00:00Z",
      excerpt: "The mandatory charge is $100.",
    };
    left.facts.estimated_total_mandatory_cost = factSchema.parse({
      status: "disclosed",
      value: "$100",
      displayValue: "$100",
      normalizedValue: { kind: "money", amount: 100, currency: "USD", classification: "fee" },
      sources: [evidence],
      claimKind: "source_stated",
    });
    expect(formatFact(left.facts.estimated_total_mandatory_cost)).toBe("$100");

    const rows = compareOpportunityCards([left, right]);
    const costRow = rows.find((row) => row.field.id === "estimated_total_mandatory_cost");
    expect(costRow?.differs).toBe(true);
    expect(costRow?.cells.map((cell) => cell.slug)).toEqual(["left", "right"]);
    expect(() => compareOpportunityCards([left])).toThrow(/two or three/i);
  });
});
