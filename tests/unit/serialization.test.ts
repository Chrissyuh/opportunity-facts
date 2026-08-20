import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  OpportunityCardImportError,
  LEGACY_V2_SCHEMA_VERSION,
  SCHEMA_VERSION,
  createEmptyCard,
  createEmptyV1Card,
  exportOpportunityCardJson,
  importOpportunityCardJson,
  parseOpportunityCard,
} from "../../lib/opportunity";

function asLegacyV2(input: unknown): unknown {
  const legacy = structuredClone(input) as {
    schemaVersion: string;
    facts?: Record<string, { projection?: { schemaVersion?: string } | null }>;
  };
  legacy.schemaVersion = LEGACY_V2_SCHEMA_VERSION;
  for (const fact of Object.values(legacy.facts ?? {})) {
    if (fact.projection !== null && fact.projection !== undefined) {
      fact.projection.schemaVersion = LEGACY_V2_SCHEMA_VERSION;
    }
  }
  return legacy;
}

function asLegacyV2Representable(input: unknown): unknown {
  const legacy = structuredClone(input) as {
    outcomes?: {
      records?: Array<{
        definition?: { value?: { outcomeType?: string } };
        recipientScope?: { value?: string };
        distribution?: { value?: Array<{ payee?: string }> } | null;
      }>;
    };
  };
  for (const outcome of legacy.outcomes?.records ?? []) {
    if (outcome.definition?.value?.outcomeType === "educator_cash_prize") {
      outcome.definition.value.outcomeType = "personal_cash_prize";
    }
    if (outcome.recipientScope?.value === "educator") {
      outcome.recipientScope.value = "individual";
    }
    for (const distribution of outcome.distribution?.value ?? []) {
      if (distribution.payee === "educator") distribution.payee = "participant";
      if (distribution.payee === "school") distribution.payee = "service_provider";
    }
  }
  return asLegacyV2(legacy);
}

describe("Opportunity Card JSON import and export", () => {
  it("round-trips a validated plain JSON card", () => {
    const card = createEmptyCard({ slug: "portable-card" });
    const json = exportOpportunityCardJson(card);
    expect(importOpportunityCardJson(json)).toEqual(card);
    expect(json.endsWith("\n")).toBe(true);
  });

  it("invalidates review attestation carried by a portable v2 file", () => {
    const reviewed = JSON.parse(
      readFileSync(
        join(process.cwd(), "data/opportunities/diamond-challenge-2027.json"),
        "utf8",
      ),
    ) as unknown;
    const original = importOpportunityCardJson(JSON.stringify(reviewed));

    expect(original.reviewState).toBe("draft");
    expect(original.reviewedAt).toBeNull();
    expect(original.cardVersion).toBe((reviewed as { cardVersion: number }).cardVersion + 1);
  });

  it("preserves the Demo data label on portable fictional cards", () => {
    const demo = createEmptyCard({ slug: "portable-demo", reviewState: "demo" });
    expect(importOpportunityCardJson(JSON.stringify(demo))).toEqual(demo);
  });

  it("reports malformed JSON separately from schema-invalid JSON", () => {
    expect(() => importOpportunityCardJson("{"))
      .toThrowError(new OpportunityCardImportError("The selected file is not valid JSON."));
    try {
      importOpportunityCardJson('{"slug":"incomplete"}');
      throw new Error("Expected import to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(OpportunityCardImportError);
      expect((error as OpportunityCardImportError).issues.length).toBeGreaterThan(0);
    }
  });

  it("migrates v1 imports and rejects unsupported future versions clearly", () => {
    const v1 = createEmptyV1Card({ slug: "legacy-card" });
    const migrated = importOpportunityCardJson(JSON.stringify(v1));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.reviewState).toBe("draft");
    expect(migrated.opportunityId).toBeNull();
    expect(migrated.cardVersion).toBe(v1.cardVersion + 1);

    expect(() =>
      importOpportunityCardJson(JSON.stringify({ ...migrated, schemaVersion: "3.0.0" })),
    ).toThrow(/Schema version 3\.0\.0 is not supported/);
  });

  it("losslessly migrates a rich schema 2.0.0 card without changing its card revision", () => {
    const current = JSON.parse(
      readFileSync(
        join(process.cwd(), "data/opportunities/diamond-challenge-2027.json"),
        "utf8",
      ),
    ) as { cardVersion: number; facts: { cash_award: unknown }; outcomes: unknown };

    const migrated = parseOpportunityCard(asLegacyV2(current));

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.cardVersion).toBe(current.cardVersion);
    expect(migrated.facts.cash_award).toEqual(current.facts.cash_award);
    expect(migrated.outcomes).toEqual(current.outcomes);
    for (const fact of Object.values(migrated.facts)) {
      if (fact.projection !== null) {
        expect(fact.projection.schemaVersion).toBe(SCHEMA_VERSION);
      }
    }
  });

  it("imports legacy-compatible forms of all 17 canonical cards and preserves rich semantics", () => {
    const files = ["demo", "opportunities"].flatMap((directory) =>
      readdirSync(join(process.cwd(), "data", directory))
        .filter((file) => file.endsWith(".json"))
        .map((file) => join(process.cwd(), "data", directory, file)),
    );
    expect(files).toHaveLength(17);

    for (const file of files) {
      const current = JSON.parse(readFileSync(file, "utf8")) as {
        cardVersion: number;
        reviewState: string;
        sourcePagesChecked: unknown;
        cycle: unknown;
        organizations: unknown;
        organizationRoles: unknown;
        institutionRelationships: unknown;
        variants: unknown;
        stages: unknown;
        pathways: unknown;
        costItems: unknown;
        outcomes: unknown;
      };
      const legacy = asLegacyV2Representable(current) as typeof current;
      const migrated = parseOpportunityCard(legacy);

      expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
      expect(migrated.cardVersion).toBe(current.cardVersion);
      expect(migrated.reviewState).toBe(current.reviewState);
      expect(migrated.sourcePagesChecked).toEqual(current.sourcePagesChecked);
      for (const key of [
        "cycle",
        "organizations",
        "organizationRoles",
        "institutionRelationships",
        "variants",
        "stages",
        "pathways",
        "costItems",
        "outcomes",
      ] as const) {
        expect(migrated[key]).toEqual(legacy[key]);
      }
    }
  });

  it("does not accept schema 2.1-only educator vocabulary under a 2.0.0 label", () => {
    const current = JSON.parse(
      readFileSync(
        join(process.cwd(), "data/opportunities/breakthrough-junior-challenge-2026.json"),
        "utf8",
      ),
    ) as unknown;

    expect(() => parseOpportunityCard(asLegacyV2(current))).toThrow(
      /schema 2\.0\.0 card is invalid/i,
    );
  });
});
