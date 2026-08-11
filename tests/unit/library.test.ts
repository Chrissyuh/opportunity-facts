import { describe, expect, it } from "vitest";

import {
  createEmptyCard,
  factSchema,
  opportunityDeadlineState,
} from "../../lib/opportunity";

const source = {
  id: "rules",
  url: "https://program.example/rules",
  title: "Rules",
  pageType: "official_rules" as const,
  accessedAt: "2026-08-11T12:00:00Z",
  excerpt: "Applications are open until filled.",
};

describe("opportunity library deadline classification", () => {
  it("evaluates normalized dates against the caller's current date", () => {
    const card = createEmptyCard({ slug: "dated" });
    card.facts.application_deadline = factSchema.parse({
      status: "disclosed",
      value: "August 12, 2026",
      displayValue: "August 12, 2026",
      normalizedValue: { kind: "date", isoDate: "2026-08-12" },
      sources: [source],
      claimKind: "source_stated",
    });

    expect(opportunityDeadlineState(card, "2026-08-11")).toBe("upcoming");
    expect(opportunityDeadlineState(card, "2026-08-13")).toBe("past");
  });

  it("recognizes explicit rolling or open wording without inventing a date", () => {
    const card = createEmptyCard({ slug: "rolling" });
    card.facts.application_deadline = factSchema.parse({
      status: "disclosed",
      value: "Applications are open until filled.",
      displayValue: "Applications are open until filled.",
      sources: [source],
      claimKind: "source_stated",
    });

    expect(opportunityDeadlineState(card, "2030-01-01")).toBe("upcoming");
  });
});
