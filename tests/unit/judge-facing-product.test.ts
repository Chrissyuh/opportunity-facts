import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  reviewDescriptions,
  reviewShortDescriptions,
} from "@/components/status-badge";

describe("judge-facing product language", () => {
  it("explains AI-audited provenance without implying human review", () => {
    expect(reviewShortDescriptions.ai_audited).toContain("higher-capability AI workflow");
    expect(reviewDescriptions.ai_audited).toContain("separate from the standard Opportunity Facts analyzer");
    expect(reviewDescriptions.ai_audited).toContain("No human review is claimed");
  });

  it("renders homepage review provenance from data rather than a hard-coded label", () => {
    const homepage = readFileSync("app/page.tsx", "utf8");
    expect(homepage).toContain("<ReviewBadge state={card.reviewState} />");
    expect(homepage).not.toContain('>AI-audited<');
  });

  it("routes the primary How it works navigation to the accessible product explanation", () => {
    const header = readFileSync("components/site-header.tsx", "utf8");
    expect(header).toContain('{ href: "/how-it-works", label: "How it works" }');
  });
});
