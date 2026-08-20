import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assessSourceRelevance } from "@/lib/analysis/source-relevance";
import type { AnalysisSourceContext } from "@/lib/analysis/model-extraction";

function source(
  id: string,
  url: string,
  title: string,
  headings: readonly string[] = [],
): AnalysisSourceContext {
  return {
    accessedAt: "2026-08-20T00:00:00.000Z",
    page: {
      id,
      url,
      title,
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text: headings.join("\n"),
      blocks: headings.map((text) => ({ kind: "heading" as const, text })),
      links: [],
      truncated: false,
    },
  };
}

describe("source identity precedence", () => {
  it("rejects a no-path sibling that shares only generic title words", () => {
    const assessments = assessSourceRelevance([
      source(
        "target",
        "https://quest.example/apply",
        "QuestBridge National College Match",
      ),
      source(
        "sibling",
        "https://quest.example/conference-information",
        "National College Admissions Conference | QuestBridge",
      ),
      source(
        "faq",
        "https://quest.example/faq",
        "FAQ | QuestBridge National College Match",
      ),
    ]);

    expect(assessments.get("sibling")?.relevance).toBe("sibling");
    expect(assessments.get("faq")?.relevance).toBe("target");
  });

  it("treats a conflicting named-program path as a sibling despite generic title overlap", () => {
    const assessments = assessSourceRelevance([
      source(
        "target",
        "https://example.org/programs/national-college-match",
        "National College Match | Example",
      ),
      source(
        "sibling",
        "https://example.org/programs/college-prep-scholars/awards/national-college-conference",
        "National College Admissions Conference | Example",
      ),
    ]);

    expect(assessments.get("sibling")?.relevance).toBe("sibling");
  });

  it("uses a brand suffix when the submitted title is generic", () => {
    const assessments = assessSourceRelevance([
      source(
        "target",
        "https://example.org/",
        "Welcome | Yale Young Global Scholars",
      ),
      source(
        "tuition",
        "https://example.org/tuition",
        "Tuition & Aid | Yale Young Global Scholars",
      ),
    ]);

    expect(assessments.get("tuition")?.relevance).toBe("target");
  });

  it("uses an early opportunity heading when the submitted page title is generic", () => {
    const assessments = assessSourceRelevance([
      source(
        "target",
        "https://example.org/students/rules/",
        "RULES -",
        ["Congressional App Challenge official rules"],
      ),
      source(
        "faq",
        "https://example.org/students/faq/",
        "Frequently Asked Questions | Congressional App Challenge",
      ),
    ]);

    expect(assessments.get("faq")?.relevance).toBe("target");
  });

  it("uses the brand suffix after generic policy and service titles", () => {
    const assessments = assessSourceRelevance([
      source("target", "https://lumos.example/", "Lumos Fellows | Build a Product"),
      source("terms", "https://lumos.example/terms", "Terms of Service – Lumos Fellows | Lumos Fellows"),
      source("privacy", "https://lumos.example/privacy", "Privacy Policy – Lumos Fellows | Lumos Fellows"),
    ]);

    expect(assessments.get("terms")?.relevance).toBe("target");
    expect(assessments.get("privacy")?.relevance).toBe("target");
  });
});
