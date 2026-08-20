import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { FieldId } from "../lib/opportunity/fields";
import { migrateV1ToV2 } from "../lib/opportunity/migration";
import { applyOpportunityProjections } from "../lib/opportunity/projection";
import {
  SCHEMA_VERSION,
  opportunityCardSchema,
  type OpportunityCard,
} from "../lib/opportunity/schema-v2";
import {
  v1OpportunityCardSchema,
  type EvidenceSource,
  type V1OpportunityCard,
} from "../lib/opportunity/schema-v1";

const V2_REVIEWED_AT = "2026-08-12T00:27:28.180Z";
const V1_CHECKPOINT = "db78d1c";
const execFileAsync = promisify(execFile);

function scope(
  variantIds: string[] = [],
  stageIds: string[] = [],
  pathwayIds: string[] = [],
) {
  return { variantIds, stageIds, pathwayIds };
}

function disclosed<T>(
  claimId: string,
  value: T,
  displayValue: string,
  sources: EvidenceSource[],
  note: string | null = null,
) {
  if (sources.length === 0) {
    throw new Error(`Disclosed structured claim ${claimId} has no evidence.`);
  }
  return {
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources: structuredClone(sources),
    note,
    conflictingValues: [],
  };
}

function notFound(
  claimId: string,
  note: string,
) {
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

function unclear(
  claimId: string,
  note: string,
  sources: EvidenceSource[],
) {
  return {
    claimId,
    status: "unclear" as const,
    value: null,
    displayValue: null,
    claimKind: null,
    sources: structuredClone(sources),
    note,
    conflictingValues: [],
  };
}

function factSources(
  card: V1OpportunityCard,
  fieldId: FieldId,
  indexes?: number[],
): EvidenceSource[] {
  const fact = card.facts[fieldId];
  const selected = indexes === undefined
    ? fact.sources
    : indexes.flatMap((index) => fact.sources[index] ? [fact.sources[index]] : []);
  if (selected.length === 0) {
    throw new Error(`${card.slug}.${fieldId} has no evidence at the requested indexes.`);
  }
  return structuredClone(selected);
}

function finalizeReviewed(card: OpportunityCard): OpportunityCard {
  const projected = applyOpportunityProjections(card);
  projected.reviewState = "ai_audited";
  projected.reviewedAt = V2_REVIEWED_AT;
  return opportunityCardSchema.parse(projected);
}

function populateTechRise(v1: V1OpportunityCard): OpportunityCard {
  const card = migrateV1ToV2(v1);
  card.opportunityId = "nasa-techrise-student-challenge";
  card.summary = "The 2026â€“2027 cycle is a grades 6â€“12 U.S. school-team experiment challenge with 60 teams slated for restricted build funding, technical support, and a NASA-sponsored high-altitude-balloon flight spot.";
  card.facts.application_deadline.note = "No 2026â€“2027 application close date is established by an exact excerpt retained in this review record.";
  card.facts.start_date.note = "No 2026â€“2027 participation start date is established by an exact excerpt retained in this review record.";

  const cycleEvidence = factSources(v1, "other_benefits", [2]);
  card.cycle = {
    status: "modeled",
    value: {
      id: "cycle-2026-2027",
      label: disclosed(
        "techrise-cycle-label",
        "2026–2027",
        "2026–2027",
        cycleEvidence,
      ),
      status: disclosed(
        "techrise-cycle-status",
        "announced",
        "Announced",
        cycleEvidence,
        "The reviewed cycle was announced but had not opened when reviewed.",
      ),
      year: null,
      startYear: disclosed(
        "techrise-cycle-start-year",
        2026,
        "2026",
        cycleEvidence,
      ),
      endYear: disclosed(
        "techrise-cycle-end-year",
        2027,
        "2027",
        cycleEvidence,
      ),
      season: null,
      cycleType: disclosed(
        "techrise-cycle-type",
        "competition_cycle",
        "Competition cycle",
        cycleEvidence,
      ),
      timingRefs: {
        opens: null,
        closes: null,
        coverageStart: null,
        coverageEnd: null,
      },
    },
  };

  const roleEvidence = factSources(v1, "operating_organization");
  card.organizations = {
    status: "modeled",
    note: "NASA Flight Opportunities and Future Engineers retain distinct management and administration roles.",
    records: [
      {
        id: "org-nasa-flight-opportunities",
        name: disclosed(
          "techrise-nasa-name",
          "NASA Flight Opportunities",
          "NASA Flight Opportunities",
          roleEvidence,
        ),
        kind: disclosed(
          "techrise-nasa-kind",
          "government_agency",
          "Government agency program",
          roleEvidence,
        ),
      },
      {
        id: "org-future-engineers",
        name: disclosed(
          "techrise-future-engineers-name",
          "Future Engineers",
          "Future Engineers",
          roleEvidence,
        ),
        kind: disclosed(
          "techrise-future-engineers-kind",
          "private_company",
          "Private company (Future Engineers, LLC)",
          factSources(v1, "organization_type", [1]),
        ),
      },
    ],
  };
  card.organizationRoles = {
    status: "modeled",
    note: null,
    records: [
      {
        id: "role-nasa-manager",
        organizationId: "org-nasa-flight-opportunities",
        role: disclosed(
          "techrise-nasa-manager-role",
          { role: "manager", roleLabel: "Program manager", scope: scope() },
          "Manager",
          roleEvidence,
        ),
      },
      {
        id: "role-future-engineers-administrator",
        organizationId: "org-future-engineers",
        role: disclosed(
          "techrise-future-engineers-administrator-role",
          { role: "administrator", roleLabel: "Challenge administrator", scope: scope() },
          "Administrator",
          roleEvidence,
        ),
      },
    ],
  };
  card.institutionRelationships = {
    status: "not_applicable",
    records: [],
    note: "No educational institution relationship is claimed; NASA and Future Engineers are represented by their organization roles.",
  };

  card.variants = {
    status: "modeled",
    note: null,
    records: [
      {
        id: "variant-high-altitude-balloon",
        definition: disclosed(
          "techrise-balloon-variant",
          {
            label: "2026–2027 high-altitude-balloon challenge",
            kind: "cohort",
            parentVariantId: null,
          },
          "2026–2027 high-altitude-balloon challenge",
          cycleEvidence,
        ),
        eligibilityDifferences: [],
        notes: [],
      },
    ],
  };

  const proposalSources = factSources(v1, "sponsor_requirement");
  const reviewSources = factSources(v1, "selection_process");
  const buildSources = factSources(v1, "other_benefits", [0]);
  const flightSources = factSources(v1, "other_benefits", [1, 2]);
  card.stages = {
    status: "modeled",
    note: "Current-cycle dates were not published in the reviewed evidence, so the stage ledger does not invent them.",
    records: [
      {
        id: "stage-proposal",
        order: 1,
        definition: disclosed(
          "techrise-proposal-stage",
          { label: "Experiment proposal", kind: "application", scope: scope() },
          "Experiment proposal",
          proposalSources,
        ),
        timings: [],
        durations: [],
        timeCommitments: [],
        formats: [],
        locations: [],
        selectionRules: [],
        advancement: [],
        requirements: [
          disclosed(
            "techrise-proposal-educator-requirement",
            { requirement: "A student team submits under educator guidance.", scope: scope() },
            "Educator-guided student team",
            proposalSources,
          ),
        ],
        travelRequirements: [],
      },
      {
        id: "stage-proposal-review",
        order: 2,
        definition: disclosed(
          "techrise-review-stage",
          { label: "Proposal review and team selection", kind: "proposal_review", scope: scope() },
          "Proposal review and team selection",
          reviewSources,
        ),
        timings: [],
        durations: [],
        timeCommitments: [],
        formats: [],
        locations: [],
        selectionRules: [
          disclosed(
            "techrise-review-rule",
            { rule: "A sponsor-appointed panel judges eligible submissions using cycle-specific weighted criteria.", scope: scope() },
            "Sponsor-appointed judges and cycle-specific weighted criteria",
            factSources(v1, "selection_evidence", [1]),
          ),
        ],
        advancement: [
          disclosed(
            "techrise-selection-count",
            { count: 60, description: "Sixty winning teams are selected.", scope: scope() },
            "60 selected teams",
            reviewSources,
          ),
        ],
        requirements: [],
        travelRequirements: [],
      },
      {
        id: "stage-build-period",
        order: 3,
        definition: disclosed(
          "techrise-build-stage",
          { label: "Experiment build", kind: "build_period", scope: scope() },
          "Experiment build",
          buildSources,
        ),
        timings: [],
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
        id: "stage-flight",
        order: 4,
        definition: disclosed(
          "techrise-flight-stage",
          { label: "NASA-sponsored experiment flight", kind: "flight", scope: scope() },
          "NASA-sponsored experiment flight",
          flightSources,
        ),
        timings: [],
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
  };
  card.pathways = {
    status: "modeled",
    note: null,
    records: [
      {
        id: "pathway-selected-team",
        definition: disclosed(
          "techrise-pathway-definition",
          { label: "Selected-team pathway", variantIds: ["variant-high-altitude-balloon"] },
          "Proposal → selection → build → flight",
          factSources(v1, "official_url"),
        ),
        steps: [
          disclosed("techrise-path-step-proposal", { stageId: "stage-proposal", enterWhen: null }, "Experiment proposal", proposalSources),
          disclosed("techrise-path-step-review", { stageId: "stage-proposal-review", enterWhen: null }, "Proposal review", reviewSources),
          disclosed("techrise-path-step-build", { stageId: "stage-build-period", enterWhen: "Team is selected among the 60 winning teams." }, "Build if selected", buildSources),
          disclosed("techrise-path-step-flight", { stageId: "stage-flight", enterWhen: "The selected team's experiment receives an assigned flight spot." }, "Experiment flight", flightSources),
        ],
      },
    ],
  };

  card.costItems = {
    status: "none_found",
    records: [],
    note: "No participant-paid cost item could be established from the reviewed current-cycle evidence; the summary facts preserve explicit not-found and not-applicable states.",
  };

  card.outcomes = {
    status: "modeled",
    note: "The $1,500 is modeled as restricted team project funding, never as personal cash.",
    records: [
      {
        id: "outcome-build-budget",
        definition: disclosed(
          "techrise-build-budget-definition",
          { label: "$1,500 experiment build funding", outcomeType: "project_budget", scope: scope([], ["stage-build-period"], []) },
          "$1,500 experiment build funding",
          buildSources,
        ),
        recipientScope: disclosed("techrise-build-budget-recipient", "team", "Team", buildSources),
        monetaryNature: disclosed("techrise-build-budget-nature", "restricted_funding", "Restricted project funding", buildSources),
        amount: disclosed("techrise-build-budget-amount", { kind: "exact", amount: 1500, currency: "USD" }, "$1,500", buildSources),
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: disclosed("techrise-build-budget-restriction", "To build the selected team's experiment.", "To build the experiment", buildSources),
        combinability: null,
        conditions: [
          disclosed("techrise-build-budget-condition", "Available to each selected winning team.", "Selected winning teams", buildSources),
        ],
      },
      {
        id: "outcome-technical-support",
        definition: disclosed(
          "techrise-support-definition",
          { label: "Virtual mentorship and technical support", outcomeType: "mentorship", scope: scope([], ["stage-build-period"], []) },
          "Virtual mentorship and technical support",
          factSources(v1, "mentorship"),
        ),
        recipientScope: disclosed("techrise-support-recipient", "team", "Selected team", buildSources),
        monetaryNature: disclosed("techrise-support-nature", "not_monetized", "No monetary value published", factSources(v1, "mentorship")),
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [
          disclosed("techrise-support-condition", "Provided to competition winners while they build their payloads.", "Competition winners", factSources(v1, "mentorship", [0])),
        ],
      },
      {
        id: "outcome-flight-opportunity",
        definition: disclosed(
          "techrise-flight-outcome-definition",
          { label: "NASA-sponsored high-altitude-balloon experiment flight spot", outcomeType: "flight_or_experiment_opportunity", scope: scope([], ["stage-flight"], []) },
          "NASA-sponsored high-altitude-balloon experiment flight spot",
          flightSources,
        ),
        recipientScope: disclosed("techrise-flight-recipient", "project", "Selected experiment", flightSources),
        monetaryNature: disclosed("techrise-flight-nature", "not_monetized", "No monetary value published", flightSources),
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [
          disclosed("techrise-flight-condition", "Assigned to a selected team's experiment.", "Selected-team experiment", factSources(v1, "other_benefits", [1])),
        ],
      },
    ],
  };

  return finalizeReviewed(card);
}

function populateLumiere(v1: V1OpportunityCard): OpportunityCard {
  const card = migrateV1ToV2(v1);
  card.opportunityId = "lumiere-research-scholar-program";

  const cohortEvidence = factSources(v1, "start_date");
  card.cycle = {
    status: "modeled",
    value: {
      id: "cycle-fall-2026",
      label: disclosed("lumiere-cycle-label", "Fall 2026", "Fall 2026", cohortEvidence),
      status: disclosed("lumiere-cycle-status", "applications_open", "Applications open", factSources(v1, "application_deadline")),
      year: disclosed("lumiere-cycle-year", 2026, "2026", cohortEvidence),
      startYear: null,
      endYear: null,
      season: disclosed("lumiere-cycle-season", "fall", "Fall", cohortEvidence),
      cycleType: disclosed("lumiere-cycle-type", "cohort", "Cohort", cohortEvidence),
      timingRefs: {
        opens: null,
        closes: "lumiere-application-deadline",
        coverageStart: "lumiere-program-start",
        coverageEnd: null,
      },
    },
  };

  card.organizations = {
    status: "modeled",
    note: "Only the operator and the explicitly named credit-partner institution are organization entities; person affiliations remain relationships.",
    records: [
      {
        id: "org-lumiere-education",
        name: disclosed("lumiere-org-name", "Lumiere Education", "Lumiere Education", factSources(v1, "operating_organization")),
        kind: disclosed("lumiere-org-kind", "education_provider", "Online enrichment provider", factSources(v1, "organization_type")),
      },
      {
        id: "org-ucsd-extended-studies",
        name: disclosed("lumiere-ucsd-name", "University of California, San Diego Extended Studies", "UC San Diego Extended Studies", factSources(v1, "named_institution")),
        kind: disclosed("lumiere-ucsd-kind", "institution_unit", "Higher-education extension unit", factSources(v1, "institution_relationship")),
      },
    ],
  };
  card.organizationRoles = {
    status: "modeled",
    note: null,
    records: [
      {
        id: "role-lumiere-operator",
        organizationId: "org-lumiere-education",
        role: disclosed("lumiere-operator-role", { role: "operator", roleLabel: null, scope: scope() }, "Operator", factSources(v1, "operating_organization")),
      },
      {
        id: "role-ucsd-academic-partner",
        organizationId: "org-ucsd-extended-studies",
        role: disclosed("lumiere-ucsd-role", { role: "academic_partner", roleLabel: "Credit partner", scope: scope() }, "Credit partner", factSources(v1, "institution_relationship")),
      },
    ],
  };

  const relationshipSources = factSources(v1, "relationship_explanation");
  const relationships: OpportunityCard["institutionRelationships"] = {
    status: "modeled",
    note: "Founder and mentor affiliations are person-based relationships, not institutional sponsorship, operation, endorsement, or partnership.",
    records: [
      {
        id: "relationship-ucsd-credit",
        assertion: disclosed(
          "lumiere-ucsd-credit-relationship",
          {
            subject: "opportunity",
            subjectOrganizationId: "org-lumiere-education",
            targetOrganizationId: "org-ucsd-extended-studies",
            targetInstitutionName: null,
            relationshipType: "credit_partnership",
            description: "Lumiere states that it has a credit partnership with UC San Diego Extended Studies.",
            scope: scope(),
          },
          "Credit partnership — UC San Diego Extended Studies",
          [relationshipSources[0]],
          "The reviewed record found no separate UC San Diego page naming Lumiere.",
        ),
      },
      ...["Harvard", "Oxford"].map((institution, index) => ({
        id: `relationship-founders-${institution.toLowerCase()}`,
        assertion: disclosed(
          `lumiere-founders-${institution.toLowerCase()}-affiliation`,
          {
            subject: "founders" as const,
            subjectOrganizationId: "org-lumiere-education",
            targetOrganizationId: null,
            targetInstitutionName: institution,
            relationshipType: "founders_affiliated_with" as const,
            description: `Lumiere describes its founders as ${institution}-affiliated researchers.`,
            scope: scope(),
          },
          `Founders affiliated with — ${institution}`,
          [relationshipSources[1]],
          index === 0 ? "A founder affiliation does not establish an institutional relationship with Lumiere." : null,
        ),
      })),
      ...["Harvard", "Stanford", "Oxford", "MIT"].map((institution, index) => ({
        id: `relationship-mentors-${institution.toLowerCase()}`,
        assertion: disclosed(
          `lumiere-mentors-${institution.toLowerCase()}-affiliation`,
          {
            subject: "mentors" as const,
            subjectOrganizationId: "org-lumiere-education",
            targetOrganizationId: null,
            targetInstitutionName: institution,
            relationshipType: "mentors_affiliated_with" as const,
            description: `Lumiere says its mentors include researchers affiliated with ${institution}.`,
            scope: scope(),
          },
          `Mentors affiliated with — ${institution}`,
          [relationshipSources[2]],
          index === 0 ? "A mentor affiliation does not establish an institutional relationship with Lumiere." : null,
        ),
      })),
    ],
  };
  card.institutionRelationships = relationships;

  const tuitionSources = factSources(v1, "tuition");
  const variants: OpportunityCard["variants"] = {
    status: "modeled",
    note: null,
    records: [
      ["variant-individual-research", "Individual Research Program", tuitionSources[0]],
      ["variant-premium-research-publication", "Premium Research & Publication Program", tuitionSources[0]],
      ["variant-research-fellowship", "Research Fellowship", tuitionSources[0]],
      ["variant-professor-premium-publication", "Professor Premium Publication Program", tuitionSources[1]],
    ].map(([id, label, source]) => ({
      id: id as string,
      definition: disclosed(
        `lumiere-${id as string}-definition`,
        { label: label as string, kind: "tier" as const, parentVariantId: null },
        label as string,
        [source as EvidenceSource],
      ),
      eligibilityDifferences: [],
      notes: [],
    })),
  };
  card.variants = variants;

  const applicationSources = factSources(v1, "selection_process");
  const matchSources = factSources(v1, "selection_evidence", [2]);
  const durationSources = factSources(v1, "duration");
  card.stages = {
    status: "modeled",
    note: "One common selection pathway leads to a tier-scoped program period; tier-specific end dates were not published.",
    records: [
      {
        id: "stage-application",
        order: 1,
        definition: disclosed("lumiere-application-stage", { label: "Online application", kind: "application", scope: scope() }, "Online application", [applicationSources[0]]),
        timings: [
          disclosed(
            "lumiere-application-deadline",
            { event: "deadline", when: { precision: "date", date: "2026-08-23", certainty: "stated" }, scope: scope() },
            "August 23, 2026",
            [...factSources(v1, "application_deadline"), ...cohortEvidence],
          ),
        ],
        durations: [],
        timeCommitments: [],
        formats: [
          disclosed("lumiere-application-format", { formats: ["online"], scope: scope() }, "Online", [applicationSources[0]]),
        ],
        locations: [],
        selectionRules: [],
        advancement: [],
        requirements: [],
        travelRequirements: [],
      },
      {
        id: "stage-interview",
        order: 2,
        definition: disclosed("lumiere-interview-stage", { label: "Shortlist interview", kind: "interview", scope: scope() }, "Shortlist interview", [applicationSources[1]]),
        timings: [],
        durations: [],
        timeCommitments: [],
        formats: [],
        locations: [],
        selectionRules: [
          disclosed("lumiere-interview-rule", { rule: "Only shortlisted applications advance to interview.", scope: scope() }, "Shortlisted applicants advance", [applicationSources[1]]),
        ],
        advancement: [],
        requirements: [],
        travelRequirements: [],
      },
      {
        id: "stage-mentor-matching",
        order: 3,
        definition: disclosed("lumiere-matching-stage", { label: "Mentor matching and decision", kind: "matching", scope: scope() }, "Mentor matching and decision", [...matchSources, applicationSources[2]]),
        timings: [],
        durations: [],
        timeCommitments: [],
        formats: [],
        locations: [],
        selectionRules: [
          disclosed("lumiere-matching-rule", { rule: "Lumiere works to find a mentor match based on the applicant's interests and aims.", scope: scope() }, "Mentor match based on interests and aims", matchSources),
        ],
        advancement: [],
        requirements: [],
        travelRequirements: [],
      },
      {
        id: "stage-program",
        order: 4,
        definition: disclosed("lumiere-program-stage", { label: "Research program", kind: "program", scope: scope() }, "Research program", factSources(v1, "opportunity_name")),
        timings: [
          disclosed(
            "lumiere-program-start",
            { event: "starts", when: { precision: "date", date: "2026-09-14", certainty: "stated" }, scope: scope() },
            "September 14, 2026",
            cohortEvidence,
          ),
        ],
        durations: [
          disclosed("lumiere-duration-individual", { duration: { minimum: 12, maximum: null, unit: "weeks" }, scope: scope(["variant-individual-research"]) }, "Individual Research: 12 weeks", durationSources),
          disclosed("lumiere-duration-premium-research", { duration: { minimum: 3, maximum: 4, unit: "months" }, scope: scope(["variant-premium-research-publication"]) }, "Premium: 3–4 months research", durationSources),
          disclosed("lumiere-duration-premium-publication", { duration: { minimum: 1, maximum: 4, unit: "months" }, scope: scope(["variant-premium-research-publication"]) }, "Premium: 1–4 months publication", durationSources),
          disclosed("lumiere-duration-fellowship", { duration: { minimum: 6, maximum: 12, unit: "months" }, scope: scope(["variant-research-fellowship"]) }, "Research Fellowship: 6–12 months", durationSources),
          disclosed("lumiere-duration-professor-research", { duration: { minimum: 3, maximum: 4, unit: "months" }, scope: scope(["variant-professor-premium-publication"]) }, "Professor Premium: 3–4 months research", durationSources),
          disclosed("lumiere-duration-professor-publication", { duration: { minimum: 1, maximum: 4, unit: "months" }, scope: scope(["variant-professor-premium-publication"]) }, "Professor Premium: 1–4 months publication", durationSources),
        ],
        timeCommitments: [
          disclosed(
            "lumiere-weekly-time-commitment",
            { minimumHours: 5, maximumHours: 10, period: "week", label: "Independent project work outside mentor sessions", scope: scope() },
            "5–10 hours/week outside mentor sessions",
            factSources(v1, "weekly_hours"),
          ),
        ],
        formats: [
          disclosed("lumiere-program-format", { formats: ["online"], scope: scope() }, "Online", factSources(v1, "participation_format")),
        ],
        locations: [
          disclosed("lumiere-program-location", { location: "Online — worldwide", scope: scope() }, "Online — worldwide", [...factSources(v1, "participation_format"), ...factSources(v1, "location")]),
        ],
        selectionRules: [],
        advancement: [],
        requirements: [],
        travelRequirements: [
          disclosed("lumiere-travel-requirement", { requirement: "none", scope: scope() }, "No participant travel required", factSources(v1, "participation_format")),
        ],
      },
    ],
  };
  card.pathways = {
    status: "modeled",
    note: null,
    records: [
      {
        id: "pathway-common-selection",
        definition: disclosed("lumiere-common-pathway", { label: "Common application pathway", variantIds: [] }, "Application → interview → matching → program", factSources(v1, "entry_format")),
        steps: [
          disclosed("lumiere-path-step-application", { stageId: "stage-application", enterWhen: null }, "Online application", [applicationSources[0]]),
          disclosed("lumiere-path-step-interview", { stageId: "stage-interview", enterWhen: "Application is shortlisted." }, "Interview if shortlisted", [applicationSources[1]]),
          disclosed("lumiere-path-step-matching", { stageId: "stage-mentor-matching", enterWhen: "Applicant advances through interview." }, "Mentor matching and decision", [...matchSources, applicationSources[2]]),
          disclosed("lumiere-path-step-program", { stageId: "stage-program", enterWhen: "Applicant is conditionally accepted and an appropriate mentor is matched." }, "Program if accepted and matched", factSources(v1, "program_seat")),
        ],
      },
    ],
  };

  const priceDefinitions: Array<[string, string, number, string, EvidenceSource[]]> = [
    ["cost-tuition-individual", "Individual Research Program tuition", 3190, "variant-individual-research", [tuitionSources[0]]],
    ["cost-tuition-premium", "Premium Research & Publication Program tuition", 6450, "variant-premium-research-publication", [tuitionSources[0]]],
    ["cost-tuition-fellowship", "Research Fellowship tuition", 9900, "variant-research-fellowship", [tuitionSources[0]]],
    ["cost-tuition-professor", "Professor Premium Publication Program tuition", 9900, "variant-professor-premium-publication", [tuitionSources[1]]],
  ];
  const tuitionItems = priceDefinitions.map(([id, label, amount, variantId, sources]) => ({
    id,
    definition: disclosed(`${id}-definition`, { label, kind: "tuition" as const, requirement: "required" as const, scope: scope([variantId]) }, label, sources),
    amount: disclosed(`${id}-amount`, { kind: "exact" as const, amount, currency: "USD" }, `$${amount.toLocaleString("en-US")}`, sources),
    chargeBasis: null,
    treatment: null,
    refundability: unclear(`${id}-refundability`, "No public participant-withdrawal or tuition-refund schedule was located.", factSources(v1, "refund_policy")),
    includedItems: [],
    excludedItems: [],
    conditions: [],
  }));
  card.costItems = {
    status: "modeled",
    completeness: "incomplete",
    note: "The deposit is credited to whichever tier's tuition applies and is not added a second time to a total.",
    records: [
      ...tuitionItems,
      {
        id: "cost-conditional-deposit",
        definition: disclosed(
          "lumiere-deposit-definition",
          { label: "Conditional-acceptance deposit", kind: "deposit", requirement: "required", scope: scope() },
          "$200 conditional-acceptance deposit",
          factSources(v1, "deposit"),
        ),
        amount: disclosed("lumiere-deposit-amount", { kind: "exact", amount: 200, currency: "USD" }, "$200", factSources(v1, "deposit")),
        chargeBasis: null,
        treatment: disclosed(
          "lumiere-deposit-treatment",
          { kind: "credited_to_tuition", targetCostItemIds: priceDefinitions.map(([id]) => id) },
          "Credited toward tuition",
          factSources(v1, "deposit"),
        ),
        refundability: disclosed(
          "lumiere-deposit-refundability",
          { kind: "conditional", condition: "Reimbursed if Lumiere cannot find an appropriate mentor match." },
          "Reimbursed if no appropriate mentor match is found",
          factSources(v1, "refund_policy"),
          "No broader participant-withdrawal refund schedule was located.",
        ),
        includedItems: [],
        excludedItems: [],
        conditions: [
          disclosed("lumiere-deposit-condition", "Required after conditional acceptance following the interview.", "Required after conditional acceptance", factSources(v1, "deposit")),
        ],
      },
    ],
  };

  const mentorshipEvidence = factSources(v1, "mentorship");
  const mentorshipOutcomes: OpportunityCard["outcomes"] extends { records: infer T } ? T : never = [
    ["individual", "Individual Research", 9, "variant-individual-research"],
    ["premium", "Premium Research & Publication", 15, "variant-premium-research-publication"],
    ["fellowship", "Research Fellowship", 30, "variant-research-fellowship"],
    ["professor", "Professor Premium Publication", 10, "variant-professor-premium-publication"],
  ].map(([key, label, sessions, variantId]) => ({
    id: `outcome-mentorship-${key}`,
    definition: disclosed(`lumiere-mentorship-${key}-definition`, { label: `${label} one-to-one mentorship`, outcomeType: "mentorship" as const, scope: scope([variantId as string], ["stage-program"], []) }, `${label}: ${sessions} mentor sessions`, mentorshipEvidence),
    recipientScope: disclosed(`lumiere-mentorship-${key}-recipient`, "individual" as const, "Individual participant", mentorshipEvidence),
    monetaryNature: disclosed(`lumiere-mentorship-${key}-nature`, "not_monetized" as const, "Purchased program service; no separate value", mentorshipEvidence),
    amount: null,
    distribution: null,
    rank: null,
    track: null,
    quantity: disclosed(`lumiere-mentorship-${key}-quantity`, { minimum: sessions as number, maximum: null, unit: "sessions" as const }, `${sessions} mentor sessions`, [mentorshipEvidence[1]]),
    useRestriction: null,
    combinability: null,
    conditions: [],
  }));
  card.outcomes = {
    status: "modeled",
    note: "Program services, financial aid, and conditional credit are kept distinct.",
    records: [
      {
        id: "outcome-program-seat",
        definition: disclosed("lumiere-program-seat-definition", { label: "Conditional program admission", outcomeType: "program_seat", scope: scope() }, "Conditional program admission", factSources(v1, "program_seat")),
        recipientScope: disclosed("lumiere-program-seat-recipient", "individual", "Applicant", factSources(v1, "program_seat")),
        monetaryNature: disclosed("lumiere-program-seat-nature", "not_monetized", "Admission to a paid program", factSources(v1, "program_seat")),
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [
          disclosed("lumiere-program-seat-condition", "Conditional acceptance follows interview and depends on mentor matching.", "Interview and mentor-match condition", [...factSources(v1, "program_seat"), ...matchSources]),
        ],
      },
      {
        id: "outcome-individual-aid",
        definition: disclosed("lumiere-aid-definition", { label: "Need-based tuition aid", outcomeType: "tuition_waiver", scope: scope(["variant-individual-research"]) }, "Need-based tuition aid — Individual Research only", factSources(v1, "financial_aid")),
        recipientScope: disclosed("lumiere-aid-recipient", "individual", "Eligible individual applicant", factSources(v1, "financial_aid")),
        monetaryNature: disclosed("lumiere-aid-nature", "not_monetized", "Award amount not published", factSources(v1, "financial_aid")),
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: disclosed("lumiere-aid-restriction", "Available only to eligible Individual Research Program applicants.", "Individual Research Program only", factSources(v1, "financial_aid", [1])),
        combinability: null,
        conditions: [
          disclosed("lumiere-aid-income-condition", "Published household-income limits apply and aid is competitive.", "Income-limited and competitive", factSources(v1, "financial_aid", [0])),
        ],
      },
      ...mentorshipOutcomes,
      {
        id: "outcome-college-credit",
        definition: disclosed("lumiere-credit-definition", { label: "UC San Diego Extended Studies post-baccalaureate credit eligibility", outcomeType: "college_credit", scope: scope() }, "Eligibility for 3 post-baccalaureate credits and a digital transcript", factSources(v1, "college_credit")),
        recipientScope: disclosed("lumiere-credit-recipient", "individual", "Successful program completer", factSources(v1, "college_credit")),
        monetaryNature: disclosed("lumiere-credit-nature", "not_monetized", "No monetary value stated", factSources(v1, "college_credit")),
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: disclosed("lumiere-credit-quantity", { minimum: 3, maximum: null, unit: "credits" }, "3 post-baccalaureate credits", factSources(v1, "college_credit")),
        useRestriction: null,
        combinability: null,
        conditions: [
          disclosed("lumiere-credit-condition", "The student must successfully complete a Lumiere program to be eligible to receive the credits.", "Eligibility after successful completion", factSources(v1, "college_credit")),
        ],
      },
      {
        id: "outcome-research-paper-support",
        definition: disclosed("lumiere-paper-definition", { label: "Research paper and tier-dependent publication support", outcomeType: "other", scope: scope() }, "Research paper and publication support", factSources(v1, "other_benefits", [0, 1])),
        recipientScope: disclosed("lumiere-paper-recipient", "individual", "Participant", factSources(v1, "other_benefits", [0, 1])),
        monetaryNature: disclosed("lumiere-paper-nature", "not_monetized", "Purchased program service; no separate value", factSources(v1, "other_benefits", [0, 1])),
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [
          disclosed("lumiere-publication-condition", "Lumiere assists with up to three submission rounds but does not guarantee publication.", "Publication is not guaranteed", factSources(v1, "other_benefits", [1])),
        ],
      },
    ],
  };

  return finalizeReviewed(card);
}

function diamondPrize(
  v1: V1OpportunityCard,
  trackKey: "business" | "social",
  trackLabel: "Business Innovation" | "Social Innovation",
  ordinal: 1 | 2 | 3,
  amount: 12000 | 8000 | 4500,
) {
  const sources = factSources(v1, "cash_award");
  const rankLabel = ordinal === 1 ? "1st place" : ordinal === 2 ? "2nd place" : "3rd place";
  return {
    id: `outcome-${trackKey}-${ordinal}`,
    definition: disclosed(
      `diamond-${trackKey}-${ordinal}-definition`,
      { label: `${trackLabel} ${rankLabel}`, outcomeType: "team_cash_prize" as const, scope: scope([`variant-${trackKey}-innovation`]) },
      `${trackLabel} ${rankLabel}: $${amount.toLocaleString("en-US")}/team`,
      [sources[0], sources[1]],
    ),
    recipientScope: disclosed(`diamond-${trackKey}-${ordinal}-recipient`, "team" as const, "Team", [sources[0], sources[2]]),
    monetaryNature: disclosed(`diamond-${trackKey}-${ordinal}-nature`, "cash" as const, "Cash", [sources[1], sources[2]]),
    amount: disclosed(`diamond-${trackKey}-${ordinal}-amount`, { kind: "exact" as const, amount, currency: "USD" }, `$${amount.toLocaleString("en-US")}`, [sources[1]]),
    distribution: disclosed(
      `diamond-${trackKey}-${ordinal}-distribution`,
      [
        { payee: "registered_venture" as const, method: "direct" as const, condition: "Full payment to the team's designated venture if it is a registered entity." },
        { payee: "participant" as const, method: "equal_split" as const, condition: "Otherwise distributed as an even split among registered team members." },
      ],
      "Full payment to a registered team venture or equal split among registered team members",
      [sources[2]],
    ),
    rank: disclosed(`diamond-${trackKey}-${ordinal}-rank`, { ordinal, label: rankLabel }, rankLabel, [sources[1]]),
    track: disclosed(`diamond-${trackKey}-${ordinal}-track`, trackLabel, trackLabel, [sources[0]]),
    quantity: null,
    useRestriction: null,
    combinability: null,
    conditions: [],
  };
}

function populateDiamond(v1: V1OpportunityCard): OpportunityCard {
  const card = migrateV1ToV2(v1);
  card.opportunityId = "diamond-challenge";
  card.summary = "A worldwide 2027 high-school team entrepreneurship competition operated by Horn Entrepreneurship at the University of Delaware, with business and social innovation tracks, live or virtual pitching pathways, an in-person finalist summit, and six source-supported team cash awards across the two tracks.";

  const cycleEvidence = factSources(v1, "official_url");
  card.cycle = {
    status: "modeled",
    value: {
      id: "cycle-2027",
      label: disclosed("diamond-cycle-label", "2027 competition cycle", "2027 competition cycle", cycleEvidence),
      status: disclosed("diamond-cycle-status", "announced", "Announced", cycleEvidence),
      year: disclosed("diamond-cycle-year", 2027, "2027", cycleEvidence),
      startYear: disclosed("diamond-cycle-start-year", 2026, "2026", factSources(v1, "start_date")),
      endYear: disclosed("diamond-cycle-end-year", 2027, "2027", factSources(v1, "end_date")),
      season: null,
      cycleType: disclosed("diamond-cycle-type", "competition_cycle", "Competition cycle", cycleEvidence),
      timingRefs: {
        opens: "diamond-submission-opens",
        closes: "diamond-submission-deadline",
        coverageStart: null,
        coverageEnd: "diamond-summit-ends",
      },
    },
  };

  card.organizations = {
    status: "modeled",
    note: null,
    records: [
      {
        id: "org-horn-entrepreneurship",
        name: disclosed("diamond-horn-name", "Horn Entrepreneurship", "Horn Entrepreneurship", factSources(v1, "operating_organization")),
        kind: disclosed("diamond-horn-kind", "institution_unit", "University entrepreneurship initiative", factSources(v1, "organization_type")),
      },
      {
        id: "org-university-delaware",
        name: disclosed("diamond-udel-name", "University of Delaware", "University of Delaware", factSources(v1, "named_institution")),
        kind: disclosed("diamond-udel-kind", "higher_education_institution", "Higher-education institution", factSources(v1, "named_institution")),
      },
    ],
  };
  card.organizationRoles = {
    status: "modeled",
    note: "Horn Entrepreneurship operates the initiative within the University of Delaware.",
    records: [
      {
        id: "role-horn-operator",
        organizationId: "org-horn-entrepreneurship",
        role: disclosed("diamond-horn-operator-role", { role: "operator", roleLabel: null, scope: scope() }, "Operator", factSources(v1, "operating_organization")),
      },
    ],
  };
  card.institutionRelationships = {
    status: "modeled",
    note: "Affiliated pitch-event partners are described in the stage/location evidence but are not promoted to unnamed co-operators.",
    records: [
      {
        id: "relationship-udel-operated",
        assertion: disclosed(
          "diamond-udel-operated-relationship",
          {
            subject: "opportunity",
            subjectOrganizationId: "org-horn-entrepreneurship",
            targetOrganizationId: "org-university-delaware",
            targetInstitutionName: null,
            relationshipType: "institution_operated",
            description: "Diamond Challenge is an initiative of Horn Entrepreneurship at the University of Delaware.",
            scope: scope(),
          },
          "Institution operated — University of Delaware / Horn Entrepreneurship",
          factSources(v1, "institution_relationship"),
        ),
      },
    ],
  };

  const trackEvidence = factSources(v1, "entry_format", [1]);
  card.variants = {
    status: "modeled",
    note: "Competition track and pitch pathway are independent dimensions; tracks are variants and live/virtual routes are pathways.",
    records: [
      {
        id: "variant-business-innovation",
        definition: disclosed("diamond-business-track", { label: "Business Innovation", kind: "track", parentVariantId: null }, "Business Innovation", trackEvidence),
        eligibilityDifferences: [],
        notes: [],
      },
      {
        id: "variant-social-innovation",
        definition: disclosed("diamond-social-track", { label: "Social Innovation", kind: "track", parentVariantId: null }, "Social Innovation", trackEvidence),
        eligibilityDifferences: [],
        notes: [],
      },
    ],
  };

  const selectionSources = factSources(v1, "selection_process");
  const formatSources = factSources(v1, "participation_format");
  const locationSources = factSources(v1, "location");
  const travelSources = factSources(v1, "travel_requirements");
  card.stages = {
    status: "modeled",
    note: "The live and virtual pitch branches converge only for teams that qualify for the in-person Summit final.",
    records: [
      {
        id: "stage-submission",
        order: 1,
        definition: disclosed("diamond-submission-stage", { label: "Submission round", kind: "application", scope: scope() }, "Submission round", selectionSources),
        timings: [
          disclosed("diamond-submission-opens", { event: "opens", when: { precision: "date", date: "2026-09-16", certainty: "stated" }, scope: scope() }, "September 16, 2026", factSources(v1, "start_date")),
          disclosed("diamond-submission-deadline", { event: "deadline", when: { precision: "date_time", dateTime: "2027-01-14T17:00:00-05:00", certainty: "stated" }, scope: scope() }, "January 14, 2027 at 5:00 p.m. EST", factSources(v1, "application_deadline")),
        ],
        durations: [],
        timeCommitments: [],
        formats: [],
        locations: [],
        selectionRules: [],
        advancement: [],
        requirements: [
          disclosed("diamond-submission-team-requirement", { requirement: "A team consists of 2–4 high-school students ages 14–18 at the submission deadline.", scope: scope() }, "2–4 students ages 14–18", [...factSources(v1, "entry_format", [0]), ...factSources(v1, "ages")]),
          disclosed("diamond-submission-adviser-requirement", { requirement: "Each team has one adult adviser age 21 or older.", scope: scope() }, "One adult adviser age 21+", factSources(v1, "sponsor_requirement")),
        ],
        travelRequirements: [],
      },
      {
        id: "stage-submission-review",
        order: 2,
        definition: disclosed("diamond-review-stage", { label: "Submission judging", kind: "proposal_review", scope: scope() }, "Submission judging", [selectionSources[0]]),
        timings: [
          disclosed("diamond-pitch-invite-notification", { event: "notification", when: { precision: "date", date: "2027-02-10", certainty: "stated" }, scope: scope() }, "February 10, 2027", factSources(v1, "decision_date", [0])),
        ],
        durations: [],
        timeCommitments: [],
        formats: [],
        locations: [],
        selectionRules: [
          disclosed("diamond-review-rule", { rule: "A series of judges evaluates submission-round teams, which must meet a minimum score to advance.", scope: scope() }, "Judging with a minimum advancement score", [...selectionSources.slice(0, 1), ...factSources(v1, "selection_evidence", [1])]),
        ],
        advancement: [],
        requirements: [],
        travelRequirements: [],
      },
      {
        id: "stage-live-pitch",
        order: 3,
        definition: disclosed("diamond-live-pitch-stage", { label: "Live pitch event", kind: "pitch", scope: scope([], [], ["pathway-live-pitch"]) }, "Live pitch event", [formatSources[0]]),
        timings: [],
        durations: [],
        timeCommitments: [],
        formats: [
          disclosed("diamond-live-pitch-format", { formats: ["in_person"], scope: scope([], [], ["pathway-live-pitch"]) }, "In person", [formatSources[0]]),
        ],
        locations: [
          disclosed("diamond-live-pitch-location", { location: "Affiliated pitch-event locations worldwide", scope: scope([], [], ["pathway-live-pitch"]) }, "Affiliated pitch-event locations worldwide", [locationSources[0]]),
        ],
        selectionRules: [],
        advancement: [],
        requirements: [],
        travelRequirements: [
          disclosed("diamond-live-pitch-travel", { requirement: "required", scope: scope([], [], ["pathway-live-pitch"]) }, "A team participant must be present", [travelSources[0]]),
        ],
      },
      {
        id: "stage-virtual-pitch",
        order: 3,
        definition: disclosed("diamond-virtual-pitch-stage", { label: "Virtual/pre-recorded pitch", kind: "pitch", scope: scope([], [], ["pathway-virtual-pitch"]) }, "Virtual/pre-recorded pitch", [formatSources[0]]),
        timings: [
          disclosed("diamond-virtual-finalist-notification", { event: "notification", when: { precision: "date", date: "2027-03-09", certainty: "stated" }, scope: scope([], [], ["pathway-virtual-pitch"]) }, "March 9, 2027", factSources(v1, "decision_date", [1])),
        ],
        durations: [],
        timeCommitments: [],
        formats: [
          disclosed("diamond-virtual-pitch-format", { formats: ["online"], scope: scope([], [], ["pathway-virtual-pitch"]) }, "Virtual/pre-recorded", [formatSources[0]]),
        ],
        locations: [],
        selectionRules: [
          disclosed("diamond-virtual-pitch-judging", { rule: "Pitch videos and pitch decks are judged during the second round.", scope: scope([], [], ["pathway-virtual-pitch"]) }, "Pitch video and deck judged in round two", [selectionSources[1]]),
        ],
        advancement: [],
        requirements: [],
        travelRequirements: [
          disclosed("diamond-virtual-pitch-travel", { requirement: "none", scope: scope([], [], ["pathway-virtual-pitch"]) }, "No pitch-event travel for the virtual/pre-recorded route", [formatSources[0]]),
        ],
      },
      {
        id: "stage-summit-final",
        order: 4,
        definition: disclosed("diamond-summit-stage", { label: "Limitless World Summit final", kind: "summit_final", scope: scope() }, "Limitless World Summit final", [formatSources[1]]),
        timings: [
          disclosed("diamond-summit-starts", { event: "starts", when: { precision: "date", date: "2027-04-29", certainty: "stated" }, scope: scope() }, "April 29, 2027", factSources(v1, "end_date")),
          disclosed("diamond-summit-ends", { event: "ends", when: { precision: "date", date: "2027-04-30", certainty: "stated" }, scope: scope() }, "April 30, 2027", factSources(v1, "end_date")),
        ],
        durations: [
          disclosed("diamond-summit-duration", { duration: { minimum: 2, maximum: null, unit: "days" }, scope: scope([], ["stage-summit-final"], []) }, "April 29–30, 2027", factSources(v1, "end_date")),
        ],
        timeCommitments: [],
        formats: [
          disclosed("diamond-summit-format", { formats: ["in_person"], scope: scope() }, "In person", [formatSources[1]]),
        ],
        locations: [
          disclosed("diamond-summit-location", { location: "Chase Center on the Riverfront, Wilmington, Delaware", scope: scope() }, "Chase Center on the Riverfront, Wilmington, Delaware", [locationSources[1]]),
        ],
        selectionRules: [],
        advancement: [],
        requirements: [],
        travelRequirements: [
          disclosed("diamond-summit-travel", { requirement: "required", scope: scope() }, "At least one finalist team member must attend in person", [travelSources[1]]),
        ],
      },
    ],
  };

  card.pathways = {
    status: "modeled",
    note: "Pitch format is selected separately from Business/Social Innovation track.",
    records: [
      {
        id: "pathway-live-pitch",
        definition: disclosed("diamond-live-pathway-definition", { label: "Live pitch pathway", variantIds: ["variant-business-innovation", "variant-social-innovation"] }, "Live pitch pathway", trackEvidence),
        steps: [
          disclosed("diamond-live-step-submission", { stageId: "stage-submission", enterWhen: null }, "Submission round", [selectionSources[0]]),
          disclosed("diamond-live-step-review", { stageId: "stage-submission-review", enterWhen: null }, "Submission judging", [selectionSources[0]]),
          disclosed("diamond-live-step-pitch", { stageId: "stage-live-pitch", enterWhen: "Team is invited to the pitching round and selected the live format." }, "Live pitch if invited", trackEvidence),
          disclosed("diamond-live-step-summit", { stageId: "stage-summit-final", enterWhen: "Team qualifies for the final round." }, "In-person Summit if finalist", [formatSources[1]]),
        ],
      },
      {
        id: "pathway-virtual-pitch",
        definition: disclosed("diamond-virtual-pathway-definition", { label: "Virtual/pre-recorded pitch pathway", variantIds: ["variant-business-innovation", "variant-social-innovation"] }, "Virtual/pre-recorded pitch pathway", trackEvidence),
        steps: [
          disclosed("diamond-virtual-step-submission", { stageId: "stage-submission", enterWhen: null }, "Submission round", [selectionSources[0]]),
          disclosed("diamond-virtual-step-review", { stageId: "stage-submission-review", enterWhen: null }, "Submission judging", [selectionSources[0]]),
          disclosed("diamond-virtual-step-pitch", { stageId: "stage-virtual-pitch", enterWhen: "Team is invited to the pitching round and selected the virtual/pre-recorded format." }, "Virtual/pre-recorded pitch if invited", trackEvidence),
          disclosed("diamond-virtual-step-summit", { stageId: "stage-summit-final", enterWhen: "Team is selected as a virtual finalist." }, "In-person Summit if finalist", [...factSources(v1, "decision_date", [1]), formatSources[1]]),
        ],
      },
    ],
  };

  card.costItems = {
    status: "modeled",
    completeness: "incomplete",
    note: "The rules require some in-person attendance but do not publish whether or how participant travel costs are covered.",
    records: [
      {
        id: "cost-required-travel",
        definition: disclosed(
          "diamond-travel-cost-definition",
          { label: "Travel for required in-person attendance", kind: "travel", requirement: "conditional", scope: scope([], ["stage-live-pitch", "stage-summit-final"], []) },
          "Conditional travel for live pitch or finalist attendance",
          travelSources,
        ),
        amount: notFound("diamond-travel-cost-amount", "No participant-paid travel amount or coverage commitment was published in the reviewed rules."),
        chargeBasis: null,
        treatment: null,
        refundability: null,
        includedItems: [],
        excludedItems: [],
        conditions: [
          disclosed("diamond-travel-cost-condition", "Travel applies if a team uses a live pitch event or qualifies for the in-person Summit final.", "Depends on pitch route and advancement", travelSources),
        ],
      },
    ],
  };

  const prizes = [
    diamondPrize(v1, "business", "Business Innovation", 1, 12000),
    diamondPrize(v1, "business", "Business Innovation", 2, 8000),
    diamondPrize(v1, "business", "Business Innovation", 3, 4500),
    diamondPrize(v1, "social", "Social Innovation", 1, 12000),
    diamondPrize(v1, "social", "Social Innovation", 2, 8000),
    diamondPrize(v1, "social", "Social Innovation", 3, 4500),
  ];
  card.outcomes = {
    status: "modeled",
    note: "The six supported track/rank awards are modeled individually. The V1 value names five topical prizes, but its stored excerpts do not support those names; no fabricated excerpt was introduced during migration.",
    records: [
      ...prizes,
      {
        id: "outcome-finalist-summit-seat",
        definition: disclosed("diamond-summit-seat-definition", { label: "Finalist place at the 2027 Limitless World Summit", outcomeType: "program_seat", scope: scope([], ["stage-summit-final"], []) }, "Finalist place at the 2027 Limitless World Summit", factSources(v1, "program_seat")),
        recipientScope: disclosed("diamond-summit-seat-recipient", "team", "Finalist team", factSources(v1, "program_seat")),
        monetaryNature: disclosed("diamond-summit-seat-nature", "not_monetized", "No monetary value published", factSources(v1, "program_seat")),
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [
          disclosed("diamond-summit-seat-condition", "Team qualifies as a finalist.", "Finalist qualification", factSources(v1, "program_seat")),
        ],
      },
      {
        id: "outcome-resources",
        definition: disclosed("diamond-resources-definition", { label: "Free entrepreneurship resources", outcomeType: "other_in_kind", scope: scope() }, "Free entrepreneurship resources", factSources(v1, "other_benefits", [0])),
        recipientScope: disclosed("diamond-resources-recipient", "individual", "Students and educators", factSources(v1, "other_benefits", [0])),
        monetaryNature: disclosed("diamond-resources-nature", "not_monetized", "No monetary value published", factSources(v1, "other_benefits", [0])),
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
        id: "outcome-feedback-network",
        definition: disclosed("diamond-feedback-definition", { label: "Submission feedback, networking, and collaboration opportunities", outcomeType: "other", scope: scope() }, "Feedback, networking, and collaboration", factSources(v1, "other_benefits", [1, 2])),
        recipientScope: disclosed("diamond-feedback-recipient", "individual", "Participant", factSources(v1, "other_benefits", [1, 2])),
        monetaryNature: disclosed("diamond-feedback-nature", "not_monetized", "No monetary value published", factSources(v1, "other_benefits", [1, 2])),
        amount: null,
        distribution: null,
        rank: null,
        track: null,
        quantity: null,
        useRestriction: null,
        combinability: null,
        conditions: [
          disclosed("diamond-feedback-condition", "Submission-round feedback is described for participants notified of pitching-round decisions.", "Stage-dependent feedback", factSources(v1, "other_benefits", [1])),
        ],
      },
    ],
  };

  return finalizeReviewed(card);
}

interface PlannedCardWrite {
  filePath: string;
  card: OpportunityCard;
}

async function planDirectory(directory: string, kind: "demo" | "reviewed"): Promise<PlannedCardWrite[]> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  const planned: PlannedCardWrite[] = [];
  for (const file of files) {
    const filePath = path.join(directory, file);
    const currentRaw = JSON.parse(await readFile(filePath, "utf8")) as { schemaVersion?: unknown };
    const raw = currentRaw.schemaVersion === "1.0.0"
      ? currentRaw
      : JSON.parse((await execFileAsync("git", [
          "show",
          `${V1_CHECKPOINT}:${path.relative(process.cwd(), filePath).replaceAll("\\", "/")}`,
        ], { cwd: process.cwd(), encoding: "utf8" })).stdout) as unknown;
    const v1 = v1OpportunityCardSchema.parse(raw);
    let v2: OpportunityCard;
    if (kind === "demo") {
      v2 = migrateV1ToV2(v1);
      v2.reviewState = "demo";
      v2.reviewedAt = null;
      v2 = opportunityCardSchema.parse(v2);
    } else if (v1.slug === "nasa-techrise-student-challenge-2026-2027") {
      v2 = populateTechRise(v1);
    } else if (v1.slug === "lumiere-research-scholar-program-fall-2026") {
      v2 = populateLumiere(v1);
    } else if (v1.slug === "diamond-challenge-2027") {
      v2 = populateDiamond(v1);
    } else {
      throw new Error(`No reviewed V2 population mapping exists for ${v1.slug}.`);
    }
    planned.push({ filePath, card: v2 });
  }
  return planned;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const planned = [
    ...await planDirectory(path.join(root, "data", "demo"), "demo"),
    ...await planDirectory(path.join(root, "data", "opportunities"), "reviewed"),
  ];
  for (const { filePath, card } of planned) {
    await writeFile(filePath, `${JSON.stringify(card, null, 2)}\n`, "utf8");
    process.stdout.write(`Migrated ${path.relative(process.cwd(), filePath)} to schema ${SCHEMA_VERSION}.\n`);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
