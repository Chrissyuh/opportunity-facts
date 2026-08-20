import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  FIELD_IDS,
  createCalculatedAcceptanceRateFact,
  createEmptyCard,
  factSchema,
  opportunityCardSchema,
  opportunityFactsSchema,
  reviewStateSchema,
  sourcePageSchema,
} from "../../lib/opportunity";

const source = {
  id: "program",
  url: "https://demo.example/program",
  title: "Program",
  pageType: "official_program_page" as const,
  accessedAt: "2026-08-10T12:00:00Z",
  excerpt: "The program fee is $100.",
};
const sourcePage = {
  id: source.id,
  url: source.url,
  title: source.title,
  pageType: source.pageType,
  accessedAt: source.accessedAt,
};

describe("opportunity card schema", () => {
  it("creates a strict complete map for every registered field", () => {
    const card = createEmptyCard({ slug: "new-card" });
    expect(Object.keys(card.facts)).toEqual(FIELD_IDS);
    expect(opportunityCardSchema.parse(card)).toEqual(card);
  });

  it("rejects a card with a missing registered fact", () => {
    const card = createEmptyCard({ slug: "new-card" });
    const incompleteFacts: Partial<typeof card.facts> = { ...card.facts };
    delete incompleteFacts.material_terms;
    expect(() => opportunityCardSchema.parse({ ...card, facts: incompleteFacts })).toThrow();
  });

  it("rejects unknown top-level and fact fields", () => {
    const card = createEmptyCard({ slug: "strict-card" });
    expect(() => opportunityCardSchema.parse({ ...card, trustScore: 99 })).toThrow();
    expect(() =>
      opportunityCardSchema.parse({
        ...card,
        facts: { ...card.facts, legitimacy: { status: "disclosed" } },
      }),
    ).toThrow();
  });

  it("requires evidence and a claim kind for every disclosed value", () => {
    expect(() =>
      factSchema.parse({ status: "disclosed", value: 100, displayValue: "$100" }),
    ).toThrow(/evidence source/i);
    expect(() =>
      factSchema.parse({
        status: "disclosed",
        value: 100,
        displayValue: "$100",
        sources: [source],
      }),
    ).toThrow(/claim kind/i);
  });

  it("requires an affirmative reason when a fact does not apply", () => {
    expect(() => factSchema.parse({ status: "not_applicable" })).toThrow(
      /affirmative reason/i,
    );
    expect(
      factSchema.parse({
        status: "not_applicable",
        note: "This opportunity has no application process.",
      }),
    ).toMatchObject({
      status: "not_applicable",
      note: "This opportunity has no application process.",
    });
  });

  it("preserves two sourced values for a conflict and rejects a selected winner", () => {
    const conflict = factSchema.parse({
      status: "conflicting",
      note: "Two reviewed pages disagree.",
      conflictingValues: [
        { value: "$100", displayValue: "$100", sources: [source] },
        {
          value: "$150",
          displayValue: "$150",
          sources: [{ ...source, id: "faq", url: "https://demo.example/faq" }],
        },
      ],
    });
    expect(conflict.conflictingValues).toHaveLength(2);
    expect(() => factSchema.parse({ ...conflict, value: "$100" })).toThrow(/silently select/i);
  });

  it("supports only the four documented review states", () => {
    expect(reviewStateSchema.options).toEqual([
      "demo",
      "draft",
      "human_reviewed",
      "organizer_confirmed",
    ]);
    expect(reviewStateSchema.safeParse("verified").success).toBe(false);
  });

  it("rejects a demo card when any conflicting official URL leaves .example", () => {
    const card = createEmptyCard({ slug: "demo-url-isolation", reviewState: "demo" });
    const officialUrl = factSchema.parse({
      status: "conflicting",
      note: "Two displayed URLs disagree.",
      conflictingValues: [
        {
          value: "https://program.example/official",
          displayValue: "https://program.example/official",
          normalizedValue: { kind: "text", value: "https://program.example/official" },
          sources: [{ ...source, excerpt: "Official page one." }],
        },
        {
          value: "https://example.com/real-organization",
          displayValue: "https://example.com/real-organization",
          normalizedValue: { kind: "text", value: "https://example.com/real-organization" },
          sources: [{ ...source, excerpt: "Official page two." }],
        },
      ],
    });

    expect(() => opportunityCardSchema.parse({
      ...card,
      sourcePagesChecked: [sourcePage],
      conflicts: [{ fieldId: "official_url", summary: "Two displayed URLs disagree." }],
      facts: { ...card.facts, official_url: officialUrl },
    })).toThrow(/reserved \.example hostnames/i);
  });

  it("requires checked sources before a card can claim human or organizer review", () => {
    const blank = createEmptyCard({ slug: "blank-reviewed" });
    expect(() =>
      opportunityCardSchema.parse({
        ...blank,
        reviewState: "human_reviewed",
        reviewedAt: "2026-08-11T12:00:00Z",
      }),
    ).toThrow(/checked source page/i);
  });

  it("enforces field-specific money classifications", () => {
    const card = createEmptyCard({ slug: "money-classification" });
    const badCashAward = factSchema.parse({
      status: "disclosed",
      value: 100,
      displayValue: "$100",
      normalizedValue: {
        kind: "money",
        amount: 100,
        currency: "USD",
        classification: "in_kind",
      },
      sources: [source],
      claimKind: "source_stated",
    });
    expect(() =>
      opportunityCardSchema.parse({
        ...card,
        sourcePagesChecked: [sourcePage],
        facts: { ...card.facts, cash_award: badCashAward },
      }),
    ).toThrow(/classification cash/i);
  });

  it("allows calculations only for the two auditable derived fields", () => {
    const card = createEmptyCard({ slug: "arbitrary-calculation" });
    const calculatedName = factSchema.parse({
      status: "disclosed",
      value: "Best program",
      displayValue: "Best program",
      normalizedValue: { kind: "text", value: "Best program" },
      sources: [source],
      claimKind: "calculated",
      calculation: {
        formula: "invented",
        inputs: [{ fieldId: "applicant_count", value: 1 }],
        explanation: "Unsupported arithmetic.",
      },
    });
    expect(() =>
      opportunityCardSchema.parse({
        ...card,
        sourcePagesChecked: [sourcePage],
        facts: { ...card.facts, opportunity_name: calculatedName },
      }),
    ).toThrow(/cannot be published as a calculated claim/i);
  });

  it("requires correct attribution for published and calculated acceptance rates", () => {
    const card = createEmptyCard({ slug: "rate-attribution" });
    const sourceStatedRate = factSchema.parse({
      status: "disclosed",
      value: "20%",
      displayValue: "20%",
      sources: [{ ...source, excerpt: "The published rate is 20%." }],
      claimKind: "source_stated",
    });

    expect(() => opportunityCardSchema.parse({
      ...card,
      sourcePagesChecked: [sourcePage],
      facts: { ...card.facts, acceptance_rate_claim: sourceStatedRate },
    })).toThrow(/organizer-stated rate/i);
    expect(() => opportunityCardSchema.parse({
      ...card,
      sourcePagesChecked: [sourcePage],
      facts: { ...card.facts, calculated_acceptance_rate: sourceStatedRate },
    })).toThrow(/calculated claim with auditable inputs/i);

    expect(opportunityCardSchema.safeParse({
      ...card,
      sourcePagesChecked: [sourcePage],
      facts: {
        ...card.facts,
        acceptance_rate_claim: { ...sourceStatedRate, claimKind: "organizer_stated" },
      },
    }).success).toBe(true);
  });

  it("rejects displayed calculated output that contradicts verified arithmetic", () => {
    const card = createEmptyCard({ slug: "contradictory-calculation" });
    const applicants = factSchema.parse({
      status: "disclosed",
      value: 200,
      displayValue: "200 applicants",
      normalizedValue: { kind: "number", value: 200, unit: "people" },
      sources: [{ ...source, excerpt: "200 applicants" }],
      claimKind: "source_stated",
    });
    const acceptances = factSchema.parse({
      status: "disclosed",
      value: 40,
      displayValue: "40 acceptances",
      normalizedValue: { kind: "number", value: 40, unit: "people" },
      sources: [{ ...source, excerpt: "40 acceptances" }],
      claimKind: "source_stated",
    });
    const calculated = createCalculatedAcceptanceRateFact(applicants, acceptances);

    expect(() =>
      opportunityCardSchema.parse({
        ...card,
        sourcePagesChecked: [sourcePage],
        facts: {
          ...card.facts,
          applicant_count: applicants,
          acceptance_count: acceptances,
          calculated_acceptance_rate: { ...calculated, value: 99, displayValue: "99%" },
        },
      }),
    ).toThrow(/exactly match/i);
  });

  it("rejects a calculated mandatory total while cost categories remain unassessed", () => {
    const card = createEmptyCard({ slug: "incomplete-cost-total" });
    const applicationFee = factSchema.parse({
      status: "disclosed",
      value: 15,
      displayValue: "$15",
      normalizedValue: { kind: "money", amount: 15, currency: "USD", classification: "fee" },
      sources: [{ ...source, excerpt: "Application fee is $15." }],
      claimKind: "source_stated",
    });
    const total = factSchema.parse({
      status: "disclosed",
      value: 15,
      displayValue: "$15",
      normalizedValue: { kind: "money", amount: 15, currency: "USD", classification: "fee" },
      sources: [{ ...source, excerpt: "Application fee is $15." }],
      claimKind: "calculated",
      calculation: {
        formula: "application_fee",
        inputs: [{ fieldId: "application_fee", value: 15 }],
        explanation: "Only the disclosed application fee was added.",
      },
    });

    expect(() =>
      opportunityCardSchema.parse({
        ...card,
        sourcePagesChecked: [sourcePage],
        facts: {
          ...card.facts,
          application_fee: applicationFee,
          estimated_total_mandatory_cost: total,
        },
      }),
    ).toThrow(/every cost category/i);
  });

  it("rejects a calculated mandatory total that silently omits a disclosed deposit", () => {
    const card = createEmptyCard({ slug: "omitted-deposit" });
    const moneyFact = (field: "fee" | "deposit", amount: number) => factSchema.parse({
      status: "disclosed",
      value: amount,
      displayValue: `$${amount}`,
      normalizedValue: { kind: "money", amount, currency: "USD", classification: field },
      sources: [{ ...source, excerpt: `Published amount is $${amount}.` }],
      claimKind: "source_stated",
    });
    const total = factSchema.parse({
      status: "disclosed",
      value: 100,
      displayValue: "$100",
      normalizedValue: { kind: "money", amount: 100, currency: "USD", classification: "fee" },
      sources: [{ ...source, excerpt: "Published amount is $100." }],
      claimKind: "calculated",
      calculation: {
        formula: "tuition",
        inputs: [{ fieldId: "tuition", value: 100 }],
        explanation: "Calculated from tuition.",
      },
    });

    expect(() => opportunityCardSchema.parse({
      ...card,
      sourcePagesChecked: [sourcePage],
      facts: {
        ...card.facts,
        application_fee: factSchema.parse({ status: "not_applicable", note: "There is no application fee." }),
        deposit: moneyFact("deposit", 25),
        tuition: moneyFact("fee", 100),
        other_mandatory_costs: factSchema.parse({ status: "not_applicable", note: "There are no other mandatory costs." }),
        estimated_total_mandatory_cost: total,
      },
    })).toThrow(/every nonzero disclosed input/i);
  });

  it("rejects credentials and excessive length in stored source URLs", () => {
    const page = {
      id: "program-page",
      title: "Program",
      pageType: "official_program_page" as const,
      accessedAt: "2026-08-10T12:00:00Z",
    };
    expect(
      sourcePageSchema.safeParse({ ...page, url: "https://user:secret@demo.example/program" }).success,
    ).toBe(false);
    expect(
      sourcePageSchema.safeParse({ ...page, url: `https://demo.example/${"a".repeat(2_100)}` }).success,
    ).toBe(false);
    for (const url of [
      "http://localhost/program",
      "http://127.0.0.1/program",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/program",
      "http://[::ffff:7f00:1]/program",
      "http://[::ffff:a00:1]/program",
      "http://metadata.google.internal/computeMetadata/v1",
      "http://router/admin",
      "https://intranet/page",
    ]) {
      expect(sourcePageSchema.safeParse({ ...page, url }).success, url).toBe(false);
    }
    expect(
      sourcePageSchema.safeParse({
        ...page,
        url: "https://program.example/page?X-Amz-Signature=secret",
      }).success,
    ).toBe(false);
    expect(
      sourcePageSchema.safeParse({
        ...page,
        url: "https://program.example/callback#access_token=secret",
      }).success,
    ).toBe(false);
  });

  it("requires facts to reuse one stable inventory record per source URL", () => {
    const card = createEmptyCard({ slug: "duplicate-source-url" });
    expect(() =>
      opportunityCardSchema.parse({
        ...card,
        sourcePagesChecked: [
          sourcePage,
          { ...sourcePage, id: "program-copy" },
        ],
      }),
    ).toThrow(/canonical source URL may appear only once/i);
  });

  it("returns a normal safe-parse failure for malformed nested source URLs", () => {
    const card = createEmptyCard({ slug: "malformed-source-url" });
    const malformed = {
      ...card,
      sourcePagesChecked: [{ ...sourcePage, url: "not-a-url" }],
    };
    expect(() => opportunityCardSchema.safeParse(malformed)).not.toThrow();
    expect(opportunityCardSchema.safeParse(malformed).success).toBe(false);
  });

  it("converts the complete facts map to OpenAI strict structured output", () => {
    expect(() =>
      zodTextFormat(z.strictObject({ facts: opportunityFactsSchema }), "opportunity_facts_test"),
    ).not.toThrow();
  });
});
