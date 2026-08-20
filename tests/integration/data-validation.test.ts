import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createEmptyCard, opportunityCardSchema } from "../../lib/opportunity";
import {
  createPublicDataset,
  parsePublicDataset,
} from "../../lib/opportunity/artifacts";

describe("demo dataset", () => {
  it("rejects a schema-valid draft at the runtime public-dataset boundary", () => {
    const dataset = createPublicDataset([
      createEmptyCard({ slug: "private-draft", reviewState: "draft" }),
    ]);

    expect(() => parsePublicDataset(dataset)).toThrow(
      /cannot contain draft or automated-draft cards/i,
    );
  });

  it("keys opportunity-cycle uniqueness to stable IDs instead of display labels", async () => {
    const source = JSON.parse(
      await readFile(
        path.join(
          process.cwd(),
          "data",
          "opportunities",
          "nasa-techrise-student-challenge-2026-2027.json",
        ),
        "utf8",
      ),
    ) as ReturnType<typeof createEmptyCard>;
    const alternateLabel = structuredClone(source);
    alternateLabel.slug = "nasa-techrise-alternate-cycle-label";
    if (alternateLabel.cycle.status !== "modeled") throw new Error("Expected modeled cycle fixture.");
    alternateLabel.cycle.value.label.value = "2026-27";
    alternateLabel.cycle.value.label.displayValue = "2026-27";

    expect(() => parsePublicDataset(createPublicDataset([source, alternateLabel])))
      .toThrow(/duplicate opportunity\/cycle identity/i);
  });

  it("contains at least six valid, obviously fictional cards with varied relationships", async () => {
    const directory = path.join(process.cwd(), "data", "demo");
    const files = (await readdir(directory)).filter((name) => name.endsWith(".json"));
    const cards = await Promise.all(
      files.map(async (name) =>
        opportunityCardSchema.parse(JSON.parse(await readFile(path.join(directory, name), "utf8")) as unknown),
      ),
    );

    expect(cards.length).toBeGreaterThanOrEqual(6);
    expect(cards.every((card) => card.reviewState === "demo")).toBe(true);
    expect(
      cards.every((card) =>
        card.sourcePagesChecked.every((source) => new URL(source.url).hostname.endsWith(".example")),
      ),
    ).toBe(true);
    const relationships = new Set(
      cards
        .map((card) => card.facts.institution_relationship.normalizedValue)
        .filter((value) => value?.kind === "relationship")
        .map((value) => value.value),
    );
    expect([...relationships]).toEqual(
      expect.arrayContaining(["institution_operated", "hosted_at_institution", "independent"]),
    );
    expect(cards.some((card) => card.facts.institution_relationship.status === "unclear")).toBe(true);
    expect(cards.some((card) => card.conflicts.length > 0)).toBe(true);
  });

  it("keeps cash and in-kind outcomes separately classified", async () => {
    const raw = JSON.parse(
      await readFile(path.join(process.cwd(), "data", "demo", "cipher-finch-student-challenge.json"), "utf8"),
    ) as unknown;
    const card = opportunityCardSchema.parse(raw);
    expect(card.facts.cash_award.normalizedValue).toMatchObject({ classification: "cash" });
    expect(card.facts.in_kind_value.normalizedValue).toMatchObject({ classification: "in_kind" });
  });
});
