import { describe, expect, it } from "vitest";

import {
  OpportunityCardImportError,
  createEmptyCard,
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
});
