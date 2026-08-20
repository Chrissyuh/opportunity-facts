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
import {
  assessSourceRelevance,
  sourceSupportsTargetSpecificClaim,
} from "@/lib/analysis/source-relevance";
import type { AnalysisSourceContext } from "@/lib/analysis/model-extraction";
import { factSchema, type EvidenceSource } from "@/lib/opportunity";

function context(
  id: string,
  url: string,
  title: string,
  blocks: Array<{ kind: "heading" | "paragraph" | "table_row"; text: string }>,
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
    ["location", "District 8", "Entrants must live or attend school in District 8 to be eligible."],
    ["geographic_restrictions", "National", "This national program includes travel to the host campus."],
    ["other_benefits", "Teacher award", "The winning student's teacher receives classroom equipment."],
    ["travel_requirements", "Travel required", "Finalists must travel to the in-person summit."],
    ["program_seat", "Enrollment", "Upon receiving notice of acceptance, students may enroll in the paid program."],
    ["selection_process", "Program", "Join our six-week residential summer program."],
    ["material_terms", "SMS required", "Text-message alerts are optional and users may opt out of SMS notifications."],
    ["cancellation_rights", "SMS changes", "We may change or discontinue the optional text-message program at any time."],
    ["cancellation_rights", "Safety changes", "We may implement new mask and distancing safety measures during the program."],
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

  it("retains actual participation geography and an actual selection process", () => {
    expect(validateFactSubjectScope(
      "location",
      disclosed("Host campus", "Participants attend the residential session on the host campus."),
    ).supported).toBe(true);
    expect(validateFactSubjectScope(
      "geographic_restrictions",
      disclosed("Worldwide", "The program is open to eligible students worldwide."),
    ).supported).toBe(true);
    expect(validateFactSubjectScope(
      "selection_process",
      disclosed("Holistic review", "Applications are reviewed holistically before finalists are selected."),
    ).supported).toBe(true);
  });

  it("does not turn admission to an external college into a seat in the opportunity", () => {
    expect(validateFactSubjectScope(
        "program_seat",
        disclosed(
          "Early admission to a matched college",
          "Through the Match program, finalists are admitted early with a full four-year scholarship to the school with which they matched.",
        ),
    )).toMatchObject({
      supported: false,
      reason: expect.stringMatching(/external college|external.*school/i),
    });
    expect(validateFactSubjectScope(
      "program_seat",
      disclosed(
        "Guaranteed university seat",
        "Selected finalists receive a guaranteed seat at a partner university.",
      ),
    ).supported).toBe(false);
    expect(validateFactSubjectScope(
      "program_seat",
      disclosed(
        "Employer placement",
        "Selected participants receive a placement with an employer.",
      ),
    ).supported).toBe(false);

    expect(validateFactSubjectScope(
      "program_seat",
      disclosed(
        "Funded seat in the summer program",
        "Selected applicants receive a fully funded seat in this summer program.",
      ),
    ).supported).toBe(true);
  });

  it("binds structured program-seat outcomes to the opportunity rather than an external institution", () => {
    const scope = { variantIds: [], stageIds: [], pathwayIds: [] };
    expect(structuredSubjectScopeFailure(
      "outcomes",
      ["outcomes", 0, "definition"],
      { label: "Early college admission", outcomeType: "program_seat", scope },
      [source("Winners are admitted to a partner university with a full scholarship.")],
    )).toMatch(/external college|external.*university/i);

    expect(structuredSubjectScopeFailure(
      "outcomes",
      ["outcomes", 0, "definition"],
      { label: "Funded program seat", outcomeType: "program_seat", scope },
      [source("Winners receive a fully funded seat in this fellowship program.")],
    )).toBeNull();
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
    expect(structuredSubjectScopeFailure(
      "stages",
      ["stages", 0, "locations", 0],
      { location: "District 8", scope: { variantIds: [], stageIds: [], pathwayIds: [] } },
      [source("Entrants must live or attend school in District 8 to be eligible.")],
    )).toMatch(/eligibility geography/i);
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

  it("recognizes common official cycle wording without relying on one phrase order", () => {
    const deadlineYear = resolveExplicitCycle([
      context("challenge", "https://example.org/challenge", "Breakthrough Challenge", [
        { kind: "paragraph", text: "Submissions are due September 15, 2026 at 11:59 PM PDT." },
      ]),
    ]);
    expect(deadlineYear?.label).toBe("2026");
    expect(deadlineYear?.cycle.status === "modeled" && deadlineYear.cycle.value.cycleType.value)
      .toBe("competition_cycle");

    const explicitlyOpen = resolveExplicitCycle([
      context("open", "https://example.org/open", "Breakthrough Challenge", [
        { kind: "heading", text: "Welcome to the 2026 Breakthrough Challenge. Applications are now OPEN!" },
      ]),
    ]);
    expect(explicitlyOpen?.cycle.status === "modeled" && explicitlyOpen.cycle.value.status.value)
      .toBe("applications_open");

    const cohortOrder = resolveExplicitCycle([
      context("cohort", "https://example.org/cohort", "Research Program", [
        { kind: "heading", text: "Fall Cohort 2026 — August 23 — September 14" },
      ]),
    ]);
    expect(cohortOrder?.label).toBe("Fall 2026");

    const yearBeforeSeason = resolveExplicitCycle([
      context("summer", "https://example.org/summer", "Summer Program FAQ", [
        { kind: "heading", text: "2027 Summer program dates are not yet available" },
      ]),
    ]);
    expect(yearBeforeSeason?.label).toBe("Summer 2027");

    const summerMonths = resolveExplicitCycle([
      context("sessions", "https://example.org/sessions", "Young Global Scholars", [
        { kind: "paragraph", text: "Residential sessions will be offered in June & July 2027." },
      ]),
    ]);
    expect(summerMonths?.label).toBe("Summer 2027");
  });

  it("expands abbreviated academic-year ranges and uses a target-page title as cycle evidence", () => {
    const range = resolveExplicitCycle([
      context("root", "https://example.org/challenge", "NASA Student Challenge", [
        { kind: "heading", text: "The 2026-27 student challenge will use a high-altitude balloon." },
      ]),
    ]);
    expect(range?.label).toBe("2026–2027");
    expect(range?.years).toEqual([2026, 2027]);

    const title = resolveExplicitCycle([
      context("scholarship", "https://example.org/apply", "2027 National Scholars", [
        { kind: "paragraph", text: "Applicants graduate during the 2026-2027 academic school year." },
      ]),
    ]);
    expect(title?.label).toBe("2027");
    expect(title?.years).toEqual([2027]);
  });

  it("does not treat an eligibility school year as the target cycle", () => {
    const eligibilityOnly = resolveExplicitCycle([
      context("eligibility", "https://example.org/eligibility", "Eligibility", [
        {
          kind: "paragraph",
          text: "Applicants must graduate during the 2026-2027 academic school year.",
        },
      ]),
    ]);
    expect(eligibilityOnly).toBeNull();
  });

  it("withholds a page that presents several same-year seasonal cohorts without a target anchor", () => {
    const severalCohorts = resolveExplicitCycle([
      context("cohorts", "https://example.org/cohorts", "Program cohorts", [
        { kind: "heading", text: "Summer 2027 cohort" },
        { kind: "heading", text: "Fall 2027 cohort" },
      ]),
    ]);
    expect(severalCohorts).toBeNull();
  });

  it("keeps adjacent application and participation years in one lifecycle context", () => {
    const resolved = resolveExplicitCycle([
      context("match", "https://example.org/match", "2026 National Match", [
        { kind: "heading", text: "The 2026 National Match is now open" },
        { kind: "paragraph", text: "Students selected through the Match enroll in Fall 2027." },
      ]),
    ]);
    expect(resolved?.label).toBe("2026 / Fall 2027 entry");
    expect(resolved?.years).toEqual([2026, 2027]);
    expect(
      resolved?.cycle.status === "modeled"
        ? resolved.cycle.value.endYear?.value
        : null,
    ).toBe(2027);
    expect(evidenceMatchesResolvedCycle("College enrollment begins in Fall 2027.", resolved!)).toBe(true);
    expect(evidenceMatchesResolvedCycle("2,000 students were selected in 2025.", resolved!)).toBe(false);
  });

  it("keeps an adjacent participation year expressed across a target timeline", () => {
    const resolved = resolveExplicitCycle([
      context("match", "https://example.org/match", "2026 National Match", [
        { kind: "heading", text: "The 2026 National Match application" },
        {
          kind: "paragraph",
          text: "December - February 2027 | Additional requirements must be submitted by the colleges' deadlines.",
        },
        {
          kind: "paragraph",
          text: "Spring 2027 | Admissions decisions are sent to applicants.",
        },
        {
          kind: "paragraph",
          text: "Fall 2027 | Finalists attending a partner college join the community.",
        },
        { kind: "paragraph", text: "Finalists matched to a partner in 2025." },
      ]),
    ]);

    expect(resolved?.label).toBe("2026 / Fall 2027 entry");
    expect(resolved?.years).toEqual([2026, 2027]);
    expect(evidenceMatchesResolvedCycle("Fall 2027 attendance begins.", resolved!)).toBe(true);
    expect(evidenceMatchesResolvedCycle("Finalists matched in 2025.", resolved!)).toBe(false);
    expect(
      resolved?.cycle.status === "modeled"
        ? resolved.cycle.value.cycleType.status
        : null,
    ).toBe("unclear");
  });

  it.each([
    {
      name: "Breakthrough deadline year",
      title: "Breakthrough Junior Challenge",
      blocks: ["Submissions are due September 15, 2026 at 11:59 PM PDT."],
      label: "2026",
    },
    {
      name: "Coca-Cola named class rather than eligibility school year",
      title: "Apply - Coca-Cola Scholars Foundation",
      blocks: [
        "2027 Coca-Cola Scholars",
        "Current students graduate high school during the 2026-2027 academic school year.",
      ],
      label: "2027",
    },
    {
      name: "Congressional competition announcement",
      title: "The 2026 Congressional App Challenge Launches Today",
      blocks: ["The 2026 Congressional App Challenge"],
      label: "2026",
    },
    {
      name: "Lumiere cohort wording",
      title: "Programs | Lumiere Education",
      blocks: ["Fall Cohort 2026 — August 23, 2026 — September 14, 2026"],
      label: "Fall 2026",
    },
    {
      name: "MITES year before season",
      title: "FAQs - MITES Summer and Semester",
      blocks: ["2027 MITES Summer dates are not yet available"],
      label: "Summer 2027",
    },
    {
      name: "TechRise abbreviated range",
      title: "Future Engineers :: NASA TechRise Challenge",
      blocks: ["The 2026-27 NASA TechRise Student Challenge will use a high-altitude balloon."],
      label: "2026–2027",
    },
    {
      name: "Polygence monthly rolling cohort",
      title: "For Counselors - Polygence",
      blocks: ["Each month, we start a new cohort"],
      label: "Rolling admissions",
    },
    {
      name: "Yale summer sessions",
      title: "Yale Young Global Scholars",
      blocks: ["Residential sessions will be offered in June & July 2027."],
      label: "Summer 2027",
    },
  ])("resolves reviewed wording: $name", ({ title, blocks, label }) => {
    const resolved = resolveExplicitCycle([
      context("reviewed-cycle", "https://example.org/opportunity", title, blocks.map((text) => ({ kind: "heading" as const, text }))),
    ]);
    expect(resolved?.label).toBe(label);
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

  it("does not treat organization-level or unclear pages as target-specific without target identity", () => {
    const sources = [
      context("target", "https://example.org/programs/aurora", "Aurora Research Program | Example", []),
      context("terms", "https://example.org/terms", "Terms | Example", []),
      context("generic", "https://example.org/requirements", "Requirements | Example", []),
      context("named-terms", "https://example.org/program-terms", "Terms | Aurora Research Program", []),
    ];
    const result = assessSourceRelevance(sources);
    expect(sourceSupportsTargetSpecificClaim("terms", result)).toBe(false);
    expect(sourceSupportsTargetSpecificClaim("generic", result)).toBe(false);
    expect(sourceSupportsTargetSpecificClaim("terms", result, "Aurora Research Program applicants agree to these terms.")).toBe(true);
    expect(sourceSupportsTargetSpecificClaim("named-terms", result)).toBe(true);
  });
});
