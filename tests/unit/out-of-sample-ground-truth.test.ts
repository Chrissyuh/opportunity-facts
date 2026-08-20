import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { opportunityCardSchema, type OpportunityCard } from "../../lib/opportunity/schema-v2";

async function card(slug: string): Promise<OpportunityCard> {
  return opportunityCardSchema.parse(JSON.parse(await readFile(
    path.join(process.cwd(), "data", "opportunities", `${slug}.json`),
    "utf8",
  )) as unknown);
}

describe("preregistered out-of-sample human ground truth", () => {
  it("keeps Congressional App Challenge recognition out of cash outcomes", async () => {
    const value = await card("congressional-app-challenge-2026");
    expect(value.outcomes.status).toBe("modeled");
    if (value.outcomes.status !== "modeled") return;
    expect(value.outcomes.records.map((outcome) => outcome.definition.value.outcomeType)).toEqual([
      "other_in_kind",
      "other_in_kind",
    ]);
    expect(value.facts.cash_award.status).toBe("not_found");
  });

  it("stores Coca-Cola's award as restricted scholarship funding", async () => {
    const value = await card("coca-cola-scholars-program-2027");
    expect(value.outcomes.status).toBe("modeled");
    if (value.outcomes.status !== "modeled") return;
    const scholarship = value.outcomes.records[0];
    expect(scholarship.definition.value.outcomeType).toBe("scholarship");
    expect(
      scholarship.amount?.status === "disclosed" && scholarship.amount.value.kind === "exact"
        ? scholarship.amount.value.amount
        : null,
    ).toBe(20_000);
    expect(scholarship.monetaryNature?.status === "disclosed" && scholarship.monetaryNature.value).toBe("restricted_funding");
  });

  it("does not carry prior-cycle Yale tuition into 2027", async () => {
    const value = await card("yale-young-global-scholars-summer-2027");
    expect(value.variants.status).toBe("modeled");
    expect(value.variants.status === "modeled" && value.variants.records).toHaveLength(3);
    expect(value.costItems.status).toBe("none_found");
    expect(value.facts.tuition.status).toBe("not_found");
  });

  it("keeps Polygence independent and its unresolved price unclear", async () => {
    const value = await card("polygence-core-program-fall-2026");
    expect(value.institutionRelationships.status).toBe("modeled");
    if (value.institutionRelationships.status !== "modeled" || value.costItems.status !== "modeled") return;
    expect(value.institutionRelationships.records[0].assertion.status === "disclosed" && value.institutionRelationships.records[0].assertion.value.relationshipType).toBe("independent");
    expect(value.costItems.records[0].amount.status).toBe("unclear");
    expect(value.cycle.status === "modeled" && value.cycle.value.label.value).toBe("Rolling admissions");
    expect(value.cycle.status === "modeled" && value.cycle.value.year).toBeNull();
    expect(value.cycle.status === "modeled" && value.cycle.value.season).toBeNull();
  });

  it("keeps MITES free covered costs separate from unknown travel", async () => {
    const value = await card("mites-summer-2027");
    expect(value.costItems.status).toBe("modeled");
    if (value.costItems.status !== "modeled") return;
    expect(value.costItems.completeness).toBe("incomplete");
    const travel = value.costItems.records.find((item) => item.definition.value.kind === "travel");
    expect(travel?.amount.status).toBe("not_found");
    expect(value.costItems.records.filter((item) =>
      item.amount.status === "disclosed" &&
      item.amount.value.kind === "exact" &&
      item.amount.value.amount === 0,
    )).toHaveLength(3);
  });

  it("preserves Breakthrough's three recipients and monetary natures", async () => {
    const value = await card("breakthrough-junior-challenge-2026");
    expect(value.outcomes.status).toBe("modeled");
    if (value.outcomes.status !== "modeled") return;
    expect(value.outcomes.records.map((outcome) => outcome.definition.value.outcomeType)).toEqual([
      "scholarship",
      "educator_cash_prize",
      "equipment",
    ]);
    expect(value.outcomes.records.map((outcome) => outcome.recipientScope.status === "disclosed" ? outcome.recipientScope.value : null)).toEqual([
      "individual",
      "educator",
      "school",
    ]);
    expect(value.outcomes.records.map((outcome) => outcome.monetaryNature?.status === "disclosed" ? outcome.monetaryNature.value : null)).toEqual([
      "restricted_funding",
      "cash",
      "source_stated_estimated_value",
    ]);
    expect(value.facts.cash_award.status).toBe("not_found");
    expect(value.facts.in_kind_value.status).toBe("not_found");

    const wrongRecipient = structuredClone(value);
    if (wrongRecipient.outcomes.status === "modeled") {
      const educatorPrize = wrongRecipient.outcomes.records.find((outcome) =>
        outcome.definition.value.outcomeType === "educator_cash_prize"
      );
      if (educatorPrize?.recipientScope.status === "disclosed") {
        educatorPrize.recipientScope.value = "individual";
        educatorPrize.recipientScope.displayValue = "Individual";
      }
    }
    expect(opportunityCardSchema.safeParse(wrongRecipient).success).toBe(false);
  });

  it("keeps QuestBridge partner funding and admission pathways distinct", async () => {
    const value = await card("questbridge-national-college-match-2026");
    expect(value.institutionRelationships.status).toBe("modeled");
    expect(value.pathways.status).toBe("modeled");
    expect(value.pathways.status === "modeled" && value.pathways.records).toHaveLength(2);
    if (value.institutionRelationships.status !== "modeled" || value.outcomes.status !== "modeled") return;
    expect(value.institutionRelationships.records[0].assertion.status === "disclosed" && value.institutionRelationships.records[0].assertion.value.relationshipType).toBe("institution_partnered");
    const scholarship = value.outcomes.records.find((outcome) => outcome.definition.value.outcomeType === "scholarship");
    expect(scholarship?.monetaryNature?.status === "disclosed" && scholarship.monetaryNature.value).toBe("restricted_funding");
    expect(scholarship?.amount).toBeNull();
  });
});
