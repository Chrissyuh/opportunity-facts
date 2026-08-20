import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  OpportunityCardImportError,
  LEGACY_V2_SCHEMA_VERSION,
  PRIOR_V2_SCHEMA_VERSION,
  SCHEMA_VERSION,
  createEmptyCard,
  createEmptyV1Card,
  exportOpportunityCardJson,
  importOpportunityCardJson,
  opportunityCardSchema,
  parseOpportunityCard,
} from "../../lib/opportunity";

function asLegacyVersion(
  input: unknown,
  version: typeof LEGACY_V2_SCHEMA_VERSION | typeof PRIOR_V2_SCHEMA_VERSION,
): unknown {
  const legacy = structuredClone(input) as {
    schemaVersion: string;
    reviewState?: string;
    facts?: Record<string, { projection?: { schemaVersion?: string } | null }>;
  };
  legacy.schemaVersion = version;
  if (legacy.reviewState === "ai_audited") legacy.reviewState = "human_reviewed";
  if (legacy.reviewState === "automated_draft") legacy.reviewState = "draft";
  for (const fact of Object.values(legacy.facts ?? {})) {
    if (fact.projection !== null && fact.projection !== undefined) {
      fact.projection.schemaVersion = version;
    }
  }
  return legacy;
}

function asLegacyV2(input: unknown): unknown {
  return asLegacyVersion(input, LEGACY_V2_SCHEMA_VERSION);
}

describe("Opportunity Card JSON import and export", () => {
  it("round-trips a validated plain JSON card", () => {
    const card = createEmptyCard({ slug: "portable-card" });
    const json = exportOpportunityCardJson(card);
    expect(importOpportunityCardJson(json)).toEqual(card);
    expect(json.endsWith("\n")).toBe(true);
  });

  it("invalidates every portable review attestation without discarding card evidence", () => {
    const audited = parseOpportunityCard(JSON.parse(
      readFileSync(
        join(process.cwd(), "data/opportunities/diamond-challenge-2027.json"),
        "utf8",
      ),
    ) as unknown);

    for (const reviewState of [
      "ai_audited",
      "human_reviewed",
      "organizer_confirmed",
    ] as const) {
      const portable = opportunityCardSchema.parse({ ...audited, reviewState });
      const imported = importOpportunityCardJson(JSON.stringify(portable));

      expect(imported.reviewState).toBe("draft");
      expect(imported.reviewedAt).toBeNull();
      expect(imported.cardVersion).toBe(portable.cardVersion + 1);
      expect(imported.sourcePagesChecked).toEqual(portable.sourcePagesChecked);
      expect(imported.facts).toEqual(portable.facts);
      expect(imported.outcomes).toEqual(portable.outcomes);
    }
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

    const legacy = asLegacyV2(current) as typeof current & { reviewState: string };
    const migrated = parseOpportunityCard(legacy);

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.cardVersion).toBe(current.cardVersion);
    expect(migrated.reviewState).toBe("human_reviewed");
    expect(migrated.facts.cash_award).toEqual(current.facts.cash_award);
    expect(migrated.outcomes).toEqual(current.outcomes);
    for (const fact of Object.values(migrated.facts)) {
      if (fact.projection !== null) {
        expect(fact.projection.schemaVersion).toBe(SCHEMA_VERSION);
      }
    }
  });

  it("imports schema 2.1.0 forms of all 17 canonical cards and preserves rich semantics", () => {
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
        reviewedAt: string | null;
        opportunityId: string | null;
        sourcePagesChecked: unknown;
        facts: unknown;
        conflicts: unknown;
        projectionRefs: unknown;
        migratedFrom: unknown;
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
      const legacy = asLegacyVersion(current, PRIOR_V2_SCHEMA_VERSION) as typeof current;
      const migrated = parseOpportunityCard(legacy);

      expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
      expect(migrated.cardVersion).toBe(current.cardVersion);
      expect(migrated.reviewState).toBe(legacy.reviewState);
      expect(migrated.reviewedAt).toBe(current.reviewedAt);
      expect(migrated.opportunityId).toBe(current.opportunityId);
      expect(migrated.sourcePagesChecked).toEqual(current.sourcePagesChecked);
      expect(migrated.facts).toEqual(current.facts);
      expect(migrated.conflicts).toEqual(current.conflicts);
      expect(migrated.projectionRefs).toEqual(current.projectionRefs);
      expect(migrated.migratedFrom).toEqual(current.migratedFrom);
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

  it("rejects review states introduced in 2.2.0 when carried under an older schema label", () => {
    const current = JSON.parse(
      readFileSync(
        join(process.cwd(), "data/opportunities/diamond-challenge-2027.json"),
        "utf8",
      ),
    ) as { facts: Record<string, { projection: { schemaVersion: string } | null }> } & Record<string, unknown>;
    const mislabeled = structuredClone(current);
    mislabeled.schemaVersion = PRIOR_V2_SCHEMA_VERSION;
    for (const fact of Object.values(mislabeled.facts)) {
      if (fact.projection !== null) fact.projection.schemaVersion = PRIOR_V2_SCHEMA_VERSION;
    }

    expect(() => parseOpportunityCard(mislabeled)).toThrow(/schema 2\.1\.0 card is invalid/i);
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
