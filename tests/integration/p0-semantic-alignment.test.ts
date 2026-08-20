import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createEmptyModelStructures,
  extractOpportunityCard,
  type AnalysisSourceContext,
} from "@/lib/analysis/model-extraction";
import {
  createEmptyFacts,
  factSchema,
  type EvidenceSource,
  type OpportunityFacts,
} from "@/lib/opportunity";

const ACCESSED_AT = "2026-08-20T00:00:00.000Z";
const SOURCE_ID = "page-program";
const SOURCE_URL = "https://program.example/current";

function evidence(excerpt: string): EvidenceSource {
  return {
    id: SOURCE_ID,
    url: SOURCE_URL,
    title: "Current Program",
    pageType: "user_supplied",
    accessedAt: ACCESSED_AT,
    excerpt,
  };
}

function claim<const T>(
  claimId: string,
  value: T,
  displayValue: string,
  excerpt: string,
) {
  return {
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources: [evidence(excerpt)],
    note: null,
    conflictingValues: [],
  };
}

function sourceContext(excerpts: readonly string[]): AnalysisSourceContext {
  const text = ["2026 program cycle", ...excerpts].join("\n");
  return {
    accessedAt: ACCESSED_AT,
    page: {
      id: SOURCE_ID,
      url: SOURCE_URL,
      title: "Current Program",
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text,
      blocks: text.split("\n").map((blockText, index) => ({
        kind: index === 0 ? "heading" as const : "paragraph" as const,
        text: blockText,
      })),
      links: [],
      truncated: false,
    },
  };
}

async function runCandidate(
  facts: OpportunityFacts,
  structures: ReturnType<typeof createEmptyModelStructures>,
  excerpts: readonly string[],
) {
  const source = sourceContext(excerpts);
  return extractOpportunityCard(
    [source],
    async () => ({ facts, structures }),
  );
}

describe("fail-closed semantic alignment", () => {
  it("represents same-excerpt application-plan fees as conditional alternatives, not a conflict", async () => {
    const excerpt =
      "In your Applicant Status Portal, pay the $85 USD Early Action fee or $100 USD Regular Decision fee.";
    const facts = createEmptyFacts();
    facts.application_fee = factSchema.parse({
      status: "conflicting",
      conflictingValues: [
        {
          value: "USD 85",
          displayValue: "$85 USD - Early Action",
          sources: [evidence(excerpt)],
        },
        {
          value: "USD 100",
          displayValue: "$100 USD - Regular Decision",
          sources: [evidence(excerpt)],
        },
      ],
    });

    const result = await runCandidate(
      facts,
      createEmptyModelStructures(),
      [excerpt],
    );

    expect(result.card.facts.application_fee.status).toBe("disclosed");
    expect(result.card.facts.application_fee.displayValue).toBe(
      "Multiple application fees \u2014 see cost details",
    );
    expect(result.card.facts.application_fee.sources).toHaveLength(1);
    expect(result.card.facts.application_fee.note).toMatch(/plan-specific alternatives/i);
  });

  it("withholds flat money and date values that do not match their exact excerpts", async () => {
    const deadlineExcerpt = "Applications are due September 3, 2026.";
    const cashExcerpt = "Winners receive a $5,000 cash award.";
    const facts = createEmptyFacts();
    facts.application_deadline = factSchema.parse({
      status: "disclosed",
      value: "September 30, 2026",
      displayValue: "September 30, 2026",
      claimKind: "source_stated",
      sources: [evidence(deadlineExcerpt)],
    });
    facts.cash_award = factSchema.parse({
      status: "disclosed",
      value: "USD 50000",
      displayValue: "$50,000 USD",
      claimKind: "source_stated",
      sources: [evidence(cashExcerpt)],
    });

    const result = await runCandidate(
      facts,
      createEmptyModelStructures(),
      [deadlineExcerpt, cashExcerpt],
    );

    expect(result.card.facts.application_deadline.status).toBe("unclear");
    expect(result.card.facts.cash_award.status).toBe("unclear");
    expect(result.card.facts.application_deadline.note).toMatch(/date does not match/i);
    expect(result.card.facts.cash_award.note).toMatch(/money amount or currency does not match/i);
  });

  it("checks an ambiguous-currency money amount even when normalization stays null", async () => {
    const excerpt = "The winner receives a $5,000 cash award.";
    const facts = createEmptyFacts();
    facts.cash_award = factSchema.parse({
      status: "disclosed",
      value: "$50,000",
      displayValue: "$50,000",
      normalizedValue: null,
      claimKind: "source_stated",
      sources: [evidence(excerpt)],
    });

    const result = await runCandidate(
      facts,
      createEmptyModelStructures(),
      [excerpt],
    );

    expect(result.card.facts.cash_award.status).toBe("unclear");
    expect(result.card.facts.cash_award.note).toMatch(/money amount does not match/i);
  });

  it.each([
    {
      fieldId: "ages" as const,
      value: "Ages 16 to 18",
      displayValue: "16-18 years old",
      excerpt: "Applicants must be between the ages of 13 and 15.",
      reason: /age value does not match/i,
    },
    {
      fieldId: "grade_levels" as const,
      value: ["10th grade"],
      displayValue: "High school sophomores",
      excerpt: "The program is open to 11th graders.",
      reason: /grade-level value does not match/i,
    },
    {
      fieldId: "geographic_restrictions" as const,
      value: "California residents only",
      displayValue: "California residents",
      excerpt: "Applicants must reside in Texas.",
      reason: /geography does not match/i,
    },
    {
      fieldId: "citizenship_restrictions" as const,
      value: "Canadian citizens",
      displayValue: "Canadian citizens only",
      excerpt: "Applicants must be United States citizens or permanent residents.",
      reason: /citizenship or residency value does not match/i,
    },
  ])("withholds a mismatched $fieldId eligibility value", async ({
    fieldId,
    value,
    displayValue,
    excerpt,
    reason,
  }) => {
    const facts = createEmptyFacts();
    facts[fieldId] = factSchema.parse({
      status: "disclosed",
      value,
      displayValue,
      claimKind: "source_stated",
      sources: [evidence(excerpt)],
    });

    const result = await runCandidate(
      facts,
      createEmptyModelStructures(),
      [excerpt],
    );

    expect(result.card.facts[fieldId].status).toBe("unclear");
    expect(result.card.facts[fieldId].note).toMatch(reason);
  });

  it("withholds individual entry when the source states only team entry", async () => {
    const excerpt = "Teams of 2 to 4 students may enter.";
    const facts = createEmptyFacts();
    facts.entry_format = factSchema.parse({
      status: "disclosed",
      value: "Individual entry",
      displayValue: "Individual only",
      claimKind: "source_stated",
      sources: [evidence(excerpt)],
    });

    const result = await runCandidate(facts, createEmptyModelStructures(), [excerpt]);
    expect(result.card.facts.entry_format.status).toBe("unclear");
    expect(result.card.facts.entry_format.note).toMatch(/individual entry is not explicitly stated/i);
  });

  it("accepts equivalent United States and U.S. geography wording", async () => {
    const excerpt = "Applicants must reside in the U.S.";
    const facts = createEmptyFacts();
    facts.geographic_restrictions = factSchema.parse({
      status: "disclosed",
      value: "United States residents",
      displayValue: "U.S. residents",
      claimKind: "source_stated",
      sources: [evidence(excerpt)],
    });

    const result = await runCandidate(facts, createEmptyModelStructures(), [excerpt]);
    expect(result.card.facts.geographic_restrictions.status).toBe("disclosed");
  });

  it("withholds a required sponsor claim sourced only by an optional recommendation", async () => {
    const excerpt = "Applicants may optionally submit a teacher recommendation.";
    const facts = createEmptyFacts();
    facts.sponsor_requirement = factSchema.parse({
      status: "disclosed",
      value: "Teacher recommendation required",
      displayValue: "Teacher recommendation required",
      claimKind: "source_stated",
      sources: [evidence(excerpt)],
    });

    const result = await runCandidate(facts, createEmptyModelStructures(), [excerpt]);
    expect(result.card.facts.sponsor_requirement.status).toBe("unclear");
    expect(result.card.facts.sponsor_requirement.note).toMatch(/modality is not stated/i);
  });

  it("withholds an operator role that points at a different organization", async () => {
    const operatorExcerpt = "Alpha Foundation operates this program.";
    const funderExcerpt = "Funding support is provided by Beta LLC.";
    const structures = createEmptyModelStructures();
    structures.organizations = {
      status: "modeled",
      note: null,
      records: [
        {
          id: "alpha",
          name: claim("alpha-name", "Alpha Foundation", "Alpha Foundation", operatorExcerpt),
          kind: claim("alpha-kind", "education_provider", "Education provider", operatorExcerpt),
        },
        {
          id: "beta",
          name: claim("beta-name", "Beta LLC", "Beta LLC", funderExcerpt),
          kind: claim("beta-kind", "private_company", "Private company", funderExcerpt),
        },
      ],
    };
    structures.organizationRoles = {
      status: "modeled",
      note: null,
      records: [{
        id: "operator-role",
        organizationId: "beta",
        role: claim(
          "operator-role-claim",
          {
            role: "operator",
            roleLabel: null,
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "Operator",
          operatorExcerpt,
        ),
      }],
    };

    const result = await runCandidate(
      createEmptyFacts(),
      structures,
      [operatorExcerpt, funderExcerpt],
    );

    expect(result.card.organizationRoles.status).toBe("unassessed");
    expect(result.card.facts.operating_organization.status).toBe("not_found");
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldId: "structured.organizationRoles",
        message: expect.stringMatching(/referenced organization/i),
      }),
    ]));
  });

  it("withholds a relationship whose target institution is not named by its excerpt", async () => {
    const alphaExcerpt = "Alpha University partners with the program for academic credit.";
    const betaExcerpt = "Beta University offers undergraduate courses.";
    const structures = createEmptyModelStructures();
    structures.organizations = {
      status: "modeled",
      note: null,
      records: [{
        id: "beta-university",
        name: claim("beta-university-name", "Beta University", "Beta University", betaExcerpt),
        kind: claim("beta-university-kind", "higher_education_institution", "University", betaExcerpt),
      }],
    };
    structures.institutionRelationships = {
      status: "modeled",
      note: null,
      records: [{
        id: "credit-relationship",
        assertion: claim(
          "credit-relationship-claim",
          {
            subject: "opportunity",
            subjectOrganizationId: null,
            targetOrganizationId: "beta-university",
            targetInstitutionName: null,
            relationshipType: "credit_partnership",
            description: "Academic credit partner",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "Credit partnership with Beta University",
          alphaExcerpt,
        ),
      }],
    };

    const result = await runCandidate(
      createEmptyFacts(),
      structures,
      [alphaExcerpt, betaExcerpt],
    );

    expect(result.card.institutionRelationships.status).toBe("unassessed");
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldId: "structured.institutionRelationships",
        message: expect.stringMatching(/referenced institution/i),
      }),
    ]));
  });

  it("does not promote an optional service into required tuition", async () => {
    const excerpt = "An optional premium mentoring package costs $4,500.";
    const facts = createEmptyFacts();
    facts.tuition = factSchema.parse({
      status: "disclosed",
      value: 4_500,
      displayValue: "$4,500 USD",
      normalizedValue: {
        kind: "money",
        amount: 4_500,
        currency: "USD",
        classification: "fee",
      },
      claimKind: "source_stated",
      sources: [evidence(excerpt)],
    });
    const structures = createEmptyModelStructures();
    structures.costItems = {
      status: "modeled",
      note: null,
      completeness: "incomplete",
      records: [{
        id: "premium-package",
        definition: claim(
          "premium-package-definition",
          {
            label: "Premium tuition",
            kind: "tuition",
            requirement: "required",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "Required premium tuition",
          excerpt,
        ),
        amount: claim(
          "premium-package-amount",
          { kind: "exact", amount: 4_500, currency: "USD" },
          "$4,500 USD",
          excerpt,
        ),
        chargeBasis: null,
        treatment: null,
        refundability: null,
        includedItems: [],
        excludedItems: [],
        conditions: [],
      }],
    };

    const result = await runCandidate(facts, structures, [excerpt]);
    expect(result.card.costItems.status).toBe("unassessed");
    expect(result.card.facts.tuition.status).toBe("unclear");
  });

  it("keeps a supported optional cost in detail without calling it mandatory", async () => {
    const excerpt = "An optional portfolio review add-on costs $100.";
    const structures = createEmptyModelStructures();
    structures.costItems = {
      status: "modeled",
      note: null,
      completeness: "incomplete",
      records: [{
        id: "optional-review",
        definition: claim(
          "optional-review-definition",
          {
            label: "Optional portfolio review",
            kind: "other",
            requirement: "optional",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "Optional portfolio review add-on",
          excerpt,
        ),
        amount: claim(
          "optional-review-amount",
          { kind: "exact", amount: 100, currency: "USD" },
          "$100 USD",
          excerpt,
        ),
        chargeBasis: null,
        treatment: null,
        refundability: null,
        includedItems: [],
        excludedItems: [],
        conditions: [],
      }],
    };

    const result = await runCandidate(createEmptyFacts(), structures, [excerpt]);
    expect(result.card.costItems.status).toBe("modeled");
    expect(result.card.facts.other_mandatory_costs.status).toBe("not_found");
    expect(result.card.facts.estimated_total_mandatory_cost.status).toBe("not_found");
  });

  it("retains tuition when official terms call it a plural program fee", async () => {
    const definitionExcerpt = "Program fees are due at the time of enrollment.";
    const amountExcerpt = "Tuition: $4,500. Merit scholarships and financial aid are available.";
    const structures = createEmptyModelStructures();
    structures.costItems = {
      status: "modeled",
      note: null,
      completeness: "incomplete",
      records: [{
        id: "program-tuition",
        definition: claim(
          "program-tuition-definition",
          {
            label: "Program tuition",
            kind: "tuition",
            requirement: "required",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "Program tuition",
          definitionExcerpt,
        ),
        amount: claim(
          "program-tuition-amount",
          { kind: "exact", amount: 4_500, currency: "USD" },
          "$4,500 USD",
          amountExcerpt,
        ),
        chargeBasis: null,
        treatment: null,
        refundability: null,
        includedItems: [],
        excludedItems: [],
        conditions: [],
      }],
    };

    const result = await runCandidate(
      createEmptyFacts(),
      structures,
      [definitionExcerpt, amountExcerpt],
    );
    expect(result.card.costItems.status).toBe("modeled");
    expect(result.card.facts.tuition.displayValue).toBe("$4,500 USD");
    expect(result.card.facts.estimated_total_mandatory_cost.status).toBe("unclear");
  });

  it("never projects restricted build funding as participant or team cash", async () => {
    const excerpt = "Each selected team receives $1,500 to build its experiment.";
    const facts = createEmptyFacts();
    facts.cash_award = factSchema.parse({
      status: "disclosed",
      value: 1_500,
      displayValue: "$1,500 USD",
      normalizedValue: {
        kind: "money",
        amount: 1_500,
        currency: "USD",
        classification: "cash",
      },
      claimKind: "source_stated",
      sources: [evidence(excerpt)],
    });
    const structures = createEmptyModelStructures();
    structures.outcomes = {
      status: "modeled",
      note: null,
      records: [{
        id: "build-funding",
        definition: claim(
          "build-funding-definition",
          {
            label: "$1,500 experiment build funding",
            outcomeType: "team_cash_prize",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "$1,500 experiment build funding",
          excerpt,
        ),
        recipientScope: claim("build-funding-recipient", "team", "Team", excerpt),
        monetaryNature: null,
        amount: claim(
          "build-funding-amount",
          { kind: "exact", amount: 1_500, currency: "USD" },
          "$1,500 USD",
          excerpt,
        ),
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [],
      }],
    };

    const result = await runCandidate(facts, structures, [excerpt]);
    expect(result.card.outcomes.status).toBe("unassessed");
    expect(result.card.facts.cash_award.status).toBe("unclear");
  });

  it("retains an educator cash prize without projecting it as participant cash", async () => {
    const excerpt = "The winning teacher receives a $1,000 cash prize.";
    const structures = createEmptyModelStructures();
    structures.outcomes = {
      status: "modeled",
      note: null,
      records: [{
        id: "teacher-prize",
        definition: claim(
          "teacher-prize-definition",
          {
            label: "$1,000 teacher cash prize",
            outcomeType: "educator_cash_prize",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "$1,000 teacher cash prize",
          excerpt,
        ),
        recipientScope: claim("teacher-prize-recipient", "educator", "Teacher", excerpt),
        monetaryNature: claim("teacher-prize-nature", "cash", "Cash", excerpt),
        amount: claim(
          "teacher-prize-amount",
          { kind: "exact", amount: 1_000, currency: "USD" },
          "$1,000 USD",
          excerpt,
        ),
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [],
      }],
    };

    const result = await runCandidate(createEmptyFacts(), structures, [excerpt]);
    expect(result.evidenceWarnings).toEqual([]);
    expect(result.card.outcomes.status).toBe("modeled");
    expect(result.card.facts.cash_award.status).toBe("not_found");
    expect(result.card.facts.other_benefits.status).toBe("not_found");
  });

  it("does not project external college admission as a seat in the target opportunity", async () => {
    const externalExcerpt =
      "Through the Match program, finalists are admitted early with a full four-year scholarship to the school with which they matched.";
    const facts = createEmptyFacts();
    facts.program_seat = factSchema.parse({
      status: "disclosed",
      value: "Early admission to a matched college",
      displayValue: "Early admission to a matched college",
      claimKind: "source_stated",
      sources: [evidence(externalExcerpt)],
    });
    const structures = createEmptyModelStructures();
    structures.outcomes = {
      status: "modeled",
      note: null,
      records: [{
        id: "external-college-admission",
        definition: claim(
          "external-college-admission-definition",
          {
            label: "Early admission to a matched college",
            outcomeType: "program_seat",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "Early admission to a matched college",
          externalExcerpt,
        ),
        recipientScope: claim(
          "external-college-admission-recipient",
          "individual",
          "Matched finalist",
          externalExcerpt,
        ),
        monetaryNature: null,
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [],
      }],
    };

    const result = await runCandidate(facts, structures, [externalExcerpt]);
    expect(result.card.outcomes.status).toBe("unassessed");
    expect(result.card.facts.program_seat.status).toBe("unclear");
    expect(result.card.facts.program_seat.note).toMatch(/external college|external.*school/i);
  });

  it("retains and projects an explicitly opportunity-bound program seat", async () => {
    const excerpt = "Selected applicants receive a fully funded seat in this summer program.";
    const structures = createEmptyModelStructures();
    structures.outcomes = {
      status: "modeled",
      note: null,
      records: [{
        id: "summer-program-seat",
        definition: claim(
          "summer-program-seat-definition",
          {
            label: "Fully funded summer-program seat",
            outcomeType: "program_seat",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "Fully funded summer-program seat",
          excerpt,
        ),
        recipientScope: claim(
          "summer-program-seat-recipient",
          "individual",
          "Selected applicant",
          excerpt,
        ),
        monetaryNature: null,
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [],
      }],
    };

    const result = await runCandidate(createEmptyFacts(), structures, [excerpt]);
    expect(result.card.outcomes.status).toBe("modeled");
    expect(result.card.facts.program_seat.status).toBe("disclosed");
    expect(result.card.facts.program_seat.displayValue).toBe("Fully funded summer-program seat");
  });

  it("rejects a teacher prize mislabeled as personal participant cash", async () => {
    const excerpt = "The winning teacher receives a $1,000 cash prize.";
    const structures = createEmptyModelStructures();
    structures.outcomes = {
      status: "modeled",
      note: null,
      records: [{
        id: "misclassified-teacher-prize",
        definition: claim(
          "misclassified-teacher-prize-definition",
          {
            label: "$1,000 personal cash prize",
            outcomeType: "personal_cash_prize",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "$1,000 personal cash prize",
          excerpt,
        ),
        recipientScope: claim(
          "misclassified-teacher-prize-recipient",
          "individual",
          "Individual",
          excerpt,
        ),
        monetaryNature: claim(
          "misclassified-teacher-prize-nature",
          "cash",
          "Cash",
          excerpt,
        ),
        amount: claim(
          "misclassified-teacher-prize-amount",
          { kind: "exact", amount: 1_000, currency: "USD" },
          "$1,000 USD",
          excerpt,
        ),
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [],
      }],
    };

    const result = await runCandidate(createEmptyFacts(), structures, [excerpt]);
    expect(result.card.outcomes.status).toBe("unassessed");
    expect(result.card.facts.cash_award.status).toBe("not_found");
  });

  it("salvages a valid outcome when a sibling outcome violates cash-nature integrity", async () => {
    const mentorshipExcerpt = "Participants receive weekly mentorship from researchers.";
    const cashExcerpt = "The winner receives a $5,000 cash award.";
    const structures = createEmptyModelStructures();
    structures.outcomes = {
      status: "modeled",
      note: null,
      records: [
        {
          id: "weekly-mentorship",
          definition: claim(
            "weekly-mentorship-definition",
            {
              label: "Weekly research mentorship",
              outcomeType: "mentorship",
              scope: { variantIds: [], stageIds: [], pathwayIds: [] },
            },
            "Weekly research mentorship",
            mentorshipExcerpt,
          ),
          recipientScope: claim(
            "weekly-mentorship-recipient",
            "individual",
            "Participants",
            mentorshipExcerpt,
          ),
          monetaryNature: null,
          amount: null,
          distribution: null,
          rank: null,
          track: null,
          quantity: null,
          useRestriction: null,
          combinability: null,
          conditions: [],
        },
        {
          id: "cash-without-nature",
          definition: claim(
            "cash-without-nature-definition",
            {
              label: "$5,000 cash award",
              outcomeType: "personal_cash_prize",
              scope: { variantIds: [], stageIds: [], pathwayIds: [] },
            },
            "$5,000 cash award",
            cashExcerpt,
          ),
          recipientScope: claim(
            "cash-without-nature-recipient",
            "individual",
            "Winner",
            cashExcerpt,
          ),
          monetaryNature: null,
          amount: claim(
            "cash-without-nature-amount",
            { kind: "exact", amount: 5_000, currency: "USD" },
            "$5,000 USD",
            cashExcerpt,
          ),
          distribution: null,
          rank: null,
          track: null,
          quantity: null,
          useRestriction: null,
          combinability: null,
          conditions: [],
        },
      ],
    };

    const result = await runCandidate(
      createEmptyFacts(),
      structures,
      [mentorshipExcerpt, cashExcerpt],
    );

    expect(result.card.outcomes.status).toBe("modeled");
    expect(result.card.outcomes.records.map((outcome) => outcome.id)).toEqual([
      "weekly-mentorship",
    ]);
    expect(result.card.facts.mentorship.status).toBe("disclosed");
    expect(result.card.facts.cash_award.status).toBe("not_found");
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fieldId: "structured.outcomes",
        message: expect.stringMatching(/cash-without-nature.*withheld/i),
      }),
    ]));
  });

  it("retains an educator prize labeled by amount before 'Prize' when cash nature is separately evidenced", async () => {
    const definitionExcerpt = "If your entry wins, you will receive $50,000 Prize for your teacher.";
    const cashExcerpt = "The Teacher Inspiration Prize is a cash gift to the teacher, who may use the funds as they wish.";
    const structures = createEmptyModelStructures();
    structures.outcomes = {
      status: "modeled",
      note: null,
      records: [{
        id: "teacher-inspiration-prize",
        definition: claim(
          "teacher-inspiration-prize-definition",
          {
            label: "$50,000 Prize for your teacher",
            outcomeType: "educator_cash_prize",
            scope: { variantIds: [], stageIds: [], pathwayIds: [] },
          },
          "$50,000 Prize for your teacher",
          definitionExcerpt,
        ),
        recipientScope: claim(
          "teacher-inspiration-prize-recipient",
          "educator",
          "Teacher",
          cashExcerpt,
        ),
        monetaryNature: claim(
          "teacher-inspiration-prize-nature",
          "cash",
          "Cash gift",
          cashExcerpt,
        ),
        amount: claim(
          "teacher-inspiration-prize-amount",
          { kind: "exact", amount: 50_000, currency: "USD" },
          "$50,000 USD",
          definitionExcerpt,
        ),
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [],
      }],
    };

    const result = await runCandidate(
      createEmptyFacts(),
      structures,
      [definitionExcerpt, cashExcerpt],
    );

    expect(result.card.outcomes.status).toBe("modeled");
    if (result.card.outcomes.status !== "modeled") return;
    expect(result.card.outcomes.records.map((outcome) => outcome.id)).toEqual([
      "teacher-inspiration-prize",
    ]);
    expect(result.card.facts.cash_award.status).toBe("not_found");
    expect(result.card.facts.other_benefits.status).toBe("not_found");
  });

  it("withholds a mixed participant-and-school flat benefit instead of presenting the school award as participant value", async () => {
    const excerpt =
      "The winner receives a $250,000 scholarship and the winner's school receives a science lab valued up to $100,000.";
    const facts = createEmptyFacts();
    facts.other_benefits = factSchema.parse({
      status: "disclosed",
      value: [
        "$250,000 scholarship for the winner",
        "Science-lab benefit for the winner's school",
      ],
      displayValue: "Winner scholarship; science-lab benefit for winner's school",
      normalizedValue: {
        kind: "text_list",
        values: [
          "$250,000 scholarship for the winner",
          "Science-lab benefit for the winner's school",
        ],
      },
      sources: [evidence(excerpt)],
      claimKind: "source_stated",
    });

    const result = await runCandidate(
      facts,
      createEmptyModelStructures(),
      [excerpt],
    );

    expect(result.card.facts.other_benefits.status).toBe("unclear");
    expect(result.card.facts.other_benefits.note).toMatch(/school recipient/i);
  });

  it("withholds an automated mandatory total when no complete structured cost inventory exists", async () => {
    const excerpt = "Tuition: $4,500. Merit scholarships and financial aid are available.";
    const facts = createEmptyFacts();
    facts.tuition = factSchema.parse({
      status: "disclosed",
      value: "$4,500 USD",
      displayValue: "$4,500 USD",
      normalizedValue: { kind: "money", amount: 4_500, currency: "USD", classification: "fee" },
      sources: [evidence(excerpt)],
      claimKind: "source_stated",
    });
    facts.estimated_total_mandatory_cost = factSchema.parse({
      status: "disclosed",
      value: "$4,500 USD",
      displayValue: "$4,500 USD",
      normalizedValue: { kind: "money", amount: 4_500, currency: "USD", classification: "fee" },
      sources: [evidence(excerpt)],
      claimKind: "source_stated",
    });

    const result = await runCandidate(facts, createEmptyModelStructures(), [excerpt]);

    expect(result.card.facts.tuition.status).toBe("disclosed");
    expect(result.card.facts.estimated_total_mandatory_cost.status).toBe("unclear");
    expect(result.card.facts.estimated_total_mandatory_cost.note).toMatch(/complete structured inventory/i);
  });

  it("does not label organizer disciplinary removal as a participant cancellation policy", async () => {
    const excerpt =
      "We may remove any participant for disruptive or abusive behavior without a refund.";
    const facts = createEmptyFacts();
    facts.cancellation_policy = factSchema.parse({
      status: "disclosed",
      value: "Removal without refund",
      displayValue: "Removal without refund",
      sources: [evidence(excerpt)],
      claimKind: "source_stated",
    });

    const result = await runCandidate(facts, createEmptyModelStructures(), [excerpt]);

    expect(result.card.facts.cancellation_policy.status).toBe("unclear");
    expect(result.card.facts.cancellation_policy.note).toMatch(/disciplinary removal/i);
  });

  it("rejects activity-only advancement and a pathway notification unsupported by its excerpt", async () => {
    const applicationExcerpt = "Applicants submit the application before review.";
    const finalistExcerpt = "Selected applicants are notified as Finalists.";
    const programExcerpt = "Week 6 participants present their projects at program demo day.";
    const pathwayExcerpt = "All Finalists";
    const regularDecisionExcerpt =
      "Finalists can select colleges if not matched or if not participating in the Match.";
    const structures = createEmptyModelStructures();
    const stage = (id: string, order: number, label: string, kind: "application" | "finalist" | "program", excerpt: string) => ({
      id,
      order,
      definition: claim(
        `${id}-definition`,
        { label, kind, scope: { variantIds: [] as string[], stageIds: [] as string[], pathwayIds: [] as string[] } },
        label,
        excerpt,
      ),
      timings: [],
      durations: [],
      timeCommitments: [],
      formats: [],
      locations: [],
      selectionRules: [],
      advancement: id === "program"
        ? [claim(
            "program-demo-advancement",
            { count: null, description: "Week 6 presentation at program demo day", scope: { variantIds: [] as string[], stageIds: ["program"] as string[], pathwayIds: [] as string[] } },
            "Week 6 presentation at program demo day",
            programExcerpt,
          )]
        : [],
      requirements: [],
      travelRequirements: [],
    });
    structures.stages = {
      status: "modeled",
      note: null,
      records: [
        stage("application", 1, "Application", "application", applicationExcerpt),
        stage("finalist", 2, "Finalist notification", "finalist", finalistExcerpt),
        stage("program", 3, "Six-week program", "program", programExcerpt),
      ],
    };
    structures.pathways = {
      status: "modeled",
      note: null,
      records: [{
        id: "unsupported-notification-path",
        definition: claim(
          "unsupported-notification-path-definition",
          { label: "Primary pathway", variantIds: [] as string[] },
          "Primary pathway",
          applicationExcerpt,
        ),
        steps: [
          claim(
            "supported-application-step",
            { stageId: "application", enterWhen: null },
            "Submit the application",
            applicationExcerpt,
          ),
          claim(
            "unsupported-finalist-notification-step",
            { stageId: "finalist", enterWhen: "Applicant is selected as a Finalist" },
            "Finalist notification",
            pathwayExcerpt,
          ),
          claim(
            "supported-regular-decision-step",
            { stageId: "finalist", enterWhen: "Finalist is not matched" },
            "QuestBridge Regular Decision",
            regularDecisionExcerpt,
          ),
        ],
      }],
    };

    const result = await runCandidate(
      createEmptyFacts(),
      structures,
      [
        applicationExcerpt,
        finalistExcerpt,
        programExcerpt,
        pathwayExcerpt,
        regularDecisionExcerpt,
      ],
    );

    expect(result.card.stages.status).toBe("modeled");
    if (result.card.stages.status !== "modeled") return;
    expect(result.card.stages.records.find((record) => record.id === "program")?.advancement).toEqual([]);
    expect(result.card.pathways.status).toBe("modeled");
    if (result.card.pathways.status !== "modeled") return;
    expect(result.card.pathways.records[0]?.steps.map((step) => step.claimId)).toEqual([
      "supported-application-step",
      "supported-regular-decision-step",
    ]);
    expect(result.card.facts.selection_process.displayValue).toBe(
      "Primary pathway: Application → Finalist notification",
    );
    expect(result.evidenceWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "program-demo-advancement", message: expect.stringMatching(/program activity/i) }),
      expect.objectContaining({ sourceId: "unsupported-finalist-notification-step", message: expect.stringMatching(/pathway action/i) }),
    ]));
  });
});
