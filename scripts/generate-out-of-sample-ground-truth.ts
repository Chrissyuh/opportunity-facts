import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FieldId } from "../lib/opportunity/fields";
import { applyOpportunityProjections } from "../lib/opportunity/projection";
import {
  createEmptyCard,
  opportunityCardSchema,
  type OpportunityCard,
} from "../lib/opportunity/schema-v2";
import type { EvidenceSource, Fact, SourcePage } from "../lib/opportunity/schema-v1";

const REVIEWED_AT = "2026-08-12T06:25:00.000Z";
const OUT = path.join(process.cwd(), "data", "opportunities");

type PageType = SourcePage["pageType"];

interface SourceDefinition {
  id: string;
  url: string;
  title: string;
  pageType: PageType;
}

function scope(variantIds: string[] = [], stageIds: string[] = [], pathwayIds: string[] = []) {
  return { variantIds, stageIds, pathwayIds };
}

function page(source: SourceDefinition): SourcePage {
  return { ...source, accessedAt: REVIEWED_AT };
}

function evidence(source: SourceDefinition, excerpt: string): EvidenceSource {
  return { ...page(source), excerpt };
}

function disclosed<T>(claimId: string, value: T, displayValue: string, sources: EvidenceSource[], note: string | null = null) {
  if (sources.length === 0) throw new Error(`${claimId} requires evidence.`);
  return {
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources,
    note,
    conflictingValues: [],
  };
}

function notFound(claimId: string, note: string) {
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

function unclear(claimId: string, note: string, sources: EvidenceSource[]) {
  return {
    claimId,
    status: "unclear" as const,
    value: null,
    displayValue: null,
    claimKind: null,
    sources,
    note,
    conflictingValues: [],
  };
}

function fact(value: Fact["value"], displayValue: string, sources: EvidenceSource[], normalizedValue: Fact["normalizedValue"] = null, note: string | null = null): Fact {
  return {
    status: "disclosed",
    value,
    displayValue,
    normalizedValue,
    sources,
    note,
    confidence: null,
    claimKind: "source_stated",
    conflictingValues: [],
    calculation: null,
    projection: null,
  };
}

function setFact(card: OpportunityCard, fieldId: FieldId, value: Fact["value"], displayValue: string, source: EvidenceSource, normalizedValue: Fact["normalizedValue"] = null, note: string | null = null) {
  card.facts[fieldId] = fact(value, displayValue, [source], normalizedValue, note);
}

function setNotApplicable(card: OpportunityCard, fieldId: FieldId, note: string) {
  card.facts[fieldId] = {
    status: "not_applicable",
    value: null,
    displayValue: null,
    normalizedValue: null,
    sources: [],
    note,
    confidence: null,
    claimKind: null,
    conflictingValues: [],
    calculation: null,
    projection: null,
  };
}

function baseCard(slug: string, opportunityId: string, summary: string, sources: SourceDefinition[]) {
  const card = createEmptyCard({ slug, summary });
  card.opportunityId = opportunityId;
  card.sourcePagesChecked = sources.map(page);
  return card;
}

function finish(card: OpportunityCard): OpportunityCard {
  const projected = applyOpportunityProjections(card);
  projected.reviewState = "ai_audited";
  projected.reviewedAt = REVIEWED_AT;
  return opportunityCardSchema.parse(projected);
}

const CAC = {
  rules: { id: "cac-rules", url: "https://www.congressionalappchallenge.us/students/rules/", title: "Student Rules - Congressional App Challenge", pageType: "official_rules" },
  about: { id: "cac-about", url: "https://www.congressionalappchallenge.us/about/", title: "About - Congressional App Challenge", pageType: "official_program_page" },
  faq: { id: "cac-faq", url: "https://www.congressionalappchallenge.us/congress/frequently-asked-questions/", title: "Frequently Asked Questions - Congressional App Challenge", pageType: "official_faq" },
  privacy: { id: "cac-privacy", url: "https://www.congressionalappchallenge.us/privacy-policy/", title: "Privacy Policy - Congressional App Challenge", pageType: "official_privacy_policy" },
  launch: { id: "cac-launch", url: "https://www.congressionalappchallenge.us/the-2026-congressional-app-challenge-powered-by-roblox-launches-today/", title: "The 2026 Congressional App Challenge Launches Today", pageType: "official_program_page" },
} satisfies Record<string, SourceDefinition>;

function congressionalAppChallenge(): OpportunityCard {
  const card = baseCard(
    "congressional-app-challenge-2026",
    "congressional-app-challenge",
    "The 2026 Congressional App Challenge is a district-based U.S. House coding competition for eligible middle- and high-school students entering individually or in teams of up to four.",
    Object.values(CAC),
  );
  const rules = evidence(CAC.rules, "To be eligible to participate in the Congressional App Challenge, you must be a middle or high school student at the time of app submission.");
  const dates = evidence(CAC.rules, "The deadline to submit an app is October 26, 2026.");
  const team = evidence(CAC.rules, "Students may register as individuals or as teams of up to four.");
  const operator = evidence(CAC.launch, "The Internet Education Foundation, a nonpartisan nonprofit organization that has administered the Congressional App Challenge since its inception");
  setFact(card, "opportunity_name", "Congressional App Challenge", "Congressional App Challenge", evidence(CAC.about, "Congressional App Challenge"), { kind: "text", value: "Congressional App Challenge" });
  setFact(card, "opportunity_category", "Student coding competition", "Student coding competition", evidence(CAC.about, "The Congressional App Challenge is a public effort to encourage kids to learn how to code"));
  setFact(card, "official_url", CAC.rules.url, CAC.rules.url, rules, { kind: "text", value: CAC.rules.url });
  setFact(card, "grade_levels", ["Middle school", "High school"], "Middle or high school", rules, { kind: "text_list", values: ["Middle school", "High school"] });
  setFact(card, "entry_format", "Individual or team of up to four", "Individual or team of up to four", team);
  setFact(card, "geographic_restrictions", "Must be eligible in a participating congressional district", "Participating congressional district; district rules apply", evidence(CAC.rules, "Students may only compete in a district where they reside or attend school."));
  setFact(card, "citizenship_restrictions", "U.S. citizenship is not required; participants must be U.S. residents", "U.S. residency required; citizenship not required", evidence(CAC.rules, "Students are not required to be U.S. citizens, but must be U.S. residents at the time of app submission."));
  setFact(card, "personal_information", ["Name", "Email", "School", "Parent or guardian information"], "Registration and participant information", evidence(CAC.privacy, "Registration information provided by participants will be held confidentially by IEF and the U.S. House of Representatives"));
  setFact(card, "data_sharing", "Registration information is held by IEF and the U.S. House of Representatives", "IEF and U.S. House receive registration information", evidence(CAC.privacy, "Registration information provided by participants will be held confidentially by IEF and the U.S. House of Representatives"));
  setFact(card, "project_ownership", "The submitted app must be original and created by the student or team", "Original student/team work required", evidence(CAC.rules, "The app must be original and solely created by the student or team."));
  setFact(card, "material_terms", ["District participation and district-specific rules apply", "Only one app submission per student is permitted"], "District-specific eligibility and one-entry rule", evidence(CAC.rules, "A student may only submit one app."), { kind: "text_list", values: ["District-specific eligibility", "One app per student"] });

  card.cycle = { status: "modeled", value: {
    id: "cac-cycle-2026",
    label: disclosed("cac-cycle-label", "2026", "2026", evidence(CAC.launch, "The 2026 Congressional App Challenge" ) ? [evidence(CAC.launch, "The 2026 Congressional App Challenge")] : []),
    status: disclosed("cac-cycle-status", "applications_open", "Applications open", [evidence(CAC.launch, "The 2026 Congressional App Challenge")]),
    year: disclosed("cac-cycle-year", 2026, "2026", [evidence(CAC.launch, "The 2026 Congressional App Challenge")]),
    startYear: null,
    endYear: null,
    season: null,
    cycleType: disclosed("cac-cycle-type", "competition_cycle", "Competition cycle", [evidence(CAC.about, "Congressional App Challenge")]),
    timingRefs: { opens: "cac-launch-date", closes: "cac-submission-deadline", coverageStart: null, coverageEnd: null },
  }};
  card.organizations = { status: "modeled", note: null, records: [
    { id: "cac-org-house", name: disclosed("cac-house-name", "U.S. House of Representatives", "U.S. House of Representatives", [evidence(CAC.about, "Representatives in Congress host Congressional App Challenges in their districts")]), kind: disclosed("cac-house-kind", "government_agency", "Federal legislative body", [evidence(CAC.about, "Representatives in Congress")]) },
    { id: "cac-org-ief", name: disclosed("cac-ief-name", "Internet Education Foundation", "Internet Education Foundation", [operator]), kind: disclosed("cac-ief-kind", "education_provider", "Nonpartisan nonprofit administrator", [operator]) },
  ] };
  card.organizationRoles = { status: "modeled", note: "District House members host local challenges; IEF provides national administration.", records: [
    { id: "cac-role-house-host", organizationId: "cac-org-house", role: disclosed("cac-house-host-claim", { role: "host", roleLabel: "District hosts", scope: scope() }, "District hosts", [evidence(CAC.about, "Representatives in Congress host Congressional App Challenges in their districts")]) },
    { id: "cac-role-ief-admin", organizationId: "cac-org-ief", role: disclosed("cac-ief-admin-claim", { role: "administrator", roleLabel: null, scope: scope() }, "Administrator", [operator]) },
  ] };
  card.institutionRelationships = { status: "not_applicable", records: [], note: "No higher-education institutional relationship is stated for this congressional competition." };
  card.variants = { status: "not_applicable", records: [], note: "District administration varies, but the reviewed national rules do not define participant program tiers or cohorts." };
  card.stages = { status: "modeled", note: null, records: [
    { id: "cac-stage-launch", order: 1, definition: disclosed("cac-launch-stage", { label: "Competition launch", kind: "application", scope: scope() }, "Competition launch", [evidence(CAC.rules, "The 2026 Congressional App Challenge officially launches on May 1, 2026.")]), timings: [disclosed("cac-launch-date", { event: "opens", when: { precision: "date", date: "2026-05-01", certainty: "stated" }, scope: scope() }, "May 1, 2026", [evidence(CAC.rules, "The 2026 Congressional App Challenge officially launches on May 1, 2026.")])], durations: [], timeCommitments: [], formats: [], locations: [], selectionRules: [], advancement: [], requirements: [], travelRequirements: [] },
    { id: "cac-stage-submission", order: 2, definition: disclosed("cac-submission-stage", { label: "App submission", kind: "application", scope: scope() }, "App submission", [dates]), timings: [disclosed("cac-submission-deadline", { event: "deadline", when: { precision: "date_time", dateTime: "2026-10-26T23:59:00-04:00", certainty: "stated" }, scope: scope() }, "October 26, 2026", [dates])], durations: [], timeCommitments: [], formats: [disclosed("cac-submission-format", { formats: ["online"], scope: scope() }, "Online submission", [evidence(CAC.rules, "Students must submit their app through the Congressional App Challenge portal")])], locations: [], selectionRules: [], advancement: [], requirements: [disclosed("cac-team-requirement", { requirement: "Individual entry or team of up to four students.", scope: scope() }, "Individual or team of up to four", [team])], travelRequirements: [] },
    { id: "cac-stage-judging", order: 3, definition: disclosed("cac-judging-stage", { label: "District judging", kind: "winner_selection", scope: scope() }, "District judging", [evidence(CAC.rules, "Each Member of Congress will select a winning app from their district")]), timings: [], durations: [], timeCommitments: [], formats: [], locations: [], selectionRules: [disclosed("cac-judging-rule", { rule: "Each participating Member of Congress selects a district winner under district judging procedures.", scope: scope() }, "District winner selected", [evidence(CAC.rules, "Each Member of Congress will select a winning app from their district")])], advancement: [], requirements: [], travelRequirements: [] },
  ] };
  card.pathways = { status: "modeled", note: null, records: [{ id: "cac-pathway", definition: disclosed("cac-pathway-definition", { label: "District competition pathway", variantIds: [] }, "District competition pathway", [rules]), steps: [
    disclosed("cac-step-launch", { stageId: "cac-stage-launch", enterWhen: null }, "Launch", [rules]),
    disclosed("cac-step-submit", { stageId: "cac-stage-submission", enterWhen: null }, "Submit app", [dates]),
    disclosed("cac-step-judge", { stageId: "cac-stage-judging", enterWhen: "Submission is eligible in a participating district." }, "District judging", [evidence(CAC.rules, "Each Member of Congress will select a winning app from their district")]),
  ] }] };
  card.costItems = { status: "none_found", records: [], note: "The reviewed national pages did not publish an organizer application fee or a complete participant-cost inventory." };
  const prize = evidence(CAC.faq, "Winning apps are eligible to be featured on display in the U.S. Capitol Building");
  card.outcomes = { status: "modeled", note: "National in-kind recognition is modeled; district-specific extras are not generalized.", records: [
    { id: "cac-outcome-capitol", definition: disclosed("cac-capitol-definition", { label: "Eligibility for U.S. Capitol display", outcomeType: "other_in_kind", scope: scope([], ["cac-stage-judging"], []) }, "Eligibility for U.S. Capitol display", [prize]), recipientScope: disclosed("cac-capitol-recipient", "individual", "Winning student participants", [prize]), monetaryNature: disclosed("cac-capitol-nature", "not_monetized", "No monetary value published", [prize]), amount: null, distribution: null, rank: null, track: null, quantity: null, useRestriction: null, combinability: null, conditions: [] },
    { id: "cac-outcome-houseofcode", definition: disclosed("cac-houseofcode-definition", { label: "Invitation to #HouseOfCode", outcomeType: "other_in_kind", scope: scope([], ["cac-stage-judging"], []) }, "Invitation to #HouseOfCode", [evidence(CAC.faq, "Winners will also be invited to attend #HouseOfCode")]), recipientScope: disclosed("cac-houseofcode-recipient", "individual", "Winning student participants", [evidence(CAC.faq, "Winners will also be invited to attend #HouseOfCode")]), monetaryNature: disclosed("cac-houseofcode-nature", "not_monetized", "No monetary value published", [prize]), amount: null, distribution: null, rank: null, track: null, quantity: null, useRestriction: null, combinability: null, conditions: [] },
  ] };
  return finish(card);
}

const COKE = {
  apply: { id: "coke-apply", url: "https://www.coca-colascholarsfoundation.org/apply/", title: "Apply - Coca-Cola Scholars Foundation", pageType: "official_program_page" },
  faq: { id: "coke-faq", url: "https://www.coca-colascholarsfoundation.org/about/faq/", title: "Frequently Asked Questions - Coca-Cola Scholars Foundation", pageType: "official_faq" },
  about: { id: "coke-about", url: "https://www.coca-colascholarsfoundation.org/about/", title: "About - Coca-Cola Scholars Foundation", pageType: "official_program_page" },
} satisfies Record<string, SourceDefinition>;

function cocaColaScholars(): OpportunityCard {
  const card = baseCard("coca-cola-scholars-program-2027", "coca-cola-scholars-program", "The 2027 Coca-Cola Scholars Program will select 150 U.S. high-school seniors for individual $20,000 achievement-based scholarships through application, semifinalist, interview, and Scholars Weekend stages.", Object.values(COKE));
  const headline = evidence(COKE.apply, "Each year, we award 150 Coca-Cola Scholars a $20,000 scholarship.");
  const deadline = evidence(COKE.apply, "The application deadline is September 30, 2026, at 5 p.m. Eastern.");
  const eligibility = evidence(COKE.apply, "Current high school or home-schooled students attending school in one of the 50 U.S. states, the District of Columbia, Puerto Rico, or select DoD schools who will graduate high school during the 2026-2027 academic school year");
  setFact(card, "opportunity_name", "Coca-Cola Scholars Program", "Coca-Cola Scholars Program", headline, { kind: "text", value: "Coca-Cola Scholars Program" });
  setFact(card, "opportunity_category", "Achievement-based college scholarship", "Achievement-based college scholarship", evidence(COKE.faq, "The Coca-Cola Scholars Program scholarship is an achievement-based scholarship"));
  setFact(card, "official_url", COKE.apply.url, COKE.apply.url, headline, { kind: "text", value: COKE.apply.url });
  setFact(card, "grade_levels", ["12"], "High-school seniors graduating in 2026–2027", eligibility, { kind: "text_list", values: ["12"] });
  setFact(card, "geographic_restrictions", "50 U.S. states, District of Columbia, Puerto Rico, and select DoD schools", "United States, Puerto Rico, or select DoD schools", eligibility);
  setFact(card, "citizenship_restrictions", "Eligible U.S. citizenship or residency categories listed by the Foundation", "U.S. citizenship/residency rules apply", evidence(COKE.apply, "U.S. Citizens; U.S. Nationals; U.S. Permanent Residents; Refugees; Asylees; Cuban-Haitian Entrants; or Humanitarian Parolees"));
  setFact(card, "entry_format", "Individual application", "Individual application", evidence(COKE.apply, "Applicants may not be children or grandchildren of employees, officers, or owners"));
  setFact(card, "financial_aid", "The award is achievement-based rather than need-based", "Achievement-based; not need-based", evidence(COKE.faq, "The Coca-Cola Scholars Program scholarship is an achievement-based scholarship"));
  setFact(card, "personal_information", ["Academic information", "Activities", "Employment", "Service"], "Academic, activity, employment, and service information", evidence(COKE.apply, "The application asks for information about grades, school and community activities, employment, and volunteer service"));
  setNotApplicable(card, "refund_policy", "There is no participant tuition or application payment to refund in the reviewed scholarship application.");
  setNotApplicable(card, "college_credit", "The outcome is a scholarship, not academic credit.");
  card.cycle = { status: "modeled", value: { id: "coke-cycle-2027", label: disclosed("coke-cycle-label", "2027", "2027", [evidence(COKE.apply, "2027 Coca-Cola Scholars")]), status: disclosed("coke-cycle-status", "applications_open", "Applications open", [deadline]), year: disclosed("coke-cycle-year", 2027, "2027", [evidence(COKE.apply, "2027 Coca-Cola Scholars")]), startYear: disclosed("coke-cycle-start-year", 2026, "2026", [eligibility]), endYear: disclosed("coke-cycle-end-year", 2027, "2027", [eligibility]), season: null, cycleType: disclosed("coke-cycle-type", "academic_year", "Academic-year scholarship cycle", [eligibility]), timingRefs: { opens: null, closes: "coke-application-deadline", coverageStart: null, coverageEnd: null } } };
  card.organizations = { status: "modeled", note: null, records: [
    { id: "coke-org-foundation", name: disclosed("coke-foundation-name", "Coca-Cola Scholars Foundation", "Coca-Cola Scholars Foundation", [headline]), kind: disclosed("coke-foundation-kind", "education_provider", "Scholarship foundation", [evidence(COKE.about, "Coca-Cola Scholars Foundation")]) },
    { id: "coke-org-company-system", name: disclosed("coke-system-name", "The Coca-Cola Company and Coca-Cola bottlers", "The Coca-Cola Company and Coca-Cola bottlers", [evidence(COKE.faq, "The Coca-Cola Scholars Foundation is funded by The Coca-Cola Company and Coca-Cola bottlers")]), kind: disclosed("coke-system-kind", "private_company", "Corporate funders", [evidence(COKE.faq, "funded by The Coca-Cola Company and Coca-Cola bottlers")]) },
  ] };
  card.organizationRoles = { status: "modeled", note: null, records: [
    { id: "coke-role-foundation-operator", organizationId: "coke-org-foundation", role: disclosed("coke-foundation-operator", { role: "operator", roleLabel: null, scope: scope() }, "Operator", [headline]) },
    { id: "coke-role-system-funder", organizationId: "coke-org-company-system", role: disclosed("coke-system-funder", { role: "funder", roleLabel: null, scope: scope() }, "Funder", [evidence(COKE.faq, "The Coca-Cola Scholars Foundation is funded by The Coca-Cola Company and Coca-Cola bottlers")]) },
  ] };
  card.institutionRelationships = { status: "not_applicable", records: [], note: "The scholarship is used at accredited institutions, but no single institution operates, hosts, or partners in the national selection program." };
  card.variants = { status: "not_applicable", records: [], note: "One national scholarship award is described; no applicant tiers or cohorts are published." };
  const stageSource = evidence(COKE.apply, "Approximately 1,200 Semifinalists will be invited to complete a second application");
  card.stages = { status: "modeled", note: null, records: [
    { id: "coke-stage-application", order: 1, definition: disclosed("coke-application-stage", { label: "Initial application", kind: "application", scope: scope() }, "Initial application", [deadline]), timings: [disclosed("coke-application-deadline", { event: "deadline", when: { precision: "date_time", dateTime: "2026-09-30T17:00:00-04:00", certainty: "stated" }, scope: scope() }, "September 30, 2026 at 5 p.m. Eastern", [deadline])], durations: [], timeCommitments: [], formats: [disclosed("coke-application-format", { formats: ["online"], scope: scope() }, "Online", [evidence(COKE.apply, "online application")])], locations: [], selectionRules: [], advancement: [disclosed("coke-semifinal-count", { count: 1200, description: "Approximately 1,200 Semifinalists", scope: scope() }, "Approximately 1,200 Semifinalists", [stageSource])], requirements: [], travelRequirements: [] },
    { id: "coke-stage-semifinal", order: 2, definition: disclosed("coke-semifinal-stage", { label: "Semifinalist application", kind: "semifinal", scope: scope() }, "Semifinalist application", [stageSource]), timings: [], durations: [], timeCommitments: [], formats: [disclosed("coke-semifinal-format", { formats: ["online"], scope: scope() }, "Online", [stageSource])], locations: [], selectionRules: [], advancement: [disclosed("coke-finalist-count", { count: 250, description: "250 Regional Finalists", scope: scope() }, "250 Regional Finalists", [evidence(COKE.apply, "250 Regional Finalists will be selected")])], requirements: [], travelRequirements: [] },
    { id: "coke-stage-interview", order: 3, definition: disclosed("coke-interview-stage", { label: "Regional Finalist interview", kind: "interview", scope: scope() }, "Regional Finalist interview", [evidence(COKE.apply, "Regional Finalists will participate in online interviews")]), timings: [], durations: [], timeCommitments: [], formats: [disclosed("coke-interview-format", { formats: ["online"], scope: scope() }, "Online interview", [evidence(COKE.apply, "Regional Finalists will participate in online interviews")])], locations: [], selectionRules: [], advancement: [disclosed("coke-scholar-count", { count: 150, description: "150 Coca-Cola Scholars", scope: scope() }, "150 Scholars", [headline])], requirements: [], travelRequirements: [] },
    { id: "coke-stage-weekend", order: 4, definition: disclosed("coke-weekend-stage", { label: "Scholars Weekend", kind: "summit_final", scope: scope() }, "Scholars Weekend", [evidence(COKE.apply, "Scholars Weekend in Atlanta")]), timings: [{ ...disclosed("coke-weekend-timing", { event: "starts", when: { precision: "month", year: 2027, month: 4, certainty: "stated" }, scope: scope() }, "April 2027", [evidence(COKE.apply, "Scholars Weekend in April")]) }], durations: [], timeCommitments: [], formats: [disclosed("coke-weekend-format", { formats: ["in_person"], scope: scope() }, "In person", [evidence(COKE.apply, "Scholars Weekend in Atlanta")])], locations: [disclosed("coke-weekend-location", { location: "Atlanta, Georgia", scope: scope() }, "Atlanta, Georgia", [evidence(COKE.apply, "Scholars Weekend in Atlanta")])], selectionRules: [], advancement: [], requirements: [], travelRequirements: [disclosed("coke-weekend-travel", { requirement: "required", scope: scope() }, "Scholar attendance in Atlanta", [evidence(COKE.apply, "Scholars Weekend in Atlanta")])] },
  ] };
  card.pathways = { status: "modeled", note: null, records: [{ id: "coke-pathway", definition: disclosed("coke-pathway-definition", { label: "Scholar selection pathway", variantIds: [] }, "Scholar selection pathway", [stageSource]), steps: [
    disclosed("coke-step-application", { stageId: "coke-stage-application", enterWhen: null }, "Initial application", [deadline]), disclosed("coke-step-semifinal", { stageId: "coke-stage-semifinal", enterWhen: "Selected as a Semifinalist." }, "Semifinalist application", [stageSource]), disclosed("coke-step-interview", { stageId: "coke-stage-interview", enterWhen: "Selected as a Regional Finalist." }, "Regional Finalist interview", [evidence(COKE.apply, "250 Regional Finalists will be selected")]), disclosed("coke-step-weekend", { stageId: "coke-stage-weekend", enterWhen: "Selected as one of 150 Scholars." }, "Scholars Weekend", [headline]),
  ] }] };
  card.costItems = { status: "modeled", completeness: "incomplete", note: "The application is free; the reviewed pages did not establish all possible travel arrangements for Scholars Weekend.", records: [{ id: "coke-cost-application", definition: disclosed("coke-application-fee-definition", { label: "Application fee", kind: "application_fee", requirement: "required", scope: scope() }, "Free application", [evidence(COKE.apply, "There is no application fee")]), amount: disclosed("coke-application-fee-amount", { kind: "exact", amount: 0, currency: "USD" }, "$0", [evidence(COKE.apply, "There is no application fee")]), chargeBasis: disclosed("coke-application-fee-basis", "per_application", "Per application", [evidence(COKE.apply, "There is no application fee")]), treatment: null, refundability: null, includedItems: [], excludedItems: [], conditions: [] }] };
  card.outcomes = { status: "modeled", note: null, records: [{ id: "coke-outcome-scholarship", definition: disclosed("coke-scholarship-definition", { label: "$20,000 Coca-Cola Scholars Program scholarship", outcomeType: "scholarship", scope: scope() }, "$20,000 scholarship", [headline]), recipientScope: disclosed("coke-scholarship-recipient", "individual", "Individual Scholar", [headline]), monetaryNature: disclosed("coke-scholarship-nature", "restricted_funding", "Scholarship funding", [evidence(COKE.faq, "Scholarship funds may be used for tuition, fees, books, supplies, equipment, and room and board")]), amount: disclosed("coke-scholarship-amount", { kind: "exact", amount: 20000, currency: "USD" }, "$20,000", [headline]), distribution: disclosed("coke-scholarship-distribution", [{ payee: "service_provider", method: "direct", condition: "Used for eligible educational expenses through the Foundation's scholarship administration." }], "Educational-expense administration", [evidence(COKE.faq, "Scholarship funds may be used for tuition, fees, books, supplies, equipment, and room and board")]), rank: null, track: null, quantity: null, useRestriction: disclosed("coke-scholarship-use", "Eligible educational expenses including tuition, fees, books, supplies, equipment, and room and board.", "Eligible educational expenses", [evidence(COKE.faq, "Scholarship funds may be used for tuition, fees, books, supplies, equipment, and room and board")]), combinability: null, conditions: [] }] };
  return finish(card);
}

const YYGS = {
  home: { id: "yygs-home", url: "https://globalscholars.yale.edu/", title: "Yale Young Global Scholars", pageType: "official_program_page" },
  aid: { id: "yygs-aid", url: "https://globalscholars.yale.edu/tuition/financial-aid", title: "Financial Aid - Yale Young Global Scholars", pageType: "official_financial_aid_page" },
  rules: { id: "yygs-rules", url: "https://globalscholars.yale.edu/residential-rules-regulations", title: "Residential Rules and Regulations - Yale Young Global Scholars", pageType: "official_rules" },
  deadlines: { id: "yygs-deadlines", url: "https://globalscholars.yale.edu/application-deadlines", title: "Application Deadlines - Yale Young Global Scholars", pageType: "official_program_page" },
} satisfies Record<string, SourceDefinition>;

function yygs(): OpportunityCard {
  const card = baseCard("yale-young-global-scholars-summer-2027", "yale-young-global-scholars", "Yale Young Global Scholars has announced three residential two-week sessions at Yale for June and July 2027; 2027 tuition and application deadlines were not yet published on the reviewed pages.", Object.values(YYGS));
  const session = evidence(YYGS.home, "YYGS is excited to offer residential sessions for June & July 2027. We are not offering online sessions at this time.");
  const duration = evidence(YYGS.home, "Each summer, students from over 150 countries participate in one interdisciplinary, two-week session at Yale's historic campus.");
  setFact(card, "opportunity_name", "Yale Young Global Scholars", "Yale Young Global Scholars", evidence(YYGS.home, "Yale Young Global Scholars"), { kind: "text", value: "Yale Young Global Scholars" });
  setFact(card, "opportunity_category", "Residential academic enrichment program", "Residential academic enrichment program", evidence(YYGS.home, "YYGS is an academic enrichment program for outstanding high school students from around the world"));
  setFact(card, "official_url", YYGS.home.url, YYGS.home.url, session, { kind: "text", value: YYGS.home.url });
  setFact(card, "geographic_restrictions", "Students from around the world", "International", evidence(YYGS.home, "students from over 150 countries"));
  setFact(card, "entry_format", "Individual application", "Individual application", evidence(YYGS.deadlines, "All students must submit an online application"));
  setFact(card, "financial_aid", "Need-based financial aid can cover up to 100% of tuition", "Need-based aid up to 100% of tuition", evidence(YYGS.aid, "YYGS provides need-based financial aid equally to both domestic and international students, which is offered as a tuition discount (up to 100% of tuition)"));
  setFact(card, "cancellation_policy", "Participants may be dismissed for violating residential rules", "Residential-rule violations can result in dismissal", evidence(YYGS.rules, "Failure to abide by these rules and regulations may result in dismissal from the program"));
  setNotApplicable(card, "college_credit", "The reviewed 2027 program pages describe academic enrichment, not college credit.");
  card.cycle = { status: "modeled", value: { id: "yygs-cycle-summer-2027", label: disclosed("yygs-cycle-label", "Summer 2027", "Summer 2027", [session]), status: disclosed("yygs-cycle-status", "announced", "Announced", [session]), year: disclosed("yygs-cycle-year", 2027, "2027", [session]), startYear: null, endYear: null, season: disclosed("yygs-cycle-season", "summer", "Summer", [session]), cycleType: disclosed("yygs-cycle-type", "seasonal", "Seasonal", [session]), timingRefs: { opens: null, closes: null, coverageStart: "yygs-session-one-start", coverageEnd: "yygs-session-three-end" } } };
  card.organizations = { status: "modeled", note: null, records: [{ id: "yygs-org-yale", name: disclosed("yygs-yale-name", "Yale University", "Yale University", [duration]), kind: disclosed("yygs-yale-kind", "higher_education_institution", "Higher-education institution", [duration]) }] };
  card.organizationRoles = { status: "modeled", note: null, records: [{ id: "yygs-yale-operator", organizationId: "yygs-org-yale", role: disclosed("yygs-yale-operator-claim", { role: "operator", roleLabel: null, scope: scope() }, "Operator", [evidence(YYGS.home, "a Yale University program")]) }] };
  card.institutionRelationships = { status: "modeled", note: null, records: [{ id: "yygs-yale-operated", assertion: disclosed("yygs-yale-operated-claim", { subject: "opportunity", subjectOrganizationId: "yygs-org-yale", targetOrganizationId: "yygs-org-yale", targetInstitutionName: null, relationshipType: "institution_operated", description: "YYGS is a Yale University program held on Yale's campus.", scope: scope() }, "Institution operated — Yale University", [evidence(YYGS.home, "a Yale University program")]) }] };
  const s1 = evidence(YYGS.home, "Session I: June 20 - July 2, 2027");
  const s2 = evidence(YYGS.home, "Session II: July 4 - July 16, 2027");
  const s3 = evidence(YYGS.home, "Session III: July 18 - July 30, 2027");
  card.variants = { status: "modeled", note: "All three cohorts are residential and two weeks; academic-session choices are offered within them.", records: [
    { id: "yygs-session-one", definition: disclosed("yygs-session-one-definition", { label: "Session I", kind: "cohort", parentVariantId: null }, "Session I", [s1]), eligibilityDifferences: [], notes: [] },
    { id: "yygs-session-two", definition: disclosed("yygs-session-two-definition", { label: "Session II", kind: "cohort", parentVariantId: null }, "Session II", [s2]), eligibilityDifferences: [], notes: [] },
    { id: "yygs-session-three", definition: disclosed("yygs-session-three-definition", { label: "Session III", kind: "cohort", parentVariantId: null }, "Session III", [s3]), eligibilityDifferences: [], notes: [] },
  ] };
  card.stages = { status: "modeled", note: "The 2027 application schedule was not yet published; the program-session dates were.", records: [
    { id: "yygs-application", order: 1, definition: disclosed("yygs-application-stage", { label: "Application", kind: "application", scope: scope() }, "Application", [evidence(YYGS.deadlines, "The YYGS application")]), timings: [], durations: [], timeCommitments: [], formats: [disclosed("yygs-application-format", { formats: ["online"], scope: scope() }, "Online", [evidence(YYGS.deadlines, "online application")])], locations: [], selectionRules: [], advancement: [], requirements: [], travelRequirements: [] },
    { id: "yygs-program", order: 2, definition: disclosed("yygs-program-stage", { label: "Residential academic session", kind: "program", scope: scope(["yygs-session-one", "yygs-session-two", "yygs-session-three"]) }, "Residential academic session", [duration]), timings: [
      disclosed("yygs-session-one-start", { event: "starts", when: { precision: "date", date: "2027-06-20", certainty: "stated" }, scope: scope(["yygs-session-one"]) }, "June 20, 2027", [s1]), disclosed("yygs-session-one-end", { event: "ends", when: { precision: "date", date: "2027-07-02", certainty: "stated" }, scope: scope(["yygs-session-one"]) }, "July 2, 2027", [s1]),
      disclosed("yygs-session-two-start", { event: "starts", when: { precision: "date", date: "2027-07-04", certainty: "stated" }, scope: scope(["yygs-session-two"]) }, "July 4, 2027", [s2]), disclosed("yygs-session-two-end", { event: "ends", when: { precision: "date", date: "2027-07-16", certainty: "stated" }, scope: scope(["yygs-session-two"]) }, "July 16, 2027", [s2]),
      disclosed("yygs-session-three-start", { event: "starts", when: { precision: "date", date: "2027-07-18", certainty: "stated" }, scope: scope(["yygs-session-three"]) }, "July 18, 2027", [s3]), disclosed("yygs-session-three-end", { event: "ends", when: { precision: "date", date: "2027-07-30", certainty: "stated" }, scope: scope(["yygs-session-three"]) }, "July 30, 2027", [s3]),
    ], durations: [disclosed("yygs-program-duration", { duration: { minimum: 2, maximum: null, unit: "weeks" }, scope: scope() }, "Two weeks", [duration])], timeCommitments: [], formats: [disclosed("yygs-program-format", { formats: ["residential"], scope: scope() }, "Residential", [session])], locations: [disclosed("yygs-program-location", { location: "Yale University campus, New Haven, Connecticut", scope: scope() }, "Yale University campus", [duration])], selectionRules: [], advancement: [], requirements: [], travelRequirements: [disclosed("yygs-program-travel", { requirement: "required", scope: scope() }, "Travel to Yale campus is required for participation", [session])] },
  ] };
  card.pathways = { status: "modeled", note: null, records: [{ id: "yygs-pathway", definition: disclosed("yygs-pathway-definition", { label: "Application to residential session", variantIds: ["yygs-session-one", "yygs-session-two", "yygs-session-three"] }, "Application to residential session", [duration]), steps: [disclosed("yygs-step-apply", { stageId: "yygs-application", enterWhen: null }, "Apply", [evidence(YYGS.deadlines, "The YYGS application")]), disclosed("yygs-step-program", { stageId: "yygs-program", enterWhen: "Admitted and enrolled in one session." }, "Attend session", [duration])] }] };
  card.costItems = { status: "none_found", records: [], note: "The reviewed official pages had not published a 2027 tuition amount. Prior-cycle prices were not carried forward." };
  card.outcomes = { status: "modeled", note: null, records: [{ id: "yygs-outcome-seat", definition: disclosed("yygs-seat-definition", { label: "Place in a two-week YYGS academic session", outcomeType: "program_seat", scope: scope(["yygs-session-one", "yygs-session-two", "yygs-session-three"]) }, "Place in a two-week YYGS session", [duration]), recipientScope: disclosed("yygs-seat-recipient", "individual", "Individual student", [duration]), monetaryNature: disclosed("yygs-seat-nature", "not_monetized", "Program participation; tuition is separate", [duration]), amount: null, distribution: null, rank: null, track: null, quantity: null, useRestriction: null, combinability: null, conditions: [] }] };
  return finish(card);
}

const POLY = {
  core: { id: "poly-core", url: "https://www.polygence.org/core-program", title: "Core Program - Polygence", pageType: "official_program_page" },
  faq: { id: "poly-faq", url: "https://www.polygence.org/faq", title: "FAQ - Polygence", pageType: "official_faq" },
  about: { id: "poly-about", url: "https://www.polygence.org/about", title: "About - Polygence", pageType: "official_program_page" },
  terms: { id: "poly-terms", url: "https://www.polygence.org/terms-of-use", title: "Terms of Use - Polygence", pageType: "official_terms" },
  privacy: { id: "poly-privacy", url: "https://www.polygence.org/privacy-policy", title: "Privacy Policy - Polygence", pageType: "official_privacy_policy" },
  counselors: { id: "poly-counselors", url: "https://www.polygence.org/counselor", title: "For Counselors - Polygence", pageType: "official_program_page" },
} satisfies Record<string, SourceDefinition>;

function polygence(): OpportunityCard {
  const card = baseCard("polygence-core-program-fall-2026", "polygence-core-program", "Polygence Core is a rolling online one-to-one research-mentorship program built around ten mentor sessions; reviewed pricing begins around $3,000, but a single exact Core price was not published on the reviewed pages.", Object.values(POLY));
  const sessions = evidence(POLY.core, "10 one-on-one, hour-long sessions with your mentor");
  const price = evidence(POLY.faq, "Our programs start at around $3,000, except for our Pods program");
  setFact(card, "opportunity_name", "Polygence Core Program", "Polygence Core Program", evidence(POLY.core, "Core Program"), { kind: "text", value: "Polygence Core Program" });
  setFact(card, "opportunity_category", "Online independent research mentorship program", "Online independent research mentorship program", evidence(POLY.about, "Polygence is an online research program"));
  setFact(card, "official_url", POLY.core.url, POLY.core.url, sessions, { kind: "text", value: POLY.core.url });
  setFact(card, "entry_format", "Individual enrollment and mentor match", "Individual", evidence(POLY.core, "one-on-one"));
  setFact(card, "participation_format", "Online", "Online", evidence(POLY.about, "online research program"), { kind: "participation_format", value: "online" });
  setFact(card, "financial_aid", "Need-based financial aid is available", "Need-based financial aid available", evidence(POLY.counselors, "We offer need-based financial aid"));
  setFact(card, "refund_policy", "Written-request refunds are reduced by a 3.25% fee; completed sessions are not refunded", "Conditional refund; 3.25% fee and used-session deductions", evidence(POLY.faq, "All refunds are subject to a 3.25% processing fee"));
  setFact(card, "personal_information", ["Name", "Age", "Contact information", "School", "Parent information"], "Identity, contact, school, and parent information", evidence(POLY.privacy, "name, age, contact details, school information, and parent or guardian information"));
  setFact(card, "data_sharing", "Information may be shared with mentors, parents, referrers, and service providers", "Mentors, parents, referrers, and service providers", evidence(POLY.privacy, "we may share your information with mentors, parents or guardians, referrers, and service providers"));
  setFact(card, "project_ownership", "Student owns Individual Data", "Student owns Individual Data", evidence(POLY.terms, "You will own your Individual Data."));
  setFact(card, "project_license", "Polygence receives a non-exclusive, perpetual, irrevocable, worldwide, sublicensable, transferable, royalty-free license", "Broad perpetual license to Individual Data", evidence(POLY.terms, "You hereby grant us a non-exclusive, perpetual, irrevocable, worldwide, sublicensable, transferable, royalty free, fully paid up license"));
  setFact(card, "cancellation_rights", "Polygence may alter or suspend services", "Polygence may alter or suspend services", evidence(POLY.terms, "we may alter, suspend, or discontinue the Services at any time"));
  card.cycle = { status: "modeled", value: { id: "poly-cycle-fall-2026", label: disclosed("poly-cycle-label", "Fall 2026 entry", "Fall 2026 entry", [evidence(POLY.counselors, "Each month, we start a new cohort")]), status: disclosed("poly-cycle-status", "applications_open", "Rolling enrollment", [evidence(POLY.counselors, "Each month, we start a new cohort")]), year: disclosed("poly-cycle-year", 2026, "2026", [evidence(POLY.counselors, "Each month, we start a new cohort")]), startYear: null, endYear: null, season: disclosed("poly-cycle-season", "fall", "Fall", [evidence(POLY.counselors, "Each month, we start a new cohort")]), cycleType: disclosed("poly-cycle-type", "rolling", "Rolling", [evidence(POLY.counselors, "Each month, we start a new cohort")]), timingRefs: { opens: null, closes: null, coverageStart: null, coverageEnd: null } } };
  card.organizations = { status: "modeled", note: null, records: [{ id: "poly-org", name: disclosed("poly-org-name", "Polygence, Inc.", "Polygence, Inc.", [evidence(POLY.terms, "Polygence, Inc.")]), kind: disclosed("poly-org-kind", "education_provider", "Independent education provider", [evidence(POLY.about, "online research program")]) }] };
  card.organizationRoles = { status: "modeled", note: null, records: [{ id: "poly-role-operator", organizationId: "poly-org", role: disclosed("poly-role-operator-claim", { role: "operator", roleLabel: null, scope: scope() }, "Operator", [evidence(POLY.terms, "Polygence, Inc.")]) }] };
  card.institutionRelationships = { status: "modeled", note: "Mentor affiliations are not institutional sponsorship or partnership.", records: [{ id: "poly-independent", assertion: disclosed("poly-independent-claim", { subject: "opportunity", subjectOrganizationId: "poly-org", targetOrganizationId: null, targetInstitutionName: "No operating university", relationshipType: "independent", description: "Polygence is represented as an independent education provider; mentor affiliations are person affiliations only.", scope: scope() }, "Independent education provider", [evidence(POLY.about, "online research program")]) }] };
  card.variants = { status: "modeled", note: null, records: [{ id: "poly-core-variant", definition: disclosed("poly-core-definition", { label: "Core Program", kind: "tier", parentVariantId: null }, "Core Program", [sessions]), eligibilityDifferences: [], notes: [] }] };
  card.stages = { status: "modeled", note: null, records: [
    { id: "poly-stage-enrollment", order: 1, definition: disclosed("poly-enrollment-stage", { label: "Enrollment and mentor matching", kind: "matching", scope: scope(["poly-core-variant"]) }, "Enrollment and mentor matching", [evidence(POLY.core, "matched with an expert mentor")]), timings: [], durations: [], timeCommitments: [], formats: [disclosed("poly-enrollment-format", { formats: ["online"], scope: scope() }, "Online", [evidence(POLY.about, "online research program")])], locations: [], selectionRules: [], advancement: [], requirements: [], travelRequirements: [disclosed("poly-travel-none", { requirement: "none", scope: scope() }, "No travel", [evidence(POLY.about, "online research program")])] },
    { id: "poly-stage-program", order: 2, definition: disclosed("poly-program-stage", { label: "Core research mentorship", kind: "program", scope: scope(["poly-core-variant"]) }, "Core research mentorship", [sessions]), timings: [], durations: [disclosed("poly-program-duration", { duration: { minimum: 3, maximum: 6, unit: "months" }, scope: scope() }, "Typically 3–6 months", [evidence(POLY.counselors, "Most projects take 3-6 months")])], timeCommitments: [], formats: [disclosed("poly-program-format", { formats: ["online"], scope: scope() }, "Online", [evidence(POLY.about, "online research program")])], locations: [], selectionRules: [], advancement: [], requirements: [disclosed("poly-ten-sessions", { requirement: "Ten one-to-one hour-long mentor sessions.", scope: scope() }, "Ten one-to-one sessions", [sessions])], travelRequirements: [] },
  ] };
  card.pathways = { status: "modeled", note: null, records: [{ id: "poly-pathway", definition: disclosed("poly-pathway-definition", { label: "Enrollment to research project", variantIds: ["poly-core-variant"] }, "Enrollment to research project", [sessions]), steps: [disclosed("poly-step-enroll", { stageId: "poly-stage-enrollment", enterWhen: null }, "Enroll and match", [evidence(POLY.core, "matched with an expert mentor")]), disclosed("poly-step-program", { stageId: "poly-stage-program", enterWhen: "Mentor match is accepted." }, "Complete research mentorship", [sessions])] }] };
  card.costItems = { status: "modeled", completeness: "incomplete", note: "The reviewed FAQ says programs start around $3,000 but does not state one exact Core price; installment payments add 8%.", records: [
    { id: "poly-cost-tuition", definition: disclosed("poly-tuition-definition", { label: "Core Program tuition", kind: "tuition", requirement: "required", scope: scope(["poly-core-variant"]) }, "Core Program tuition", [price]), amount: unclear("poly-tuition-amount", "The source publishes a starting price across programs rather than one exact Core Program tuition.", [price]), chargeBasis: disclosed("poly-tuition-basis", "per_participant", "Per participant", [sessions]), treatment: null, refundability: disclosed("poly-refundability", { kind: "conditional", condition: "Written request; 3.25% fee; completed sessions are not refunded." }, "Conditional refund", [evidence(POLY.faq, "All refunds are subject to a 3.25% processing fee")]), includedItems: [disclosed("poly-included-sessions", "Ten one-to-one hour-long mentor sessions", "Ten mentor sessions", [sessions])], excludedItems: [], conditions: [] },
    { id: "poly-cost-installment", definition: disclosed("poly-installment-definition", { label: "Installment-plan surcharge", kind: "other", requirement: "conditional", scope: scope(["poly-core-variant"]) }, "Installment-plan surcharge", [evidence(POLY.faq, "six monthly installments with an 8% installment fee")]), amount: notFound("poly-installment-amount", "The 8% surcharge depends on the unresolved base tuition amount."), chargeBasis: disclosed("poly-installment-basis", "per_participant", "Per participant", [evidence(POLY.faq, "six monthly installments with an 8% installment fee")]), treatment: null, refundability: null, includedItems: [], excludedItems: [], conditions: [disclosed("poly-installment-condition", "Applies when the six-month installment option is selected.", "Six-month installment option", [evidence(POLY.faq, "six monthly installments with an 8% installment fee")])] },
  ] };
  card.outcomes = { status: "modeled", note: null, records: [
    { id: "poly-outcome-mentorship", definition: disclosed("poly-mentorship-definition", { label: "Ten one-to-one mentor sessions", outcomeType: "mentorship", scope: scope(["poly-core-variant"]) }, "Ten one-to-one mentor sessions", [sessions]), recipientScope: disclosed("poly-mentorship-recipient", "individual", "Individual student", [sessions]), monetaryNature: disclosed("poly-mentorship-nature", "not_monetized", "Included service; no separate value published", [sessions]), amount: null, distribution: null, rank: null, track: null, quantity: disclosed("poly-mentorship-quantity", { minimum: 10, maximum: null, unit: "sessions" }, "10 sessions", [sessions]), useRestriction: null, combinability: null, conditions: [] },
    { id: "poly-outcome-showcase", definition: disclosed("poly-showcase-definition", { label: "Eligibility to publish in the Polygence project database", outcomeType: "other_in_kind", scope: scope(["poly-core-variant"]) }, "Project database publication opportunity", [evidence(POLY.core, "Opportunity to publish your project in the Polygence project database")]), recipientScope: disclosed("poly-showcase-recipient", "individual", "Individual student", [evidence(POLY.core, "your project")]), monetaryNature: disclosed("poly-showcase-nature", "not_monetized", "No monetary value published", [evidence(POLY.core, "Opportunity to publish your project")]), amount: null, distribution: null, rank: null, track: null, quantity: null, useRestriction: null, combinability: null, conditions: [] },
  ] };
  return finish(card);
}

const MITES = {
  home: { id: "mites-home", url: "https://mites.mit.edu/", title: "MITES", pageType: "official_program_page" },
  summer: { id: "mites-summer", url: "https://mites.mit.edu/discover-mites/mites-summer/", title: "MITES Summer", pageType: "official_program_page" },
  apply: { id: "mites-apply", url: "https://mites.mit.edu/discover-mites/apply-to-mites/prepare-your-application-mites-summer-and-mites-semester/", title: "Prepare Your MITES Application", pageType: "official_program_page" },
  faq: { id: "mites-faq", url: "https://mites.mit.edu/discover-mites/faq-for-prospective-students/faqs-mites-semester-and-mites-summer/", title: "FAQs - MITES Summer and Semester", pageType: "official_faq" },
  about: { id: "mites-about", url: "https://mites.mit.edu/about-us/", title: "About Us - MITES", pageType: "official_program_page" },
} satisfies Record<string, SourceDefinition>;

function mites(): OpportunityCard {
  const card = baseCard("mites-summer-2027", "mites-summer", "MITES Summer is a free six-week residential STEM program operated within MIT's School of Engineering for eligible rising high-school seniors; 2027 exact program dates were not yet published.", Object.values(MITES));
  const free = evidence(MITES.home, "All MITES programs are free of cost. We cover all educational, food, and boarding costs. Students only pay for transportation to and from MIT.");
  const six = evidence(MITES.summer, "MITES Summer is a six-week residential academic enrichment program");
  const eligibility = evidence(MITES.apply, "Applicants must be U.S. citizens or permanent residents and must be in 11th grade at the time of application");
  setFact(card, "opportunity_name", "MITES Summer", "MITES Summer", evidence(MITES.summer, "MITES Summer"), { kind: "text", value: "MITES Summer" });
  setFact(card, "opportunity_category", "Selective residential STEM enrichment program", "Selective residential STEM enrichment program", six);
  setFact(card, "official_url", MITES.summer.url, MITES.summer.url, six, { kind: "text", value: MITES.summer.url });
  setFact(card, "grade_levels", ["11 at application", "Rising 12 during program"], "11th-grade applicants / rising seniors", eligibility, { kind: "text_list", values: ["11", "12"] });
  setFact(card, "citizenship_restrictions", "U.S. citizens or permanent residents", "U.S. citizens or permanent residents", eligibility);
  setFact(card, "entry_format", "Individual application", "Individual application", evidence(MITES.apply, "application"));
  setFact(card, "financial_aid", "Travel scholarships are available for students who cannot afford transportation", "Travel scholarships available", evidence(MITES.home, "Travel scholarships are available for students who cannot afford the transportation cost"));
  setFact(card, "travel_included", false, "Transportation is not automatically included", free, { kind: "boolean", value: false });
  setFact(card, "lodging_included", true, "Boarding is covered", free, { kind: "boolean", value: true });
  setFact(card, "meals_included", true, "Food is covered", free, { kind: "boolean", value: true });
  setNotApplicable(card, "refund_policy", "The program charges no tuition, food, or boarding payment to refund.");
  card.cycle = { status: "modeled", value: { id: "mites-cycle-summer-2027", label: disclosed("mites-cycle-label", "Summer 2027", "Summer 2027", [evidence(MITES.faq, "2027 MITES Summer dates are not yet available")]), status: disclosed("mites-cycle-status", "announced", "Announced; exact dates pending", [evidence(MITES.faq, "2027 MITES Summer dates are not yet available")]), year: disclosed("mites-cycle-year", 2027, "2027", [evidence(MITES.faq, "2027 MITES Summer dates")]), startYear: null, endYear: null, season: disclosed("mites-cycle-season", "summer", "Summer", [six]), cycleType: disclosed("mites-cycle-type", "seasonal", "Seasonal", [six]), timingRefs: { opens: null, closes: null, coverageStart: null, coverageEnd: null } } };
  card.organizations = { status: "modeled", note: null, records: [
    { id: "mites-org", name: disclosed("mites-org-name", "MITES", "MITES", [evidence(MITES.about, "MITES")]), kind: disclosed("mites-org-kind", "institution_unit", "MIT School of Engineering program", [evidence(MITES.about, "an integral part of MIT's School of Engineering")]) },
    { id: "mites-mit", name: disclosed("mites-mit-name", "Massachusetts Institute of Technology", "Massachusetts Institute of Technology", [evidence(MITES.about, "MIT's School of Engineering")]), kind: disclosed("mites-mit-kind", "higher_education_institution", "Higher-education institution", [evidence(MITES.about, "MIT's School of Engineering")]) },
  ] };
  card.organizationRoles = { status: "modeled", note: null, records: [{ id: "mites-role-operator", organizationId: "mites-org", role: disclosed("mites-role-operator-claim", { role: "operator", roleLabel: null, scope: scope() }, "Operator", [evidence(MITES.about, "an integral part of MIT's School of Engineering")]) }, { id: "mites-role-host", organizationId: "mites-mit", role: disclosed("mites-role-host-claim", { role: "host", roleLabel: null, scope: scope() }, "Host institution", [evidence(MITES.summer, "on MIT's campus")]) }] };
  card.institutionRelationships = { status: "modeled", note: null, records: [{ id: "mites-mit-operated", assertion: disclosed("mites-mit-operated-claim", { subject: "opportunity", subjectOrganizationId: "mites-org", targetOrganizationId: "mites-mit", targetInstitutionName: null, relationshipType: "institution_operated", description: "MITES is an integral part of MIT's School of Engineering.", scope: scope() }, "Institution operated — MIT", [evidence(MITES.about, "an integral part of MIT's School of Engineering")]) }] };
  card.variants = { status: "modeled", note: null, records: [{ id: "mites-summer-variant", definition: disclosed("mites-summer-definition", { label: "MITES Summer", kind: "cohort", parentVariantId: null }, "MITES Summer", [six]), eligibilityDifferences: [], notes: [] }] };
  card.stages = { status: "modeled", note: "The official site described typical application months but did not yet publish exact 2027 dates.", records: [
    { id: "mites-stage-application", order: 1, definition: disclosed("mites-application-stage", { label: "Shared MITES application", kind: "application", scope: scope(["mites-summer-variant"]) }, "Shared MITES application", [evidence(MITES.apply, "The MITES Summer and MITES Semester programs share one application")]), timings: [], durations: [], timeCommitments: [], formats: [disclosed("mites-application-format", { formats: ["online"], scope: scope() }, "Online", [evidence(MITES.apply, "online application")])], locations: [], selectionRules: [disclosed("mites-selection-rule", { rule: "Applications are reviewed holistically.", scope: scope() }, "Holistic review", [evidence(MITES.apply, "Applications are reviewed holistically")])], advancement: [], requirements: [], travelRequirements: [] },
    { id: "mites-stage-program", order: 2, definition: disclosed("mites-program-stage", { label: "Six-week residential program", kind: "program", scope: scope(["mites-summer-variant"]) }, "Six-week residential program", [six]), timings: [], durations: [disclosed("mites-program-duration", { duration: { minimum: 6, maximum: null, unit: "weeks" }, scope: scope() }, "Six weeks", [six])], timeCommitments: [disclosed("mites-program-hours", { minimumHours: 40, maximumHours: null, period: "week", label: "Weekdays 9 a.m.–5 p.m.", scope: scope() }, "Weekdays 9 a.m.–5 p.m.", [evidence(MITES.summer, "classes are held weekdays from 9:00 a.m. to 5:00 p.m.")])], formats: [disclosed("mites-program-format", { formats: ["residential"], scope: scope() }, "Residential", [six])], locations: [disclosed("mites-program-location", { location: "MIT campus, Cambridge, Massachusetts", scope: scope() }, "MIT campus", [evidence(MITES.summer, "on MIT's campus")])], selectionRules: [], advancement: [], requirements: [], travelRequirements: [disclosed("mites-program-travel", { requirement: "required", scope: scope() }, "Student arranges travel to and from MIT", [free])] },
  ] };
  card.pathways = { status: "modeled", note: null, records: [{ id: "mites-pathway", definition: disclosed("mites-pathway-definition", { label: "Application to MITES Summer", variantIds: ["mites-summer-variant"] }, "Application to MITES Summer", [six]), steps: [disclosed("mites-step-apply", { stageId: "mites-stage-application", enterWhen: null }, "Apply", [evidence(MITES.apply, "share one application")]), disclosed("mites-step-program", { stageId: "mites-stage-program", enterWhen: "Selected for MITES Summer." }, "Attend MITES Summer", [six])] }] };
  card.costItems = { status: "modeled", completeness: "incomplete", note: "Tuition, food, and boarding are covered; student transportation varies and no amount is published.", records: [
    { id: "mites-cost-tuition", definition: disclosed("mites-tuition-definition", { label: "Tuition and educational costs", kind: "tuition", requirement: "required", scope: scope() }, "Tuition and educational costs", [free]), amount: disclosed("mites-tuition-amount", { kind: "exact", amount: 0, currency: "USD" }, "$0", [free]), chargeBasis: disclosed("mites-tuition-basis", "per_participant", "Per participant", [free]), treatment: null, refundability: null, includedItems: [], excludedItems: [], conditions: [] },
    { id: "mites-cost-lodging", definition: disclosed("mites-lodging-definition", { label: "Boarding", kind: "lodging", requirement: "required", scope: scope() }, "Boarding", [free]), amount: disclosed("mites-lodging-amount", { kind: "exact", amount: 0, currency: "USD" }, "$0", [free]), chargeBasis: disclosed("mites-lodging-basis", "per_participant", "Per participant", [free]), treatment: null, refundability: null, includedItems: [], excludedItems: [], conditions: [] },
    { id: "mites-cost-meals", definition: disclosed("mites-meals-definition", { label: "Food", kind: "meals", requirement: "required", scope: scope() }, "Food", [free]), amount: disclosed("mites-meals-amount", { kind: "exact", amount: 0, currency: "USD" }, "$0", [free]), chargeBasis: disclosed("mites-meals-basis", "per_participant", "Per participant", [free]), treatment: null, refundability: null, includedItems: [], excludedItems: [], conditions: [] },
    { id: "mites-cost-travel", definition: disclosed("mites-travel-definition", { label: "Transportation to and from MIT", kind: "travel", requirement: "required", scope: scope() }, "Transportation to and from MIT", [free]), amount: notFound("mites-travel-amount", "Transportation cost depends on the participant's origin; no amount is published."), chargeBasis: disclosed("mites-travel-basis", "per_traveler", "Per traveler", [free]), treatment: null, refundability: null, includedItems: [], excludedItems: [], conditions: [] },
  ] };
  card.outcomes = { status: "modeled", note: null, records: [
    { id: "mites-outcome-seat", definition: disclosed("mites-seat-definition", { label: "Place in MITES Summer", outcomeType: "program_seat", scope: scope(["mites-summer-variant"]) }, "Place in MITES Summer", [six]), recipientScope: disclosed("mites-seat-recipient", "individual", "Individual student", [six]), monetaryNature: disclosed("mites-seat-nature", "not_monetized", "Program seat; costs modeled separately", [six]), amount: null, distribution: null, rank: null, track: null, quantity: null, useRestriction: null, combinability: null, conditions: [] },
    { id: "mites-outcome-evaluation", definition: disclosed("mites-evaluation-definition", { label: "Written instructor evaluation", outcomeType: "other_in_kind", scope: scope() }, "Written instructor evaluation", [evidence(MITES.summer, "Students receive a written evaluation from each instructor")]), recipientScope: disclosed("mites-evaluation-recipient", "individual", "Individual student", [evidence(MITES.summer, "Students receive a written evaluation")]), monetaryNature: disclosed("mites-evaluation-nature", "not_monetized", "No monetary value published", [evidence(MITES.summer, "written evaluation")]), amount: null, distribution: null, rank: null, track: null, quantity: null, useRestriction: null, combinability: null, conditions: [] },
  ] };
  return finish(card);
}

const BJC = {
  home: { id: "bjc-home", url: "https://breakthroughjuniorchallenge.org/", title: "Breakthrough Junior Challenge", pageType: "official_program_page" },
  rules: { id: "bjc-rules", url: "https://breakthroughjuniorchallenge.org/rules", title: "Official Rules - Breakthrough Junior Challenge", pageType: "official_rules" },
  faq: { id: "bjc-faq", url: "https://breakthroughjuniorchallenge.org/faq", title: "FAQ - Breakthrough Junior Challenge", pageType: "official_faq" },
  privacy: { id: "bjc-privacy", url: "https://breakthroughjuniorchallenge.org/privacy", title: "Privacy Policy - Breakthrough Junior Challenge", pageType: "official_privacy_policy" },
  terms: { id: "bjc-terms", url: "https://breakthroughjuniorchallenge.org/terms", title: "Terms of Use - Breakthrough Junior Challenge", pageType: "official_terms" },
} satisfies Record<string, SourceDefinition>;

function breakthrough(): OpportunityCard {
  const card = baseCard("breakthrough-junior-challenge-2026", "breakthrough-junior-challenge", "The 2026 Breakthrough Junior Challenge is an individual global science-video competition for ages 13–18 with a $250,000 student scholarship, $50,000 teacher prize, and $100,000 school laboratory award.", Object.values(BJC));
  const deadline = evidence(BJC.home, "Submissions are due September 15, 2026 at 11:59 PM PDT.");
  const ages = evidence(BJC.rules, "You must be at least 13 years old and no older than 18 years old on October 1, 2026");
  const prize = evidence(BJC.rules, "a $250,000 post-secondary scholarship for the winner; a $50,000 prize for the winner's teacher; and a $100,000 Breakthrough Science Lab for the winner's school");
  setFact(card, "opportunity_name", "Breakthrough Junior Challenge", "Breakthrough Junior Challenge", evidence(BJC.home, "Breakthrough Junior Challenge"), { kind: "text", value: "Breakthrough Junior Challenge" });
  setFact(card, "opportunity_category", "Global science video competition", "Global science video competition", evidence(BJC.home, "global science video competition"));
  setFact(card, "official_url", BJC.home.url, BJC.home.url, deadline, { kind: "text", value: BJC.home.url });
  setFact(card, "ages", "13–18", "Ages 13–18", ages);
  setFact(card, "geographic_restrictions", "Worldwide, subject to official exclusions and sanctions rules", "Worldwide with listed legal exclusions", evidence(BJC.rules, "The Challenge is open to individuals from all countries, except those prohibited by law"));
  setFact(card, "entry_format", "Individual two-minute science video", "Individual video entry", evidence(BJC.rules, "Entries must be submitted by individuals. Team entries are not permitted."));
  setFact(card, "sponsor_requirement", "Parent or legal guardian consent is required for minors", "Parent/guardian consent for minors", evidence(BJC.rules, "If you are a minor, your parent or legal guardian must agree to these Official Rules"));
  setFact(card, "personal_information", ["Name", "Email", "Address", "Telephone", "Birth date"], "Identity and contact information", evidence(BJC.privacy, "name, email address, postal address, telephone number, and date of birth"));
  setFact(card, "project_ownership", "Rules contain broad submission-property language; entrant rights require careful reading", "Rules contain broad submission-property provisions", evidence(BJC.rules, "all Entries and all rights associated with the Entries shall be the exclusive property of Sponsor"), null, "The exact interaction between ownership, license, and platform-hosting language should be reviewed before entry.");
  setFact(card, "project_license", "Sponsor receives broad rights to use, reproduce, display, distribute, and create derivative works", "Broad worldwide submission license", evidence(BJC.rules, "the right to use, reproduce, display, perform, distribute, adapt, modify, and create derivative works"));
  setFact(card, "publicity_rights", "Winner publicity use includes name, likeness, voice, opinions, and biographical information", "Winner publicity rights", evidence(BJC.rules, "use winner's name, likeness, voice, opinions and biographical information for publicity"));
  setFact(card, "cancellation_rights", "Sponsor may cancel, terminate, modify, or suspend the Challenge", "Sponsor may cancel, terminate, modify, or suspend", evidence(BJC.rules, "Sponsor reserves the right to cancel, terminate, modify or suspend the Challenge"));
  card.cycle = { status: "modeled", value: { id: "bjc-cycle-2026", label: disclosed("bjc-cycle-label", "2026", "2026", [deadline]), status: disclosed("bjc-cycle-status", "applications_open", "Submissions open", [deadline]), year: disclosed("bjc-cycle-year", 2026, "2026", [deadline]), startYear: null, endYear: null, season: null, cycleType: disclosed("bjc-cycle-type", "competition_cycle", "Competition cycle", [deadline]), timingRefs: { opens: "bjc-open-date", closes: "bjc-deadline", coverageStart: null, coverageEnd: null } } };
  card.organizations = { status: "modeled", note: null, records: [{ id: "bjc-foundation", name: disclosed("bjc-foundation-name", "Breakthrough Prize Foundation", "Breakthrough Prize Foundation", [evidence(BJC.rules, "Breakthrough Prize Foundation (Sponsor)")]), kind: disclosed("bjc-foundation-kind", "education_provider", "Nonprofit foundation sponsor", [evidence(BJC.rules, "Breakthrough Prize Foundation (Sponsor)")]) }] };
  card.organizationRoles = { status: "modeled", note: null, records: [{ id: "bjc-sponsor-role", organizationId: "bjc-foundation", role: disclosed("bjc-sponsor-role-claim", { role: "sponsor", roleLabel: null, scope: scope() }, "Sponsor", [evidence(BJC.rules, "Breakthrough Prize Foundation (Sponsor)")]) }] };
  card.institutionRelationships = { status: "not_applicable", records: [], note: "A winner's school can receive a lab, but no institution operates or endorses the global competition." };
  card.variants = { status: "not_applicable", records: [], note: "One individual-entry competition format is published." };
  const peer = evidence(BJC.rules, "Each Entrant must score at least five (5) other video entries as part of the Peer-to-Peer Review");
  card.stages = { status: "modeled", note: null, records: [
    { id: "bjc-stage-submit", order: 1, definition: disclosed("bjc-submit-stage", { label: "Video submission", kind: "application", scope: scope() }, "Video submission", [deadline]), timings: [disclosed("bjc-open-date", { event: "opens", when: { precision: "date", date: "2026-05-11", certainty: "stated" }, scope: scope() }, "May 11, 2026", [evidence(BJC.rules, "The Challenge begins on May 11, 2026")]), disclosed("bjc-deadline", { event: "deadline", when: { precision: "date_time", dateTime: "2026-09-15T23:59:00-07:00", certainty: "stated" }, scope: scope() }, "September 15, 2026 at 11:59 p.m. PDT", [deadline])], durations: [], timeCommitments: [], formats: [disclosed("bjc-submit-format", { formats: ["online"], scope: scope() }, "Online video", [evidence(BJC.rules, "uploaded to YouTube")])], locations: [], selectionRules: [], advancement: [], requirements: [disclosed("bjc-video-requirement", { requirement: "Original science video no longer than two minutes.", scope: scope() }, "Original video up to two minutes", [evidence(BJC.rules, "The video must be no longer than two (2) minutes")])], travelRequirements: [] },
    { id: "bjc-stage-peer", order: 2, definition: disclosed("bjc-peer-stage", { label: "Peer-to-peer review", kind: "proposal_review", scope: scope() }, "Peer-to-peer review", [peer]), timings: [disclosed("bjc-peer-deadline", { event: "deadline", when: { precision: "date", date: "2026-09-30", certainty: "stated" }, scope: scope() }, "September 30, 2026", [evidence(BJC.rules, "Peer-to-Peer Review must be completed by September 30, 2026")])], durations: [], timeCommitments: [], formats: [disclosed("bjc-peer-format", { formats: ["online"], scope: scope() }, "Online", [peer])], locations: [], selectionRules: [disclosed("bjc-peer-rule", { rule: "Entrants score at least five other videos using the published rubric.", scope: scope() }, "Score at least five peer videos", [peer])], advancement: [], requirements: [], travelRequirements: [] },
    { id: "bjc-stage-finalists", order: 3, definition: disclosed("bjc-finalist-stage", { label: "Evaluation and finalist selection", kind: "finalist", scope: scope() }, "Evaluation and finalist selection", [evidence(BJC.rules, "Evaluation Panel will select up to fifteen Finalists")]), timings: [], durations: [], timeCommitments: [], formats: [], locations: [], selectionRules: [disclosed("bjc-evaluation-rule", { rule: "An evaluation panel applies engagement, illumination, creativity, and difficulty criteria.", scope: scope() }, "Published four-part judging criteria", [evidence(BJC.faq, "Engagement, Illumination, Creativity, and Difficulty")])], advancement: [disclosed("bjc-finalist-count", { count: 15, description: "Up to fifteen Finalists", scope: scope() }, "Up to 15 Finalists", [evidence(BJC.rules, "up to fifteen Finalists")])], requirements: [], travelRequirements: [] },
    { id: "bjc-stage-winner", order: 4, definition: disclosed("bjc-winner-stage", { label: "Winner selection", kind: "winner_selection", scope: scope() }, "Winner selection", [prize]), timings: [], durations: [], timeCommitments: [], formats: [], locations: [], selectionRules: [], advancement: [disclosed("bjc-winner-count", { count: 1, description: "One Challenge winner", scope: scope() }, "One winner", [evidence(BJC.rules, "one (1) Winner")])], requirements: [], travelRequirements: [] },
  ] };
  card.pathways = { status: "modeled", note: null, records: [{ id: "bjc-pathway", definition: disclosed("bjc-pathway-definition", { label: "Submission through winner selection", variantIds: [] }, "Submission through winner selection", [deadline]), steps: [disclosed("bjc-step-submit", { stageId: "bjc-stage-submit", enterWhen: null }, "Submit", [deadline]), disclosed("bjc-step-peer", { stageId: "bjc-stage-peer", enterWhen: "Eligible entrant completes peer review." }, "Peer review", [peer]), disclosed("bjc-step-final", { stageId: "bjc-stage-finalists", enterWhen: "Entry advances through evaluation." }, "Finalist selection", [evidence(BJC.rules, "up to fifteen Finalists")]), disclosed("bjc-step-win", { stageId: "bjc-stage-winner", enterWhen: "Selected from the finalist pool." }, "Winner selection", [prize])] }] };
  card.costItems = { status: "not_applicable", records: [], note: "The official rules state that no purchase or payment is necessary to enter or win." };
  card.outcomes = { status: "modeled", note: "Three different recipients and monetary natures are preserved separately.", records: [
    { id: "bjc-student-scholarship", definition: disclosed("bjc-scholarship-definition", { label: "$250,000 post-secondary scholarship", outcomeType: "scholarship", scope: scope([], ["bjc-stage-winner"], []) }, "$250,000 scholarship", [prize]), recipientScope: disclosed("bjc-scholarship-recipient", "individual", "Winning student", [prize]), monetaryNature: disclosed("bjc-scholarship-nature", "restricted_funding", "Restricted education funding", [evidence(BJC.rules, "paid directly to the post-secondary educational institution")]), amount: disclosed("bjc-scholarship-amount", { kind: "exact", amount: 250000, currency: "USD" }, "$250,000", [prize]), distribution: disclosed("bjc-scholarship-distribution", [{ payee: "service_provider", method: "direct", condition: "Paid to an eligible post-secondary institution for the winner's education." }], "Paid directly to educational institution", [evidence(BJC.rules, "paid directly to the post-secondary educational institution")]), rank: disclosed("bjc-scholarship-rank", { ordinal: 1, label: "Winner" }, "Winner", [prize]), track: null, quantity: null, useRestriction: disclosed("bjc-scholarship-use", "Post-secondary education expenses under the official scholarship rules.", "Post-secondary education", [evidence(BJC.rules, "post-secondary scholarship")]), combinability: null, conditions: [] },
    { id: "bjc-teacher-prize", definition: disclosed("bjc-teacher-definition", { label: "$50,000 teacher prize", outcomeType: "personal_cash_prize", scope: scope([], ["bjc-stage-winner"], []) }, "$50,000 teacher prize", [prize]), recipientScope: disclosed("bjc-teacher-recipient", "individual", "Winner's teacher", [prize]), monetaryNature: disclosed("bjc-teacher-nature", "cash", "Cash prize", [prize]), amount: disclosed("bjc-teacher-amount", { kind: "exact", amount: 50000, currency: "USD" }, "$50,000", [prize]), distribution: disclosed("bjc-teacher-distribution", [{ payee: "participant", method: "direct", condition: "Paid to the teacher designated under the rules, not the student entrant." }], "Direct to teacher", [prize]), rank: null, track: null, quantity: null, useRestriction: null, combinability: null, conditions: [] },
    { id: "bjc-school-lab", definition: disclosed("bjc-lab-definition", { label: "$100,000 Breakthrough Science Lab", outcomeType: "equipment", scope: scope([], ["bjc-stage-winner"], []) }, "$100,000 school science lab", [prize]), recipientScope: disclosed("bjc-lab-recipient", "school", "Winner's school", [prize]), monetaryNature: disclosed("bjc-lab-nature", "source_stated_estimated_value", "Source-stated $100,000 lab value", [prize]), amount: disclosed("bjc-lab-amount", { kind: "exact", amount: 100000, currency: "USD" }, "$100,000 stated value", [prize]), distribution: disclosed("bjc-lab-distribution", [{ payee: "service_provider", method: "direct", condition: "Lab is provided to the winner's school under the official rules." }], "Provided to school", [prize]), rank: null, track: null, quantity: null, useRestriction: disclosed("bjc-lab-use", "Breakthrough Science Lab for the winner's school.", "School science lab", [prize]), combinability: null, conditions: [] },
  ] };
  return finish(card);
}

const QB = {
  overview: { id: "qb-overview", url: "https://www.questbridge.org/apply-to-college/programs/national-college-match", title: "National College Match - QuestBridge", pageType: "official_program_page" },
  apply: { id: "qb-apply", url: "https://www.questbridge.org/apply-to-college/programs/national-college-match/apply", title: "Apply to the National College Match - QuestBridge", pageType: "official_program_page" },
  dates: { id: "qb-dates", url: "https://www.questbridge.org/apply-to-college/programs/national-college-match/apply/dates-and-deadlines", title: "Dates & Deadlines - QuestBridge", pageType: "official_program_page" },
  ranking: { id: "qb-ranking", url: "https://www.questbridge.org/apply-to-college/programs/national-college-match/apply/ranking-colleges", title: "Ranking Colleges - QuestBridge", pageType: "official_program_page" },
  scholarship: { id: "qb-scholarship", url: "https://www.questbridge.org/apply-to-college/programs/national-college-match/the-match-scholarship", title: "The Match Scholarship - QuestBridge", pageType: "official_financial_aid_page" },
  privacy: { id: "qb-privacy", url: "https://www.questbridge.org/privacy-policy", title: "Privacy Policy - QuestBridge", pageType: "official_privacy_policy" },
  terms: { id: "qb-terms", url: "https://www.questbridge.org/terms-of-use", title: "Terms of Use - QuestBridge", pageType: "official_terms" },
} satisfies Record<string, SourceDefinition>;

function questbridge(): OpportunityCard {
  const card = baseCard("questbridge-national-college-match-2026", "questbridge-national-college-match", "The 2026 National College Match is a free, multi-stage college application and ranking process for eligible high-achieving seniors from low-income backgrounds, leading to Fall 2027 admission pathways and partner-funded full four-year scholarships for matched finalists.", Object.values(QB));
  const overview = evidence(QB.overview, "high-achieving students from low-income backgrounds can apply for free for early admission and a full four-year scholarship at our 55 college partners");
  const deadline = evidence(QB.dates, "October 1  | National College Match application deadline.");
  const eligibility = evidence(QB.apply, "It is open to any high school senior currently attending high school in the U.S. and U.S. Citizens and Permanent Residents living abroad. International students living outside the U.S. are not eligible.");
  setFact(card, "opportunity_name", "QuestBridge National College Match", "QuestBridge National College Match", evidence(QB.overview, "National College Match"), { kind: "text", value: "QuestBridge National College Match" });
  setFact(card, "opportunity_category", "College admission and scholarship matching program", "College admission and scholarship matching program", overview);
  setFact(card, "official_url", QB.overview.url, QB.overview.url, overview, { kind: "text", value: QB.overview.url });
  setFact(card, "grade_levels", ["12"], "High-school seniors", eligibility, { kind: "text_list", values: ["12"] });
  setFact(card, "geographic_restrictions", "High-school seniors in the U.S.; U.S. citizens and permanent residents abroad", "U.S. high-school seniors; eligible U.S. students abroad", eligibility);
  setFact(card, "citizenship_restrictions", "International students outside the U.S. are not eligible", "International students outside the U.S. are ineligible", eligibility);
  setFact(card, "entry_format", "Individual application and ranked college list", "Individual application with ranked colleges", evidence(QB.ranking, "You can rank up to 15 colleges in order of preference."));
  setFact(card, "sponsor_requirement", "Match Agreement Form requires applicant, parent/guardian, and school counselor signatures", "Applicant, parent/guardian, and counselor signatures", evidence(QB.dates, "It must be signed by the applicant, their parent/guardian, and school counselor"));
  setFact(card, "financial_aid", "Partner-funded Match Scholarship covers full cost of attendance with no parental contribution or student loans", "Full cost of attendance; no parent contribution or loans", evidence(QB.scholarship, "Match Scholarships are provided directly by our college partners. The Match Scholarship covers the full cost of attendance"));
  setFact(card, "personal_information", ["Identity and contact data", "Academic data", "Household and financial information", "Application materials"], "Extensive applicant, academic, and financial information", evidence(QB.privacy, "QB will collect data that is necessary for our selection process"));
  setFact(card, "data_sharing", "Application information may be shared with selected college partners and associates", "Selected college partners and associates", evidence(QB.privacy, "All Personal Information collected by QB and the QB Website, including without limitation student registration and application information, will be available to QB, and in many cases to the universities and colleges we work with"));
  setFact(card, "publicity_rights", "Finalists may authorize sharing of biographical, academic, photograph, application, and award-status information", "Optional finalist publicity permission", evidence(QB.privacy, "we ask that you give us your permission to share your biographical and academic information, photograph, and application and award status"));
  setFact(card, "material_terms", ["College rankings are generally binding if matched, except MIT", "Early-application restrictions apply to applicants who rank colleges"], "Binding Match and early-application restrictions", evidence(QB.apply, "When you rank colleges through the National College Match, you enter into a binding* agreement with the colleges on your list."), { kind: "text_list", values: ["Binding Match except MIT", "Early-application restrictions"] });
  card.cycle = { status: "modeled", value: { id: "qb-cycle-2026", label: disclosed("qb-cycle-label", "2026 National College Match / Fall 2027 entry", "2026 Match / Fall 2027 entry", [deadline]), status: disclosed("qb-cycle-status", "applications_open", "Applications open", [evidence(QB.overview, "The 2026 National College Match is now open!")]), year: disclosed("qb-cycle-year", 2026, "2026", [deadline]), startYear: disclosed("qb-cycle-start-year", 2026, "2026", [deadline]), endYear: disclosed("qb-cycle-end-year", 2027, "2027", [evidence(QB.dates, "Fall 2027")]), season: null, cycleType: disclosed("qb-cycle-type", "academic_year", "Admission cycle", [deadline]), timingRefs: { opens: null, closes: "qb-application-deadline", coverageStart: null, coverageEnd: "qb-fall-entry" } } };
  card.organizations = { status: "modeled", note: "QuestBridge administers the process; 55 college partners independently provide scholarships and admission decisions.", records: [{ id: "qb-org", name: disclosed("qb-org-name", "QuestBridge", "QuestBridge", [overview]), kind: disclosed("qb-org-kind", "education_provider", "Nonprofit education organization", [overview]) }] };
  card.organizationRoles = { status: "modeled", note: null, records: [{ id: "qb-role-operator", organizationId: "qb-org", role: disclosed("qb-role-operator-claim", { role: "operator", roleLabel: "Application and match administrator", scope: scope() }, "Application and match administrator", [overview]) }] };
  card.institutionRelationships = { status: "modeled", note: "The relationship is with a set of 55 college partners; no single institution is treated as the operator.", records: [{ id: "qb-college-partnership", assertion: disclosed("qb-college-partnership-claim", { subject: "opportunity", subjectOrganizationId: "qb-org", targetOrganizationId: null, targetInstitutionName: "55 QuestBridge college partners", relationshipType: "institution_partnered", description: "QuestBridge administers a Match in which partner colleges make admission decisions and provide Match Scholarships.", scope: scope() }, "Institution partnered — 55 college partners", [evidence(QB.scholarship, "Match Scholarships are provided directly by our college partners")]) }] };
  card.variants = { status: "modeled", note: "The ranked Match and QuestBridge Regular Decision are distinct admission pathways.", records: [{ id: "qb-match-variant", definition: disclosed("qb-match-variant-definition", { label: "Ranked College Match", kind: "track", parentVariantId: null }, "Ranked College Match", [evidence(QB.ranking, "You can rank up to 15 colleges")]), eligibilityDifferences: [], notes: [] }, { id: "qb-rd-variant", definition: disclosed("qb-rd-variant-definition", { label: "QuestBridge Regular Decision", kind: "track", parentVariantId: null }, "QuestBridge Regular Decision", [evidence(QB.dates, "QuestBridge Regular Decision Form")]), eligibilityDifferences: [], notes: [] }] };
  card.stages = { status: "modeled", note: null, records: [
    { id: "qb-stage-application", order: 1, definition: disclosed("qb-application-stage", { label: "QuestBridge application", kind: "application", scope: scope() }, "QuestBridge application", [deadline]), timings: [disclosed("qb-application-deadline", { event: "deadline", when: { precision: "date_time", dateTime: "2026-10-01T23:59:00-07:00", certainty: "stated" }, scope: scope() }, "October 1, 2026 at 11:59 p.m. Pacific", [deadline])], durations: [], timeCommitments: [], formats: [disclosed("qb-application-format", { formats: ["online"], scope: scope() }, "Online", [evidence(QB.apply, "online application")])], locations: [], selectionRules: [disclosed("qb-holistic-rule", { rule: "QuestBridge reviews applications holistically without absolute GPA, test, income, or other cutoffs.", scope: scope() }, "Holistic review; no absolute cutoffs", [evidence(QB.apply, "We review all applications holistically, and there are no absolute criteria or cut-offs")])], advancement: [], requirements: [], travelRequirements: [] },
    { id: "qb-stage-rank", order: 2, definition: disclosed("qb-ranking-stage", { label: "College ranking", kind: "matching", scope: scope(["qb-match-variant"]) }, "College ranking", [evidence(QB.ranking, "rank up to 15 colleges")]), timings: [disclosed("qb-ranking-deadline", { event: "deadline", when: { precision: "date", date: "2026-10-15", certainty: "stated" }, scope: scope(["qb-match-variant"]) }, "October 15, 2026", [evidence(QB.dates, "October 15  | Match Rankings Form deadline")])], durations: [], timeCommitments: [], formats: [disclosed("qb-ranking-format", { formats: ["online"], scope: scope(["qb-match-variant"]) }, "Online", [evidence(QB.ranking, "Match Rankings Form")])], locations: [], selectionRules: [], advancement: [], requirements: [disclosed("qb-ranking-signatures", { requirement: "Match Agreement signed by applicant, parent/guardian, and school counselor.", scope: scope(["qb-match-variant"]) }, "Three-party Match Agreement", [evidence(QB.dates, "signed by the applicant, their parent/guardian, and school counselor")])], travelRequirements: [] },
    { id: "qb-stage-finalist", order: 3, definition: disclosed("qb-finalist-stage", { label: "Finalist selection", kind: "finalist", scope: scope() }, "Finalist selection", [evidence(QB.dates, "October 21  | Finalist decisions released")]), timings: [disclosed("qb-finalist-decision", { event: "decision", when: { precision: "date", date: "2026-10-21", certainty: "stated" }, scope: scope() }, "October 21, 2026", [evidence(QB.dates, "October 21  | Finalist decisions released")])], durations: [], timeCommitments: [], formats: [], locations: [], selectionRules: [], advancement: [], requirements: [], travelRequirements: [] },
    { id: "qb-stage-requirements", order: 4, definition: disclosed("qb-requirements-stage", { label: "College Match Requirements", kind: "application", scope: scope(["qb-match-variant"]) }, "College Match Requirements", [evidence(QB.ranking, "submit additional materials (called Match Requirements) to each of the colleges")]), timings: [disclosed("qb-requirements-deadline", { event: "deadline", when: { precision: "date", date: "2026-11-01", certainty: "stated" }, scope: scope(["qb-match-variant"]) }, "November 1, 2026", [evidence(QB.dates, "November 1  | Match Requirements deadline")])], durations: [], timeCommitments: [], formats: [disclosed("qb-requirements-format", { formats: ["online"], scope: scope() }, "College-specific submissions", [evidence(QB.ranking, "submit additional materials")])], locations: [], selectionRules: [], advancement: [], requirements: [], travelRequirements: [] },
    { id: "qb-stage-match", order: 5, definition: disclosed("qb-match-stage", { label: "Match Day", kind: "matching", scope: scope(["qb-match-variant"]) }, "Match Day", [evidence(QB.dates, "December 1  | Match Day!")]), timings: [disclosed("qb-match-day", { event: "decision", when: { precision: "date", date: "2026-12-01", certainty: "stated" }, scope: scope(["qb-match-variant"]) }, "December 1, 2026", [evidence(QB.dates, "December 1  | Match Day!")])], durations: [], timeCommitments: [], formats: [], locations: [], selectionRules: [disclosed("qb-match-rule", { rule: "A finalist can match to only one school: the highest-ranked partner that also chooses to match with the student.", scope: scope(["qb-match-variant"]) }, "Highest mutual rank; one school", [evidence(QB.ranking, "matched — admitted early with a guaranteed full four-year Match Scholarship — to the college that appears highest on your list that is also able to match with you")])], advancement: [], requirements: [], travelRequirements: [] },
    { id: "qb-stage-enrollment", order: 6, definition: disclosed("qb-enrollment-stage", { label: "College enrollment", kind: "program", scope: scope() }, "College enrollment", [evidence(QB.dates, "Fall 2027")]), timings: [disclosed("qb-fall-entry", { event: "ends", when: { precision: "month", year: 2027, month: 9, certainty: "expected" }, scope: scope() }, "Fall 2027", [evidence(QB.dates, "Fall 2027")])], durations: [], timeCommitments: [], formats: [disclosed("qb-enrollment-format", { formats: ["in_person"], scope: scope() }, "Varies by college partner", [evidence(QB.overview, "55 college partners")])], locations: [disclosed("qb-enrollment-location", { location: "One selected QuestBridge college partner", scope: scope() }, "Varies by matched/admitting college", [evidence(QB.overview, "55 college partners")])], selectionRules: [], advancement: [], requirements: [], travelRequirements: [disclosed("qb-enrollment-travel", { requirement: "conditional", scope: scope() }, "Depends on selected college", [evidence(QB.scholarship, "Travel expenses")])] },
  ] };
  card.pathways = { status: "modeled", note: "Finalists can proceed through a binding ranked Match or through Regular Decision if not matched or not participating in the Match.", records: [
    { id: "qb-match-pathway", definition: disclosed("qb-match-pathway-definition", { label: "Ranked Match pathway", variantIds: ["qb-match-variant"] }, "Ranked Match pathway", [evidence(QB.ranking, "rank up to 15 colleges")]), steps: [disclosed("qb-match-step-apply", { stageId: "qb-stage-application", enterWhen: null }, "Apply", [deadline]), disclosed("qb-match-step-rank", { stageId: "qb-stage-rank", enterWhen: "Applicant chooses to rank colleges." }, "Rank colleges", [evidence(QB.ranking, "rank up to 15 colleges")]), disclosed("qb-match-step-finalist", { stageId: "qb-stage-finalist", enterWhen: null }, "Finalist decision", [evidence(QB.dates, "Finalist decisions")]), disclosed("qb-match-step-requirements", { stageId: "qb-stage-requirements", enterWhen: "Selected as Finalist and ranked colleges." }, "Submit partner requirements", [evidence(QB.ranking, "submit additional materials")]), disclosed("qb-match-step-match", { stageId: "qb-stage-match", enterWhen: "College and finalist match." }, "Match Day", [evidence(QB.dates, "Match Day")]), disclosed("qb-match-step-enroll", { stageId: "qb-stage-enrollment", enterWhen: "Matched or otherwise admitted to a partner." }, "Enroll", [evidence(QB.dates, "Fall 2027")])] },
    { id: "qb-rd-pathway", definition: disclosed("qb-rd-pathway-definition", { label: "QuestBridge Regular Decision pathway", variantIds: ["qb-rd-variant"] }, "QuestBridge Regular Decision pathway", [evidence(QB.dates, "QuestBridge Regular Decision")]), steps: [disclosed("qb-rd-step-apply", { stageId: "qb-stage-application", enterWhen: null }, "Apply", [deadline]), disclosed("qb-rd-step-finalist", { stageId: "qb-stage-finalist", enterWhen: null }, "Finalist decision", [evidence(QB.dates, "Finalist decisions")]), disclosed("qb-rd-step-enroll", { stageId: "qb-stage-enrollment", enterWhen: "Admitted through QuestBridge Regular Decision or another round." }, "Enroll", [evidence(QB.dates, "QuestBridge Regular Decision applicants")])] },
  ] };
  card.costItems = { status: "modeled", completeness: "complete", note: "The cost inventory covers the QuestBridge application itself, not later college attendance for unmatched applicants.", records: [{ id: "qb-application-fee", definition: disclosed("qb-application-fee-definition", { label: "National College Match application fee", kind: "application_fee", requirement: "required", scope: scope() }, "Free application", [overview]), amount: disclosed("qb-application-fee-amount", { kind: "exact", amount: 0, currency: "USD" }, "$0", [overview]), chargeBasis: disclosed("qb-application-fee-basis", "per_application", "Per application", [overview]), treatment: null, refundability: null, includedItems: [], excludedItems: [], conditions: [] }] };
  card.outcomes = { status: "modeled", note: "The scholarship is partner-funded and conditional on a successful Match; it is not cash paid to the applicant.", records: [
    { id: "qb-match-scholarship", definition: disclosed("qb-scholarship-definition", { label: "Full four-year Match Scholarship", outcomeType: "scholarship", scope: scope(["qb-match-variant"], ["qb-stage-match"], ["qb-match-pathway"]) }, "Full four-year Match Scholarship", [evidence(QB.scholarship, "guaranteed full four-year Match Scholarship")]), recipientScope: disclosed("qb-scholarship-recipient", "individual", "Matched finalist", [evidence(QB.scholarship, "Match Scholarship")]), monetaryNature: disclosed("qb-scholarship-nature", "restricted_funding", "Partner-funded cost-of-attendance scholarship", [evidence(QB.scholarship, "Match Scholarships are provided directly by our college partners")]), amount: null, distribution: disclosed("qb-scholarship-distribution", [{ payee: "service_provider", method: "direct", condition: "Provided by the matched college partner as the student's financial-aid package." }], "Provided by college partner", [evidence(QB.scholarship, "provided directly by our college partners")]), rank: null, track: null, quantity: null, useRestriction: disclosed("qb-scholarship-use", "Full cost of attendance, including tuition and fees, housing and food, books and supplies, and travel expenses.", "Full cost of attendance", [evidence(QB.scholarship, "covers the full cost of attendance")]), combinability: null, conditions: [disclosed("qb-scholarship-condition", "Available to Finalists who match with a college partner.", "Successful Match required", [evidence(QB.overview, "Finalists who match are admitted to a college partner with a full four-year scholarship")])] },
    { id: "qb-network-outcome", definition: disclosed("qb-network-definition", { label: "QuestBridge Scholars and Alumni network", outcomeType: "other_in_kind", scope: scope() }, "QuestBridge Scholars and Alumni network", [evidence(QB.apply, "access to a lifelong network of QuestBridge Scholars and Alumni")]), recipientScope: disclosed("qb-network-recipient", "individual", "QuestBridge Scholar or alumnus", [evidence(QB.apply, "QuestBridge Scholars and Alumni")]), monetaryNature: disclosed("qb-network-nature", "not_monetized", "No monetary value published", [evidence(QB.apply, "lifelong network")]), amount: null, distribution: null, rank: null, track: null, quantity: null, useRestriction: null, combinability: null, conditions: [] },
  ] };
  return finish(card);
}

async function main() {
  const cards = [
    congressionalAppChallenge(),
    cocaColaScholars(),
    yygs(),
    polygence(),
    mites(),
    breakthrough(),
    questbridge(),
  ];
  await mkdir(OUT, { recursive: true });
  for (const card of cards) {
    const target = path.join(OUT, `${card.slug}.json`);
    await writeFile(target, `${JSON.stringify(card, null, 2)}\n`, "utf8");
    process.stdout.write(`Wrote ${path.relative(process.cwd(), target)}\n`);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
