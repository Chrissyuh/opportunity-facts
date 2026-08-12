import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  evidenceMatchesResolvedCycle,
  resolveExplicitCycle,
} from "@/lib/analysis/cycle-resolution";
import {
  structuredSubjectScopeFailure,
  validateFactSubjectScope,
} from "@/lib/analysis/semantic-scope";
import { assessSourceRelevance } from "@/lib/analysis/source-relevance";
import type { AnalysisSourceContext } from "@/lib/analysis/model-extraction";
import { factSchema, type EvidenceSource } from "@/lib/opportunity";

function context(
  id: string,
  url: string,
  title: string,
  blocks: Array<{ kind: "heading" | "paragraph"; text: string }>,
): AnalysisSourceContext {
  return {
    accessedAt: "2026-08-12T12:00:00.000Z",
    page: {
      id,
      url,
      title,
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text: blocks.map((block) => block.text).join("\n"),
      blocks,
      links: [],
      truncated: false,
    },
  };
}

function source(excerpt: string): EvidenceSource {
  return {
    id: "page-terms",
    url: "https://provider.example/terms",
    title: "Terms",
    pageType: "user_supplied",
    accessedAt: "2026-08-12T12:00:00.000Z",
    excerpt,
  };
}

function disclosed(value: string, excerpt: string) {
  return factSchema.parse({
    status: "disclosed",
    value,
    displayValue: value,
    claimKind: "source_stated",
    sources: [source(excerpt)],
  });
}

describe("post-evaluation subject and scope semantics", () => {
  it.each([
    ["ages", "At least 13", "Users must be at least 13 years old to create an account."],
    ["geographic_restrictions", "Not available everywhere", "These Services may not be available in every jurisdiction and are governed by California law."],
    ["sponsor_requirement", "Guardian required", "Minor users must use the Services under supervision of a parent or guardian."],
    ["location", "Austin", "Our company headquarters and mailing address are located at 100 Main Street, Austin."],
    ["other_benefits", "Teacher award", "The winning student's teacher receives classroom equipment."],
    ["travel_requirements", "Travel required", "Finalists must travel to the in-person summit."],
    ["material_terms", "SMS required", "Text-message alerts are optional and users may opt out of SMS notifications."],
  ] as const)("rejects wrong-subject evidence for %s", (fieldId, value, excerpt) => {
    expect(validateFactSubjectScope(fieldId, disclosed(value, excerpt))).toMatchObject({
      supported: false,
    });
  });

  it("retains an explicit program requirement rather than blocking matching vocabulary", () => {
    expect(
      validateFactSubjectScope(
        "ages",
        disclosed("Ages 15-18", "Eligible program applicants must be 15 to 18 years old."),
      ).supported,
    ).toBe(true);
  });

  it("retains privacy sharing that explicitly concerns delivery of the program", () => {
    expect(
      validateFactSubjectScope(
        "data_sharing",
        disclosed(
          "Program staff and service providers",
          "We may share data with service providers that operate the platform and instructors and staff involved in delivering the Program.",
        ),
      ).supported,
    ).toBe(true);
  });

  it("requires stage scope for finalist-only duties and correct recipient scope", () => {
    const finalist = [source("Finalists must travel to the summit.")];
    expect(structuredSubjectScopeFailure(
      "stages",
      ["stages", 0, "travelRequirements", 0],
      { requirement: "required", scope: { variantIds: [], stageIds: [], pathwayIds: [] } },
      finalist,
    )).toMatch(/lacked stage or pathway scope/i);
    expect(structuredSubjectScopeFailure(
      "stages",
      ["stages", 0, "travelRequirements", 0],
      { requirement: "required", scope: { variantIds: [], stageIds: ["final"], pathwayIds: [] } },
      finalist,
    )).toBeNull();
    expect(structuredSubjectScopeFailure(
      "outcomes",
      ["outcomes", 0, "recipientScope"],
      "individual",
      [source("The winning student's school receives a $10,000 lab.")],
    )).toMatch(/recipient scope conflicts/i);
  });

  it("rejects office locations and optional services in structured stage claims", () => {
    expect(structuredSubjectScopeFailure(
      "stages",
      ["stages", 0, "locations", 0],
      { location: "Austin", scope: { variantIds: [], stageIds: [], pathwayIds: [] } },
      [source("Our headquarters and mailing address are located in Austin.")],
    )).toMatch(/office address/i);
    expect(structuredSubjectScopeFailure(
      "stages",
      ["stages", 0, "requirements", 0],
      { requirement: "Receive SMS alerts", scope: { variantIds: [], stageIds: [], pathwayIds: [] } },
      [source("SMS alerts are optional and users may opt out.")],
    )).toMatch(/optional platform/i);
  });
});

describe("deterministic target-cycle resolution", () => {
  it("emits an explicit annual competition cycle and rejects a historical count", () => {
    const root = context("page-root", "https://example.org/challenges/innovation", "Innovation Challenge", [
      { kind: "heading", text: "2026 competition cycle" },
      { kind: "paragraph", text: "2,550 finalists were selected in 2025." },
    ]);
    const resolved = resolveExplicitCycle([root]);
    expect(resolved?.label).toBe("2026");
    expect(resolved?.cycle.status).toBe("modeled");
    expect(evidenceMatchesResolvedCycle("2,550 finalists were selected in 2025.", resolved!)).toBe(false);
    expect(evidenceMatchesResolvedCycle("Last year, 2,550 finalists were selected.", resolved!)).toBe(false);
  });

  it("distinguishes application year from participation year", () => {
    const resolved = resolveExplicitCycle([
      context("page-root", "https://example.org/program", "National Program", [
        { kind: "heading", text: "2026 application for Fall 2027 entry" },
      ]),
    ]);
    expect(resolved?.label).toBe("2026 application / Fall 2027 entry");
    expect(resolved?.years).toEqual(expect.arrayContaining([2026, 2027]));
  });

  it("models seasonal and rolling cycles without inventing missing years", () => {
    const fall = resolveExplicitCycle([
      context("page-fall", "https://example.org/fall", "Research Program", [
        { kind: "heading", text: "Fall 2026 cohort applications are open" },
      ]),
    ]);
    expect(fall?.label).toBe("Fall 2026");
    expect(fall?.cycle.status === "modeled" && fall.cycle.value.season?.value).toBe("fall");

    const rolling = resolveExplicitCycle([
      context("page-rolling", "https://example.org/apply", "Research Program", [
        { kind: "heading", text: "Rolling admissions" },
      ]),
    ]);
    expect(rolling?.label).toBe("Rolling admissions");
    expect(rolling?.years).toEqual([]);
  });

  it("withholds ambiguous multi-year and evergreen pages", () => {
    const ambiguous = resolveExplicitCycle([
      context("page-years", "https://example.org/archive", "Program archive", [
        { kind: "heading", text: "2025 cohort" },
        { kind: "heading", text: "2026 cohort" },
      ]),
    ]);
    expect(ambiguous).toBeNull();
    expect(resolveExplicitCycle([
      context("page-evergreen", "https://example.org/program", "Program", [
        { kind: "paragraph", text: "Students conduct research with mentors." },
      ]),
    ])).toBeNull();
  });
});

describe("same-organization sibling identity", () => {
  it("distinguishes a sibling program while retaining organization-level pages", () => {
    const sources = [
      context("target", "https://example.org/programs/national-match", "National Match | Example", []),
      context("sibling", "https://example.org/programs/prep-scholars/awards", "Prep Scholars Awards | Example", []),
      context("privacy", "https://example.org/privacy-policy", "Privacy Policy | Example", []),
      context("deadline", "https://example.org/programs/national-match/deadlines", "National Match deadlines | Example", []),
    ];
    const result = assessSourceRelevance(sources);
    expect(result.get("sibling")?.relevance).toBe("sibling");
    expect(result.get("privacy")?.relevance).toBe("organization_level");
    expect(result.get("deadline")?.relevance).toBe("target");
  });

  it("uses page identity when sibling opportunities do not share a path convention", () => {
    const sources = [
      context("target", "https://example.org/aurora-fellows", "Aurora Fellows | Example", []),
      context("sibling", "https://example.org/builder-competition", "Builder Competition | Example", []),
      context("faq", "https://example.org/fellowship-faq", "Fellowship FAQ | Example", []),
    ];
    const result = assessSourceRelevance(sources);
    expect(result.get("sibling")?.relevance).toBe("sibling");
    expect(result.get("faq")?.relevance).not.toBe("sibling");
  });
});
