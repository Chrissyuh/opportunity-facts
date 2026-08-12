import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  opportunityCardSchema,
  type OpportunityCard,
} from "../../lib/opportunity/schema-v2";

const root = process.cwd();

async function readCards(directory: "demo" | "opportunities"): Promise<OpportunityCard[]> {
  const dataDirectory = path.join(root, "data", directory);
  const files = (await readdir(dataDirectory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) =>
    opportunityCardSchema.parse(JSON.parse(await readFile(path.join(dataDirectory, file), "utf8")) as unknown),
  ));
}

async function reviewedCard(slug: string): Promise<OpportunityCard> {
  const cards = await readCards("opportunities");
  const card = cards.find((candidate) => candidate.slug === slug);
  if (card === undefined) throw new Error(`Missing reviewed card ${slug}.`);
  return card;
}

describe("canonical V2 repository cards", () => {
  it("stores all seven demos and all three reviewed cards as canonical V2", async () => {
    const [demos, reviewed] = await Promise.all([
      readCards("demo"),
      readCards("opportunities"),
    ]);

    expect(demos).toHaveLength(7);
    expect(reviewed).toHaveLength(3);
    for (const card of [...demos, ...reviewed]) {
      expect(card.schemaVersion).toBe("2.0.0");
      expect(card.cardVersion).toBe(2);
      expect(card.migratedFrom?.schemaVersion).toBe("1.0.0");
      expect(card.migratedFrom?.cardVersion).toBe(1);
      expect(card.migratedFrom?.cardSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const card of demos) {
      expect(card.reviewState).toBe("demo");
      expect(card.cycle.status).toBe("unassessed");
    }
    for (const card of reviewed) {
      expect(card.reviewState).toBe("human_reviewed");
      expect(card.reviewedAt).toBe("2026-08-12T00:27:28.180Z");
      expect(card.opportunityId).not.toBeNull();
      expect(card.cycle.status).toBe("modeled");
      for (const collection of [
        card.organizations,
        card.organizationRoles,
        card.institutionRelationships,
        card.variants,
        card.stages,
        card.pathways,
        card.costItems,
        card.outcomes,
      ]) {
        expect(collection.status).not.toBe("unassessed");
      }
    }
  });

  it("keeps TechRise restricted build funding out of participant cash", async () => {
    const card = await reviewedCard("nasa-techrise-student-challenge-2026-2027");
    expect(card.opportunityId).toBe("nasa-techrise-student-challenge");
    expect(card.organizationRoles.status).toBe("modeled");
    if (card.organizationRoles.status !== "modeled" || card.outcomes.status !== "modeled") return;

    expect(card.organizationRoles.records.map((record) => record.role.value.role).sort()).toEqual([
      "administrator",
      "manager",
    ]);
    const funding = card.outcomes.records.find((outcome) => outcome.definition.value.outcomeType === "project_budget");
    expect(funding?.amount?.status).toBe("disclosed");
    if (funding?.amount?.status === "disclosed") {
      expect(funding.amount.value).toEqual({ kind: "exact", amount: 1500, currency: "USD" });
    }
    expect(funding?.recipientScope.status === "disclosed" ? funding.recipientScope.value : null).toBe("team");
    expect(funding?.monetaryNature?.status === "disclosed" ? funding.monetaryNature.value : null).toBe("restricted_funding");
    expect(funding?.useRestriction?.status).toBe("disclosed");
    expect(card.outcomes.records.some((outcome) =>
      outcome.definition.value.outcomeType === "personal_cash_prize" ||
      outcome.definition.value.outcomeType === "team_cash_prize"
    )).toBe(false);
    expect(card.facts.cash_award.status).toBe("unclear");
  });

  it("separates Lumiere credit partnership from founder and mentor affiliations", async () => {
    const card = await reviewedCard("lumiere-research-scholar-program-fall-2026");
    expect(card.opportunityId).toBe("lumiere-research-scholar-program");
    expect(card.institutionRelationships.status).toBe("modeled");
    expect(card.costItems.status).toBe("modeled");
    expect(card.variants.status).toBe("modeled");
    if (
      card.institutionRelationships.status !== "modeled" ||
      card.costItems.status !== "modeled" ||
      card.variants.status !== "modeled"
    ) return;

    const relationshipTypes = card.institutionRelationships.records.map((relationship) =>
      relationship.assertion.status === "disclosed" ? relationship.assertion.value.relationshipType : relationship.assertion.status,
    );
    expect(relationshipTypes.filter((type) => type === "credit_partnership")).toHaveLength(1);
    expect(relationshipTypes.filter((type) => type === "founders_affiliated_with")).toHaveLength(2);
    expect(relationshipTypes.filter((type) => type === "mentors_affiliated_with")).toHaveLength(4);
    expect(relationshipTypes).not.toContain("institution_partnered");

    expect(card.variants.records).toHaveLength(4);
    const tuition = card.costItems.records.filter((cost) => cost.definition.value.kind === "tuition");
    expect(tuition).toHaveLength(4);
    expect(tuition.map((cost) => cost.amount.status === "disclosed" && cost.amount.value.kind === "exact"
      ? cost.amount.value.amount
      : null)).toEqual([3190, 6450, 9900, 9900]);
    expect(tuition.every((cost) => cost.definition.value.scope.variantIds.length === 1)).toBe(true);

    const deposit = card.costItems.records.find((cost) => cost.definition.value.kind === "deposit");
    expect(deposit?.treatment?.status).toBe("disclosed");
    if (deposit?.treatment?.status === "disclosed") {
      expect(deposit.treatment.value.targetCostItemIds).toHaveLength(4);
    }
    expect(deposit?.refundability?.status === "disclosed" ? deposit.refundability.value.kind : null).toBe("conditional");
    expect(card.facts.tuition.displayValue).toBe("Varies by program/cohort");
  });

  it("preserves Diamond branches and the supported six-item team prize matrix", async () => {
    const card = await reviewedCard("diamond-challenge-2027");
    expect(card.opportunityId).toBe("diamond-challenge");
    expect(card.variants.status).toBe("modeled");
    expect(card.pathways.status).toBe("modeled");
    expect(card.outcomes.status).toBe("modeled");
    if (card.variants.status !== "modeled" || card.pathways.status !== "modeled" || card.outcomes.status !== "modeled") return;

    expect(card.variants.records.map((variant) => variant.definition.value.label)).toEqual([
      "Business Innovation",
      "Social Innovation",
    ]);
    expect(card.pathways.records.map((pathway) => pathway.definition.value.label)).toEqual([
      "Live pitch pathway",
      "Virtual/pre-recorded pitch pathway",
    ]);

    const prizes = card.outcomes.records.filter((outcome) => outcome.definition.value.outcomeType === "team_cash_prize");
    expect(prizes).toHaveLength(6);
    expect(prizes.map((prize) => prize.amount?.status === "disclosed" && prize.amount.value.kind === "exact"
      ? prize.amount.value.amount
      : null)).toEqual([12000, 8000, 4500, 12000, 8000, 4500]);
    expect(prizes.every((prize) =>
      prize.recipientScope.status === "disclosed" && prize.recipientScope.value === "team"
    )).toBe(true);
    expect(prizes.every((prize) => prize.distribution?.status === "disclosed")).toBe(true);
    expect(prizes.every((prize) => prize.definition.value.scope.variantIds.length === 1)).toBe(true);
    expect(card.facts.cash_award.displayValue).toBe("Multiple cash awards — see prize details");
    expect(card.facts.duration.displayValue).toBe("Scoped by stage/pathway — see details");
    expect(card.facts.participation_format.displayValue).toBe("Varies by stage/pathway");
    expect(card.facts.location.displayValue).toBe("Varies by stage/pathway");
    expect(card.outcomes.note).toContain("stored excerpts do not support those names");
  });
});
