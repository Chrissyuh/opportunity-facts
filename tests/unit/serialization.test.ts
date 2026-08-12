import { describe, expect, it } from "vitest";

import {
  OpportunityCardImportError,
  createEmptyCard,
  createEmptyV1Card,
  exportOpportunityCardJson,
  importOpportunityCardJson,
} from "../../lib/opportunity";

describe("Opportunity Card JSON import and export", () => {
  it("round-trips a validated plain JSON card", () => {
    const card = createEmptyCard({ slug: "portable-card" });
    const json = exportOpportunityCardJson(card);
    expect(importOpportunityCardJson(json)).toEqual(card);
    expect(json.endsWith("\n")).toBe(true);
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
    expect(migrated.schemaVersion).toBe("2.0.0");
    expect(migrated.reviewState).toBe("draft");
    expect(migrated.opportunityId).toBeNull();
    expect(migrated.cardVersion).toBe(v1.cardVersion + 1);

    expect(() =>
      importOpportunityCardJson(JSON.stringify({ ...migrated, schemaVersion: "3.0.0" })),
    ).toThrow(/Schema version 3\.0\.0 is not supported/);
  });
});
