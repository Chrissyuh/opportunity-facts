import { describe, expect, it } from "vitest";

import {
  applyOpportunityProjections,
  createEmptyCard,
  createEmptyV1Card,
  migrateV1ToV2,
  opportunityCardSchema,
  SCHEMA_VERSION,
  type EvidenceSource,
  type OpportunityCard,
} from "../../lib/opportunity";

const page = {
  id: "official-page",
  url: "https://fixture.example/program",
  title: "Program details",
  pageType: "official_program_page" as const,
  accessedAt: "2026-08-11T18:00:00Z",
};

const evidence: EvidenceSource = {
  ...page,
  excerpt:
    "The 2027 program is operated by Example Programs and offers the stated schedules, prices, and awards.",
};

const scope = {
  variantIds: [] as string[],
  stageIds: [] as string[],
  pathwayIds: [] as string[],
};

function assertion<const T>(claimId: string, value: T, displayValue: string) {
  return {
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources: [evidence],
    note: null,
    conflictingValues: [],
  };
}

function notFound(claimId: string, note = "The reviewed source did not state this value.") {
  return {
    claimId,
    status: "not_found" as const,
    value: null,
    displayValue: null,
    claimKind: null,
    sources: [],
    note,
    conflictingValues: [],
  };
}

function noneFound(note: string) {
  return { status: "none_found" as const, records: [], note };
}

function baseRichCard(slug = "fixture-2027"): OpportunityCard {
  const empty = createEmptyCard({ slug });
  return {
    ...empty,
    opportunityId: "fixture-opportunity",
    sourcePagesChecked: [page],
    cycle: {
      status: "modeled" as const,
      value: {
        id: "cycle-2027",
        label: assertion("cycle-label", "2027 competition cycle", "2027 competition cycle"),
        status: assertion("cycle-status", "announced", "Announced"),
        year: assertion("cycle-year", 2027, "2027"),
        startYear: null,
        endYear: null,
        season: null,
        cycleType: assertion("cycle-type", "competition_cycle", "Competition cycle"),
        timingRefs: { opens: null, closes: null, coverageStart: null, coverageEnd: null },
      },
    },
    organizations: {
      status: "modeled" as const,
      records: [
        {
          id: "example-programs",
          name: assertion("organization-name", "Example Programs", "Example Programs"),
          kind: assertion("organization-kind", "education_provider", "Education provider"),
        },
      ],
      note: null,
    },
    organizationRoles: {
      status: "modeled" as const,
      records: [
        {
          id: "operator-role",
          organizationId: "example-programs",
          role: assertion(
            "operator-role-claim",
            { role: "operator", roleLabel: null, scope },
            "Operator",
          ),
        },
      ],
      note: null,
    },
    institutionRelationships: noneFound("No institution relationship was stated."),
    variants: noneFound("No variants were stated."),
    stages: noneFound("No stages were modeled for this fixture."),
    pathways: { status: "not_applicable" as const, records: [], note: "No pathway applies." },
    costItems: noneFound("No participant-paid costs were stated."),
    outcomes: noneFound("No outcomes were stated."),
  } as unknown as OpportunityCard;
}

function parseProjected(candidate: OpportunityCard): OpportunityCard {
  return opportunityCardSchema.parse(
    applyOpportunityProjections(candidate as unknown as OpportunityCard),
  );
}

describe("Opportunity Facts schema v2", () => {
  it("migrates v1 deterministically without inferring cycle identity or retaining review attestation", () => {
    const v1 = createEmptyV1Card({ slug: "example-fall-2026", reviewState: "demo" });
    const first = migrateV1ToV2(v1);
    const second = migrateV1ToV2(v1);

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(SCHEMA_VERSION);
    expect(first.opportunityId).toBeNull();
    expect(first.cycle.status).toBe("unassessed");
    expect(first.cardVersion).toBe(v1.cardVersion + 1);
    expect(first.reviewState).toBe("draft");
    expect(first.reviewedAt).toBeNull();
    expect(first.facts).toEqual(v1.facts);
    expect(first.migratedFrom?.cardSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => migrateV1ToV2(first)).toThrow();
  });

  it("keeps cycle identity independent from slug and card revision", () => {
    const first = parseProjected(baseRichCard("fixture-2027-url"));
    const revised = opportunityCardSchema.parse({
      ...first,
      slug: "stable-public-url",
      cardVersion: first.cardVersion + 1,
    });

    expect(revised.opportunityId).toBe("fixture-opportunity");
    expect(revised.cycle).toEqual(first.cycle);
  });

  it("keeps founder and mentor affiliations distinct from an institutional partnership", () => {
    const candidate = baseRichCard("relationship-fixture");
    if (candidate.organizations.status !== "modeled") throw new Error("fixture setup failed");
    candidate.organizations.records.push(
      {
        id: "credit-institution",
        name: assertion("credit-name", "Credit University Extension", "Credit University Extension"),
        kind: assertion("credit-kind", "higher_education_institution", "Higher education institution"),
      },
      {
        id: "founder-institution",
        name: assertion("founder-name", "Founder University", "Founder University"),
        kind: assertion("founder-kind", "higher_education_institution", "Higher education institution"),
      },
      {
        id: "mentor-institution",
        name: assertion("mentor-name", "Mentor Institute", "Mentor Institute"),
        kind: assertion("mentor-kind", "higher_education_institution", "Higher education institution"),
      },
    );
    candidate.institutionRelationships = {
      status: "modeled",
      records: [
        {
          id: "credit-relationship",
          assertion: assertion(
            "credit-relationship-claim",
            {
              subject: "opportunity",
              subjectOrganizationId: "example-programs",
              targetOrganizationId: "credit-institution",
              targetInstitutionName: null,
              relationshipType: "credit_partnership",
              description: "A separately documented credit relationship.",
              scope,
            },
            "Credit partnership — Credit University Extension",
          ),
        },
        {
          id: "founder-relationship",
          assertion: assertion(
            "founder-relationship-claim",
            {
              subject: "founders",
              subjectOrganizationId: null,
              targetOrganizationId: "founder-institution",
              targetInstitutionName: null,
              relationshipType: "founders_affiliated_with",
              description: "A founder affiliation, not an institutional partnership.",
              scope,
            },
            "Founders affiliated with — Founder University",
          ),
        },
        {
          id: "mentor-relationship",
          assertion: assertion(
            "mentor-relationship-claim",
            {
              subject: "mentors",
              subjectOrganizationId: null,
              targetOrganizationId: "mentor-institution",
              targetInstitutionName: null,
              relationshipType: "mentors_affiliated_with",
              description: "Mentor affiliations, not operation or endorsement.",
              scope,
            },
            "Mentors affiliated with — Mentor Institute",
          ),
        },
      ],
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.operating_organization.displayValue).toBe("Example Programs");
    expect(card.facts.institution_relationship.displayValue).toBe(
      "Multiple institution relationships — see details",
    );
    expect(card.facts.institution_relationship.normalizedValue).toBeNull();
    expect(card.facts.relationship_explanation.displayValue).toContain("founder affiliation");
  });

  it("preserves tiered costs and refuses a misleading scalar total", () => {
    const candidate = baseRichCard("tiered-cost-fixture");
    candidate.variants = {
      status: "modeled",
      records: [
        {
          id: "standard-tier",
          definition: assertion(
            "standard-tier-definition",
            { label: "Standard", kind: "tier", parentVariantId: null },
            "Standard",
          ),
          eligibilityDifferences: [],
          notes: [],
        },
        {
          id: "premium-tier",
          definition: assertion(
            "premium-tier-definition",
            { label: "Premium", kind: "tier", parentVariantId: null },
            "Premium",
          ),
          eligibilityDifferences: [],
          notes: [],
        },
      ],
      note: null,
    };
    candidate.costItems = {
      status: "modeled",
      completeness: "complete",
      records: [
        {
          id: "standard-tuition",
          definition: assertion(
            "standard-tuition-definition",
            {
              label: "Standard tuition",
              kind: "tuition",
              requirement: "required",
              scope: { ...scope, variantIds: ["standard-tier"] },
            },
            "Standard tuition",
          ),
          amount: assertion(
            "standard-tuition-amount",
            { kind: "exact", amount: 3000, currency: "USD" },
            "$3,000",
          ),
          chargeBasis: assertion("standard-tuition-basis", "per_participant", "Per participant"),
          treatment: null,
          refundability: notFound("standard-refund"),
          includedItems: [],
          excludedItems: [],
          conditions: [],
        },
        {
          id: "premium-tuition",
          definition: assertion(
            "premium-tuition-definition",
            {
              label: "Premium tuition",
              kind: "tuition",
              requirement: "required",
              scope: { ...scope, variantIds: ["premium-tier"] },
            },
            "Premium tuition",
          ),
          amount: assertion(
            "premium-tuition-amount",
            { kind: "exact", amount: 6000, currency: "USD" },
            "$6,000",
          ),
          chargeBasis: assertion("premium-tuition-basis", "per_participant", "Per participant"),
          treatment: null,
          refundability: notFound("premium-refund"),
          includedItems: [],
          excludedItems: [],
          conditions: [],
        },
      ],
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.tuition.displayValue).toBe("Varies by program/cohort");
    expect(card.facts.tuition.normalizedValue).toBeNull();
    expect(card.facts.estimated_total_mandatory_cost.displayValue).toBe(
      "Varies by program/cohort",
    );
  });

  it("attaches only cost identity and amount evidence to a scalar cost projection", () => {
    const candidate = baseRichCard("cost-evidence-alignment-fixture");
    const amountEvidence = {
      ...evidence,
      id: "tuition-amount-page",
      url: "https://fixture.example/tuition",
      title: "Tuition",
      excerpt: "Program tuition is $4,500.",
    };
    const refundEvidence = {
      ...evidence,
      id: "refund-page",
      url: "https://fixture.example/refunds",
      title: "Refund terms",
      excerpt: "Refund requests are considered case by case.",
    };
    candidate.sourcePagesChecked = [
      page,
      {
        id: amountEvidence.id,
        url: amountEvidence.url,
        title: amountEvidence.title,
        pageType: amountEvidence.pageType,
        accessedAt: amountEvidence.accessedAt,
      },
      {
        id: refundEvidence.id,
        url: refundEvidence.url,
        title: refundEvidence.title,
        pageType: refundEvidence.pageType,
        accessedAt: refundEvidence.accessedAt,
      },
    ];
    const amount = assertion(
      "single-tuition-amount",
      { kind: "exact" as const, amount: 4500, currency: "USD" },
      "$4,500",
    );
    amount.sources = [amountEvidence];
    const refundability = assertion(
      "single-tuition-refundability",
      { kind: "conditional" as const, condition: "Considered case by case." },
      "Conditional",
    );
    refundability.sources = [refundEvidence];
    candidate.costItems = {
      status: "modeled",
      completeness: "incomplete",
      records: [
        {
          id: "single-tuition",
          definition: assertion(
            "single-tuition-definition",
            { label: "Program tuition", kind: "tuition", requirement: "required", scope },
            "Program tuition",
          ),
          amount,
          chargeBasis: null,
          treatment: null,
          refundability,
          includedItems: [],
          excludedItems: [],
          conditions: [],
        },
      ],
      note: "Other mandatory charges were not established.",
    };

    const card = parseProjected(candidate);
    expect(card.facts.tuition.displayValue).toBe("$4,500");
    expect(card.facts.tuition.sources.map((source) => source.excerpt)).toEqual([
      evidence.excerpt,
      amountEvidence.excerpt,
    ]);
    expect(card.facts.tuition.sources).not.toContainEqual(refundEvidence);
    expect(card.facts.tuition.projection?.claimRefs).toEqual([
      "single-tuition-definition",
      "single-tuition-amount",
    ]);
  });

  it("keeps shared deadlines scalar while preserving variant date ranges and formats", () => {
    const candidate = baseRichCard("variant-schedule-fixture");
    candidate.variants = {
      status: "modeled",
      records: [
        {
          id: "spring-cohort",
          definition: assertion(
            "spring-cohort-definition",
            { label: "Spring cohort", kind: "cohort", parentVariantId: null },
            "Spring cohort",
          ),
          eligibilityDifferences: [],
          notes: [],
        },
        {
          id: "summer-cohort",
          definition: assertion(
            "summer-cohort-definition",
            { label: "Summer cohort", kind: "cohort", parentVariantId: null },
            "Summer cohort",
          ),
          eligibilityDifferences: [],
          notes: [],
        },
      ],
      note: null,
    };
    const springScope = { ...scope, variantIds: ["spring-cohort"] };
    const summerScope = { ...scope, variantIds: ["summer-cohort"] };
    candidate.stages = {
      status: "modeled",
      records: [
        {
          id: "application-stage",
          order: 1,
          definition: assertion(
            "application-stage-definition",
            { label: "Application", kind: "application", scope },
            "Application",
          ),
          timings: [
            assertion(
              "shared-deadline",
              {
                event: "deadline",
                when: { precision: "date", date: "2027-01-15", certainty: "stated" },
                scope,
              },
              "January 15, 2027",
            ),
          ],
          durations: [],
          timeCommitments: [],
          formats: [],
          locations: [],
          selectionRules: [],
          advancement: [],
          requirements: [],
          travelRequirements: [],
        },
        {
          id: "program-stage",
          order: 2,
          definition: assertion(
            "program-stage-definition",
            { label: "Program", kind: "program", scope },
            "Program",
          ),
          timings: [
            assertion(
              "spring-start",
              { event: "starts", when: { precision: "date", date: "2027-03-01", certainty: "stated" }, scope: springScope },
              "March 1, 2027",
            ),
            assertion(
              "spring-end",
              { event: "ends", when: { precision: "date", date: "2027-04-30", certainty: "stated" }, scope: springScope },
              "April 30, 2027",
            ),
            assertion(
              "summer-start",
              { event: "starts", when: { precision: "date", date: "2027-06-01", certainty: "stated" }, scope: summerScope },
              "June 1, 2027",
            ),
            assertion(
              "summer-end",
              { event: "ends", when: { precision: "date", date: "2027-07-31", certainty: "stated" }, scope: summerScope },
              "July 31, 2027",
            ),
          ],
          durations: [],
          timeCommitments: [],
          formats: [
            assertion("spring-format", { formats: ["online"], scope: springScope }, "Online"),
            assertion("summer-format", { formats: ["residential"], scope: summerScope }, "Residential"),
          ],
          locations: [],
          selectionRules: [],
          advancement: [],
          requirements: [],
          travelRequirements: [],
        },
        {
          id: "ranking-stage",
          order: 2,
          definition: assertion(
            "ranking-stage-definition",
            {
              label: "College ranking",
              kind: "matching",
              scope: {
                variantIds: [] as string[],
                stageIds: ["ranking-stage"],
                pathwayIds: [] as string[],
              },
            },
            "College ranking",
          ),
          timings: [
            assertion(
              "ranking-deadline",
              {
                event: "deadline",
                when: { precision: "date", date: "2027-02-01", certainty: "stated" },
                scope: {
                  variantIds: [] as string[],
                  stageIds: ["ranking-stage"],
                  pathwayIds: [] as string[],
                },
              },
              "Ranking deadline: February 1, 2027",
            ),
          ],
          durations: [],
          timeCommitments: [],
          formats: [],
          locations: [],
          selectionRules: [],
          advancement: [],
          requirements: [],
          travelRequirements: [],
        },
      ],
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.application_deadline.displayValue).toBe("January 15, 2027");
    expect(card.facts.application_deadline.normalizedValue).toEqual({
      kind: "date",
      isoDate: "2027-01-15",
    });
    expect(card.facts.application_deadline.projection?.claimRefs).not.toContain(
      "ranking-deadline",
    );
    expect(card.facts.start_date.displayValue).toBe("Varies by program/cohort");
    expect(card.facts.end_date.displayValue).toBe("Varies by program/cohort");
    expect(card.facts.participation_format.displayValue).toBe("Varies by program/cohort");
    expect(card.facts.participation_format.normalizedValue).toBeNull();
    expect(card.stages.status === "modeled" ? card.stages.records[1].timings : []).toHaveLength(4);
  });

  it("projects a simple ordered stage ledger as a linear process", () => {
    const candidate = baseRichCard("linear-process-fixture");
    const stage = (id: string, order: number, label: string, kind: "application" | "interview") => ({
      id,
      order,
      definition: assertion(`${id}-definition`, { label, kind, scope }, label),
      timings: [],
      durations: [],
      timeCommitments: [],
      formats: [],
      locations: [],
      selectionRules: [],
      advancement: [],
      requirements: [],
      travelRequirements: [],
    });
    candidate.stages = {
      status: "modeled",
      records: [
        stage("application-stage", 1, "Application", "application"),
        stage("interview-stage", 2, "Interview", "interview"),
      ],
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.selection_process.displayValue).toBe("Application \u2192 Interview");
    expect(card.facts.selection_process.projection?.claimRefs).toEqual([
      "application-stage-definition",
      "interview-stage-definition",
    ]);
  });

  it("does not present post-admission program delivery as part of selection", () => {
    const candidate = baseRichCard("selection-versus-delivery-fixture");
    const stage = (
      id: string,
      order: number,
      label: string,
      kind: "application" | "interview" | "program" | "other",
    ) => ({
      id,
      order,
      definition: assertion(`${id}-definition`, { label, kind, scope }, label),
      timings: [],
      durations: [],
      timeCommitments: [],
      formats: [],
      locations: [],
      selectionRules: [],
      advancement: [],
      requirements: [],
      travelRequirements: [],
    });
    candidate.stages = {
      status: "modeled",
      records: [
        stage("application-stage", 1, "Application", "application"),
        stage("interview-stage", 2, "Interview", "interview"),
        stage("program-stage", 3, "Six-week program", "program"),
        stage("demo-stage", 4, "Program demo day", "other"),
      ],
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.selection_process.displayValue).toBe("Application → Interview");
    expect(card.facts.selection_process.projection?.claimRefs).not.toContain(
      "program-stage-definition",
    );
    expect(card.facts.selection_process.projection?.claimRefs).not.toContain(
      "demo-stage-definition",
    );
  });

  it("treats one modeled pathway as authoritative instead of inserting unrelated stages", () => {
    const candidate = baseRichCard("single-pathway-fixture");
    const stage = (
      id: string,
      order: number,
      label: string,
      kind: "application" | "interview" | "other",
    ) => ({
      id,
      order,
      definition: assertion(`${id}-definition`, { label, kind, scope }, label),
      timings: [],
      durations: [],
      timeCommitments: [],
      formats: [],
      locations: [],
      selectionRules: [],
      advancement: [],
      requirements: [],
      travelRequirements: [],
    });
    candidate.stages = {
      status: "modeled",
      records: [
        stage("application-stage", 1, "Apply", "application"),
        stage("interview-stage", 2, "Interview", "interview"),
        stage("optional-workshop-stage", 3, "Optional workshop", "other"),
      ],
      note: null,
    };
    candidate.pathways = {
      status: "modeled",
      records: [
        {
          id: "primary-pathway",
          definition: assertion(
            "primary-pathway-definition",
            { label: "Primary route", variantIds: [] as string[] },
            "Primary route",
          ),
          steps: [
            assertion(
              "primary-pathway-application-step",
              { stageId: "application-stage", enterWhen: null },
              "Apply",
            ),
            assertion(
              "primary-pathway-interview-step",
              { stageId: "interview-stage", enterWhen: "Invited after review" },
              "Interview",
            ),
          ],
        },
      ],
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.selection_process.displayValue).toBe("Primary route: Apply → Interview");
    expect(card.facts.selection_process.displayValue).not.toContain("Optional workshop");
    expect(card.facts.selection_process.projection?.claimRefs).not.toContain(
      "optional-workshop-stage-definition",
    );
  });

  it("preserves branching pathways and stage-specific deadlines", () => {
    const candidate = baseRichCard("branching-fixture");
    const stage = (id: string, order: number, label: string, kind: "application" | "pitch" | "summit_final") => ({
      id,
      order,
      definition: assertion(
        `${id}-definition`,
        { label, kind, scope },
        label,
      ),
      timings: id === "application-stage"
        ? [
            assertion(
              "application-deadline",
              {
                event: "deadline",
                when: { precision: "date", date: "2027-01-14", certainty: "stated" },
                scope,
              },
              "January 14, 2027",
            ),
          ]
        : [],
      durations: [],
      timeCommitments: [],
      formats: [],
      locations: [],
      selectionRules: [],
      advancement: [],
      requirements: [],
      travelRequirements: [],
    });
    candidate.stages = {
      status: "modeled",
      records: [
        stage("application-stage", 1, "Submission", "application"),
        stage("live-pitch-stage", 2, "Live pitch", "pitch"),
        stage("virtual-pitch-stage", 2, "Virtual pitch", "pitch"),
        stage("summit-stage", 3, "Final summit", "summit_final"),
      ],
      note: null,
    };
    const pathway = (id: string, label: string, pitchStage: string) => ({
      id,
      definition: assertion(`${id}-definition`, { label, variantIds: [] as string[] }, label),
      steps: [
        assertion(`${id}-application-step`, { stageId: "application-stage", enterWhen: null }, "Submission"),
        assertion(`${id}-pitch-step`, { stageId: pitchStage, enterWhen: "Selected for this route" }, label),
        assertion(`${id}-summit-step`, { stageId: "summit-stage", enterWhen: "Named a finalist" }, "Final summit"),
      ],
    });
    candidate.pathways = {
      status: "modeled",
      records: [
        pathway("live-pathway", "Live pathway", "live-pitch-stage"),
        pathway("virtual-pathway", "Virtual pathway", "virtual-pitch-stage"),
      ],
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.application_deadline.displayValue).toBe("January 14, 2027");
    expect(card.facts.selection_process.displayValue).toContain("Live pathway");
    expect(card.facts.selection_process.displayValue).toContain("Virtual pathway");
  });

  it("distinguishes several deadlines in one application stage from scoped deadline variation", () => {
    const candidate = baseRichCard("multiple-application-deadlines-fixture");
    const applicationScope = {
      variantIds: [] as string[],
      stageIds: ["application-stage"],
      pathwayIds: [] as string[],
    };
    candidate.stages = {
      status: "modeled",
      records: [
        {
          id: "application-stage",
          order: 1,
          definition: assertion(
            "application-stage-definition",
            { label: "Application", kind: "application", scope: applicationScope },
            "Application",
          ),
          timings: [
            assertion(
              "early-application-deadline",
              {
                event: "deadline",
                when: { precision: "date", date: "2027-01-08", certainty: "stated" },
                scope: applicationScope,
              },
              "Early deadline: January 8, 2027",
            ),
            assertion(
              "final-application-deadline",
              {
                event: "deadline",
                when: { precision: "date", date: "2027-01-22", certainty: "stated" },
                scope: applicationScope,
              },
              "Final deadline: January 22, 2027",
            ),
          ],
          durations: [],
          timeCommitments: [],
          formats: [],
          locations: [],
          selectionRules: [],
          advancement: [],
          requirements: [],
          travelRequirements: [],
        },
      ],
      note: null,
    };

    const sameStage = parseProjected(candidate);
    expect(sameStage.facts.application_deadline.displayValue).toBe(
      "Multiple application deadlines — see schedule",
    );
    expect(sameStage.facts.application_deadline.note).toBe(
      "Early deadline: January 8, 2027; Final deadline: January 22, 2027",
    );
    expect(sameStage.facts.application_deadline.projection?.claimRefs).toEqual([
      "early-application-deadline",
      "final-application-deadline",
    ]);

    if (candidate.stages.status !== "modeled") throw new Error("fixture setup failed");
    const [early, final] = candidate.stages.records[0].timings;
    if (early.status !== "disclosed" || final.status !== "disclosed") {
      throw new Error("fixture setup failed");
    }
    early.value.scope = applicationScope;
    candidate.variants = {
      status: "modeled",
      records: [{
        id: "priority-cohort",
        definition: assertion(
          "priority-cohort-definition",
          { label: "Priority cohort", kind: "cohort", parentVariantId: null },
          "Priority cohort",
        ),
        eligibilityDifferences: [],
        notes: [],
      }],
      note: null,
    };
    final.value.scope = { ...applicationScope, variantIds: ["priority-cohort"] };

    const differentlyScoped = parseProjected(candidate);
    expect(differentlyScoped.facts.application_deadline.displayValue).toBe(
      "Varies by program/cohort",
    );
  });

  it("never projects restricted project funding as participant cash", () => {
    const candidate = baseRichCard("project-funding-fixture");
    candidate.outcomes = {
      status: "modeled",
      records: [
        {
          id: "build-funding",
          definition: assertion(
            "build-funding-definition",
            { label: "$1,500 experiment build funding", outcomeType: "project_budget", scope },
            "$1,500 experiment build funding",
          ),
          recipientScope: assertion("build-funding-recipient", "team", "Team"),
          monetaryNature: assertion(
            "build-funding-nature",
            "restricted_funding",
            "Restricted project funding",
          ),
          amount: assertion(
            "build-funding-amount",
            { kind: "exact", amount: 1500, currency: "USD" },
            "$1,500",
          ),
          distribution: null,
          rank: null,
          track: null,
          quantity: null,
          useRestriction: assertion(
            "build-funding-restriction",
            "May be used only to build the selected experiment.",
            "Restricted to experiment construction",
          ),
          combinability: null,
          conditions: [],
        },
      ],
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.cash_award.status).toBe("not_found");
    expect(card.facts.other_benefits.displayValue).toContain("experiment build funding");
    expect(card.facts.other_benefits.normalizedValue).toEqual({
      kind: "text_list",
      values: ["$1,500 experiment build funding"],
    });
  });

  it("keeps a multi-track team prize matrix instead of selecting one award", () => {
    const candidate = baseRichCard("prize-matrix-fixture");
    candidate.variants = {
      status: "modeled",
      records: [
        {
          id: "business-track",
          definition: assertion(
            "business-track-definition",
            { label: "Business Innovation", kind: "track", parentVariantId: null },
            "Business Innovation",
          ),
          eligibilityDifferences: [],
          notes: [],
        },
        {
          id: "social-track",
          definition: assertion(
            "social-track-definition",
            { label: "Social Innovation", kind: "track", parentVariantId: null },
            "Social Innovation",
          ),
          eligibilityDifferences: [],
          notes: [],
        },
      ],
      note: null,
    };
    candidate.outcomes = {
      status: "modeled",
      records: [
        ["business", "business-track", 1, 12000],
        ["business", "business-track", 2, 8000],
        ["social", "social-track", 1, 12000],
        ["social", "social-track", 2, 8000],
      ].map(([prefix, variantId, ordinal, amount]) => ({
        id: `${prefix}-${ordinal}-award`,
        definition: assertion(
          `${prefix}-${ordinal}-definition`,
          {
            label: `${prefix} ${ordinal} award`,
            outcomeType: "team_cash_prize",
            scope: { ...scope, variantIds: [String(variantId)] },
          },
          `${prefix} ${ordinal} award`,
        ),
        recipientScope: assertion(`${prefix}-${ordinal}-recipient`, "team", "Team"),
        monetaryNature: assertion(`${prefix}-${ordinal}-nature`, "cash", "Cash"),
        amount: assertion(
          `${prefix}-${ordinal}-amount`,
          { kind: "exact", amount: Number(amount), currency: "USD" },
          `$${Number(amount).toLocaleString("en-US")}`,
        ),
        distribution: assertion(
          `${prefix}-${ordinal}-distribution`,
          [{ payee: "registered_venture", method: "direct", condition: "Otherwise divided equally." }],
          "Paid to the venture when eligible; otherwise divided equally",
        ),
        rank: assertion(
          `${prefix}-${ordinal}-rank`,
          { ordinal: Number(ordinal), label: `${ordinal} place` },
          `${ordinal} place`,
        ),
        track: assertion(`${prefix}-${ordinal}-track`, String(variantId), String(variantId)),
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [],
      })),
      note: null,
    };

    const card = parseProjected(candidate);
    expect(card.facts.cash_award.displayValue).toBe(
      "Multiple cash awards — see prize details",
    );
    expect(card.facts.cash_award.normalizedValue).toBeNull();
    expect(card.outcomes.status === "modeled" ? card.outcomes.records : []).toHaveLength(4);
  });

  it("rejects stale summary projections and dangling structured references", () => {
    const card = parseProjected(baseRichCard("projection-guard"));
    expect(() =>
      opportunityCardSchema.parse({
        ...card,
        facts: {
          ...card.facts,
          operating_organization: {
            ...card.facts.operating_organization,
            value: "Different operator",
            displayValue: "Different operator",
          },
        },
      }),
    ).toThrow(/deterministic v2 projection/i);

    const candidate = baseRichCard("dangling-scope");
    if (candidate.organizationRoles.status !== "modeled") throw new Error("fixture setup failed");
    candidate.organizationRoles.records[0].role.value.scope.variantIds = ["missing-variant"];
    expect(() => parseProjected(candidate)).toThrow(/unknown variant/i);
  });
});
