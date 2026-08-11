import { describe, expect, it } from "vitest";

import {
  calculateAcceptanceRate,
  createCalculatedAcceptanceRateFact,
  createEmptyFact,
  factSchema,
  normalizeCurrency,
  normalizeDate,
  normalizeDuration,
  normalizeParticipantCount,
  normalizeParticipationFormat,
  normalizeRelationship,
  normalizeWeeklyHours,
} from "../../lib/opportunity";

const evidence = {
  id: "selection",
  url: "https://selection.example/counts",
  title: "Selection",
  pageType: "official_rules" as const,
  accessedAt: "2026-08-10T12:00:00Z",
  excerpt: "There were 240 applicants and 48 offers.",
};

function countFact(value: number) {
  return factSchema.parse({
    status: "disclosed",
    value,
    displayValue: `${value}`,
    normalizedValue: { kind: "number", value, unit: "people" },
    sources: [evidence],
    claimKind: "source_stated",
  });
}

describe("deterministic normalization", () => {
  it("normalizes valid dates and rejects rollover dates", () => {
    expect(normalizeDate("2027-02-12")).toEqual({ kind: "date", isoDate: "2027-02-12" });
    expect(normalizeDate("February 12, 2027")).toEqual({ kind: "date", isoDate: "2027-02-12" });
    expect(normalizeDate("2027-02-30")).toBeNull();
    expect(normalizeDate("February 30, 2027")).toBeNull();
    expect(normalizeDate("02/12/27")).toBeNull();
  });

  it("normalizes currency while keeping cash and in-kind classifications distinct", () => {
    expect(normalizeCurrency("$2,500", "cash")).toEqual({
      kind: "money",
      amount: 2500,
      currency: "USD",
      classification: "cash",
    });
    expect(normalizeCurrency("$2,500", "in_kind")).toMatchObject({
      classification: "in_kind",
    });
    expect(normalizeCurrency("a valuable prize", "cash")).toBeNull();
  });

  it("normalizes duration, hours, counts, formats, and enumerated relationships", () => {
    expect(normalizeDuration("4 weeks")).toMatchObject({ amount: 4, unit: "weeks" });
    expect(normalizeWeeklyHours("6–8 hours per week")).toMatchObject({
      minimum: 6,
      maximum: 8,
      period: "week",
    });
    expect(normalizeParticipantCount("1,200")).toMatchObject({ value: 1200 });
    expect(normalizeRelationship("hosted-at-institution")).toMatchObject({
      value: "hosted_at_institution",
    });
    expect(normalizeRelationship("connected to a famous university")).toBeNull();
    expect(normalizeParticipationFormat("in-person")).toMatchObject({ value: "in_person" });
  });
});

describe("acceptance-rate calculation", () => {
  it("calculates only from valid published counts", () => {
    expect(calculateAcceptanceRate(240, 48)).toBe(20);
    expect(calculateAcceptanceRate(3, 1)).toBe(33.33);
    expect(calculateAcceptanceRate(0, 0)).toBeNull();
    expect(calculateAcceptanceRate(10, 11)).toBeNull();
  });

  it("preserves cited inputs and visibly labels the calculation", () => {
    const fact = createCalculatedAcceptanceRateFact(countFact(240), countFact(48));
    expect(fact.status).toBe("disclosed");
    expect(fact.displayValue).toBe("20%");
    expect(fact.claimKind).toBe("calculated");
    expect(fact.calculation).toEqual({
      formula: "acceptance_count / applicant_count × 100",
      inputs: [
        { fieldId: "applicant_count", value: 240 },
        { fieldId: "acceptance_count", value: 48 },
      ],
      explanation: "Calculated from published counts.",
    });
    expect(fact.sources).toHaveLength(1);
  });

  it("reports absent counts as not found instead of implying ambiguity", () => {
    const fact = createCalculatedAcceptanceRateFact(createEmptyFact(), createEmptyFact());
    expect(fact.status).toBe("not_found");
    expect(fact.sources).toEqual([]);
  });
});
