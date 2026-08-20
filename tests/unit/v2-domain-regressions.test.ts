import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  FIELD_IDS,
  applyOpportunityProjections,
  createEmptyCard,
  migrateV1ToV2,
  opportunityCardSchema,
  v1OpportunityCardSchema,
  type CostItemRecord,
  type EvidenceSource,
  type OutcomeRecord,
  type OpportunityCard,
  type SourcePage,
} from "../../lib/opportunity";

const V1_CHECKPOINT = "db78d1c";
const ACCESSED_AT = "2026-08-12T00:00:00.000Z";

const page: SourcePage = {
  id: "domain-source",
  url: "https://domain-regression.example/program",
  title: "Domain regression source",
  pageType: "official_program_page",
  accessedAt: ACCESSED_AT,
};

const evidence: EvidenceSource = {
  ...page,
  excerpt: "The official page states this amount and condition.",
};

function assertion<T>(claimId: string, value: T, displayValue: string) {
  return {
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources: [evidence],
    note: null,
    conflictingValues: [],
  };
}

function notFound(claimId: string, note: string) {
  return {
    claimId,
    status: "not_found" as const,
    value: null,
    displayValue: null,
    claimKind: null,
    sources: [],
    note,
    conflictingValues: [],
  };
}

const scope = {
  variantIds: [] as string[],
  stageIds: [] as string[],
  pathwayIds: [] as string[],
};

function costItem(
  id: string,
  kind: "application_fee" | "deposit" | "tuition" | "travel",
  requirement: "required" | "optional" | "conditional",
  amount: number,
  refundability: CostItemRecord["refundability"] = null,
): CostItemRecord {
  return {
    id,
    definition: assertion(
      `${id}-definition`,
      { label: id.replaceAll("-", " "), kind, requirement, scope },
      id.replaceAll("-", " "),
    ),
    amount: assertion(
      `${id}-amount`,
      { kind: "exact", amount, currency: "USD" },
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(amount),
    ),
    chargeBasis: null,
    treatment: null,
    refundability,
    includedItems: [],
    excludedItems: [],
    conditions: [],
  };
}

function cardWithCosts(slug: string, records: CostItemRecord[]): OpportunityCard {
  const card = createEmptyCard({ slug });
  card.sourcePagesChecked = [page];
  card.costItems = {
    status: "modeled",
    completeness: "complete",
    records,
    note: null,
  };
  return opportunityCardSchema.parse(applyOpportunityProjections(card));
}

it("labels a scholarship-conditioned price as conditional rather than cohort variation", () => {
  const card = cardWithCosts("conditional-tuition", [
    costItem("scholarship-adjusted-tuition", "tuition", "conditional", 1000),
  ]);
  expect(card.facts.tuition.status).toBe("disclosed");
  expect(card.facts.tuition.displayValue).toBe("Conditional — see cost details");
});

function outcome(
  id: string,
  outcomeType: "personal_cash_prize" | "tuition_waiver" | "equipment",
  recipientScope: "individual" | "team",
  monetaryNature: "cash" | "not_monetized" | "source_stated_estimated_value",
  amount: number,
): OutcomeRecord {
  return {
    id,
    definition: assertion(
      `${id}-definition`,
      { label: id.replaceAll("-", " "), outcomeType, scope },
      id.replaceAll("-", " "),
    ),
    recipientScope: assertion(`${id}-recipient`, recipientScope, recipientScope),
    monetaryNature: assertion(`${id}-nature`, monetaryNature, monetaryNature.replaceAll("_", " ")),
    amount: assertion(
      `${id}-amount`,
      { kind: "exact", amount, currency: "USD" },
      `$${amount.toLocaleString("en-US")}`,
    ),
    distribution: null,
    rank: null,
    track: null,
    quantity: null,
    useRestriction: null,
    combinability: null,
    conditions: [],
  };
}

function cardWithOutcomes(slug: string, records: OutcomeRecord[]): OpportunityCard {
  const card = createEmptyCard({ slug });
  card.sourcePagesChecked = [page];
  card.outcomes = { status: "modeled", records, note: null };
  return opportunityCardSchema.parse(applyOpportunityProjections(card));
}

const V1_CARD_PATHS = [
  "data/demo/cipher-finch-student-challenge.json",
  "data/demo/ember-atlas-mapping-micro-internship.json",
  "data/demo/lantern-bay-robotics-field-lab.json",
  "data/demo/orchard-sky-research-week.json",
  "data/demo/paper-crane-student-design-award.json",
  "data/demo/redwood-comet-summer-studio.json",
  "data/demo/tideglass-civic-data-fellowship.json",
  "data/opportunities/diamond-challenge-2027.json",
  "data/opportunities/lumiere-research-scholar-program-fall-2026.json",
  "data/opportunities/nasa-techrise-student-challenge-2026-2027.json",
] as const;

describe("V2 cost projections", () => {
  it("labels distinct universal application-plan fees as a matrix rather than cohort variation", () => {
    const early = costItem("early-action-fee", "application_fee", "required", 85);
    const regular = costItem("regular-decision-fee", "application_fee", "required", 100);
    const card = cardWithCosts("application-plan-fees", [early, regular]);

    expect(card.facts.application_fee.status).toBe("disclosed");
    expect(card.facts.application_fee.displayValue).toBe(
      "Multiple application fees — see cost details",
    );
    expect(card.facts.application_fee.note).toMatch(/early action fee.*\$85/i);
    expect(card.facts.application_fee.note).toMatch(/regular decision fee.*\$100/i);
  });

  it("calculates an exact total from complete compatible required costs", () => {
    const card = cardWithCosts("exact-cost-total", [
      costItem("application-fee", "application_fee", "required", 50),
      costItem("program-tuition", "tuition", "required", 1_000),
    ]);

    expect(card.facts.estimated_total_mandatory_cost.status).toBe("disclosed");
    expect(card.facts.estimated_total_mandatory_cost.value).toBe(1_050);
    expect(card.facts.estimated_total_mandatory_cost.normalizedValue).toEqual({
      kind: "money",
      amount: 1_050,
      currency: "USD",
      classification: "fee",
    });
    expect(card.facts.estimated_total_mandatory_cost.claimKind).toBe("calculated");
    expect(card.facts.estimated_total_mandatory_cost.calculation?.inputs).toHaveLength(2);
  });

  it("reports a conditional total without inventing one scalar when the amount is known", () => {
    const card = cardWithCosts("conditional-known-cost", [
      costItem("finalist-travel", "travel", "conditional", 500),
    ]);

    expect(card.facts.estimated_total_mandatory_cost.status).toBe("disclosed");
    expect(card.facts.estimated_total_mandatory_cost.displayValue).toMatch(/^Conditional/);
    expect(card.facts.estimated_total_mandatory_cost.normalizedValue).toBeNull();
    expect(card.facts.estimated_total_mandatory_cost.note).toMatch(/conditional/i);
  });

  it("preserves an explicitly disclosed zero cost", () => {
    const card = cardWithCosts("zero-cost", [
      costItem("zero-tuition", "tuition", "required", 0),
    ]);

    expect(card.facts.tuition.status).toBe("disclosed");
    expect(card.facts.tuition.value).toBe(0);
    expect(card.facts.estimated_total_mandatory_cost.status).toBe("disclosed");
    expect(card.facts.estimated_total_mandatory_cost.value).toBe(0);
    expect(card.facts.estimated_total_mandatory_cost.displayValue).toBe("$0");
  });

  it("projects a complete compatible mandatory-cost range", () => {
    const ranged = costItem("ranged-tuition", "tuition", "required", 1_000);
    ranged.amount = assertion(
      "ranged-tuition-amount",
      { kind: "range", minimum: 1_000, maximum: 1_500, currency: "USD" },
      "$1,000–$1,500",
    );
    const card = cardWithCosts("ranged-cost-total", [ranged]);

    expect(card.facts.tuition.displayValue).toBe("$1,000–$1,500");
    expect(card.facts.estimated_total_mandatory_cost.status).toBe("disclosed");
    expect(card.facts.estimated_total_mandatory_cost.displayValue).toBe("$1,000–$1,500");
    expect(card.facts.estimated_total_mandatory_cost.normalizedValue).toBeNull();
    expect(card.facts.estimated_total_mandatory_cost.claimKind).toBe("calculated");
    expect(card.facts.estimated_total_mandatory_cost.calculation).not.toBeNull();
    expect(card.facts.estimated_total_mandatory_cost.projection?.rule).toBe("costs.total-range");
  });

  it("keeps known and unknown refundability distinct at the cost-item level", () => {
    const knownRefund = assertion(
      "known-refundability",
      { kind: "conditional" as const, condition: "Refundable before the published deadline." },
      "Refundable before the deadline",
    );
    const card = cardWithCosts("refund-knowledge", [
      costItem("optional-application-fee", "application_fee", "optional", 25, knownRefund),
      costItem(
        "optional-deposit",
        "deposit",
        "optional",
        100,
        notFound("unknown-refundability", "No refund term was found."),
      ),
    ]);
    if (card.costItems.status !== "modeled") throw new Error("Fixture setup failed.");

    expect(card.costItems.records[0].refundability?.status).toBe("disclosed");
    expect(card.costItems.records[0].refundability?.status === "disclosed"
      ? card.costItems.records[0].refundability.value.kind
      : null).toBe("conditional");
    expect(card.costItems.records[1].refundability?.status).toBe("not_found");
  });

  it("preserves structured cost conflicts in both the cost fact and core total", () => {
    const conflicted = costItem("conflicting-tuition", "tuition", "required", 1_000);
    conflicted.amount = {
      claimId: "conflicting-tuition-amount",
      status: "conflicting",
      value: null,
      displayValue: null,
      claimKind: null,
      sources: [],
      note: "Two reviewed official passages publish different tuition amounts.",
      conflictingValues: [
        {
          value: { kind: "exact", amount: 1_000, currency: "USD" },
          displayValue: "$1,000",
          claimKind: "source_stated",
          sources: [evidence],
          note: "First published amount.",
        },
        {
          value: { kind: "exact", amount: 1_200, currency: "USD" },
          displayValue: "$1,200",
          claimKind: "source_stated",
          sources: [{ ...evidence, excerpt: "A second official passage states $1,200." }],
          note: "Second published amount.",
        },
      ],
    };

    const card = cardWithCosts("conflicting-cost", [conflicted]);
    expect(card.facts.tuition.status).toBe("conflicting");
    expect(card.facts.tuition.conflictingValues.map((candidate) => candidate.displayValue))
      .toEqual(["$1,000", "$1,200"]);
    expect(card.facts.estimated_total_mandatory_cost.status).toBe("conflicting");
    expect(card.facts.estimated_total_mandatory_cost.projection?.rule).toBe(
      "costs.total-conflicting",
    );
  });
});

describe("V2 outcome projections", () => {
  it("projects personal cash only as participant cash", () => {
    const card = cardWithOutcomes("personal-cash", [
      outcome("individual-cash-prize", "personal_cash_prize", "individual", "cash", 1_000),
    ]);

    expect(card.facts.cash_award.status).toBe("disclosed");
    expect(card.facts.cash_award.normalizedValue).toEqual({
      kind: "money",
      amount: 1_000,
      currency: "USD",
      classification: "cash",
    });
    expect(card.facts.other_benefits.status).toBe("not_found");
  });

  it("preserves a team cash range and recipient scope in the summary", () => {
    const ranged = outcome("team-prize-range", "personal_cash_prize", "individual", "cash", 1_000);
    ranged.definition = assertion(
      "team-prize-range-definition",
      { label: "Team prize", outcomeType: "team_cash_prize", scope },
      "Team prize",
    );
    ranged.recipientScope = assertion("team-prize-range-recipient", "team", "Team");
    ranged.amount = assertion(
      "team-prize-range-amount",
      { kind: "range", minimum: 1_000, maximum: 1_500, currency: "USD" },
      "$1,000–$1,500",
    );
    const card = cardWithOutcomes("team-prize-range", [ranged]);

    expect(card.facts.cash_award.status).toBe("disclosed");
    expect(card.facts.cash_award.displayValue).toBe("Team prize — $1,000–$1,500/team");
    expect(card.facts.cash_award.normalizedValue).toBeNull();
  });

  it("projects a tuition waiver with non-cash financial classification", () => {
    const card = cardWithOutcomes("tuition-waiver", [
      outcome("tuition-waiver-benefit", "tuition_waiver", "individual", "not_monetized", 2_500),
    ]);

    expect(card.facts.tuition_waiver.status).toBe("disclosed");
    expect(card.facts.tuition_waiver.normalizedValue).toEqual({
      kind: "money",
      amount: 2_500,
      currency: "USD",
      classification: "tuition_waiver",
    });
    expect(card.facts.cash_award.status).toBe("not_found");
  });

  it("keeps a source-stated equipment value classified as in-kind", () => {
    const card = cardWithOutcomes("in-kind-equipment", [
      outcome("equipment-package", "equipment", "team", "source_stated_estimated_value", 750),
    ]);

    expect(card.facts.in_kind_value.status).toBe("disclosed");
    expect(card.facts.in_kind_value.normalizedValue).toEqual({
      kind: "money",
      amount: 750,
      currency: "USD",
      classification: "in_kind",
    });
    expect(card.facts.cash_award.status).toBe("not_found");
  });
});

describe("all V1 checkpoint cards", () => {
  it.each(V1_CARD_PATHS)("migrates %s deterministically without inventing attestation or structures", (cardPath) => {
    const v1 = v1OpportunityCardSchema.parse(JSON.parse(execFileSync(
      "git",
      ["show", `${V1_CHECKPOINT}:${cardPath}`],
      { cwd: process.cwd(), encoding: "utf8" },
    )) as unknown);
    const first = migrateV1ToV2(v1);
    const second = migrateV1ToV2(v1);

    expect(first).toEqual(second);
    expect(first.facts).toEqual(v1.facts);
    expect(FIELD_IDS.every((fieldId) => first.facts[fieldId].projection === null)).toBe(true);
    expect(first.cardVersion).toBe(v1.cardVersion + 1);
    expect(first.reviewState).toBe("draft");
    expect(first.reviewedAt).toBeNull();
    expect(first.opportunityId).toBeNull();
    expect(first.cycle.status).toBe("unassessed");
    expect([
      first.organizations,
      first.organizationRoles,
      first.institutionRelationships,
      first.variants,
      first.stages,
      first.pathways,
      first.costItems,
      first.outcomes,
    ].every((collection) => collection.status === "unassessed")).toBe(true);
  });
});
