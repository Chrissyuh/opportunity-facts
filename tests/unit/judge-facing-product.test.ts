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

  it("keeps reference records and provenance out of the analyzer-first homepage", () => {
    const homepage = readFileSync("app/page.tsx", "utf8");
    expect(homepage).not.toContain("getAllCards");
    expect(homepage).not.toContain("ReviewBadge");
    expect(homepage).not.toContain("AI-audited");
    expect(homepage).toContain("<SampleLauncher />");
    const launcher = readFileSync("components/sample-launcher.tsx", "utf8");
    expect(launcher).toContain('href="/analyze?sample=next"');
    expect(launcher).toContain("Try a sample");
    expect(launcher).not.toContain("Try another sample");
  });

  it("routes the primary How it works navigation to the accessible product explanation", () => {
    const header = readFileSync("components/site-header.tsx", "utf8");
    expect(header).toContain('{ href: "/how-it-works", label: "How it works" }');
    expect(header).not.toContain('{ href: "/", label: "Analyze" }');
    expect(header).not.toContain('{ href: "/compare", label: "Compare" }');
    expect(header).not.toContain('label: "Examples"');
    expect(header).not.toContain("wordmark-mark");
  });
});
