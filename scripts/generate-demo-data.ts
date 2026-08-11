import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { exportPublicArtifacts } from "../lib/opportunity/artifacts";

import {
  createEmptyCard,
  factSchema,
  opportunityCardSchema,
  type Calculation,
  type CardConflict,
  type EvidenceSource,
  type Fact,
  type NormalizedValue,
  type OpportunityCard,
  type OpportunityFacts,
  type SourcePage,
} from "../lib/opportunity/schema";

const ACCESSED_AT = "2026-08-10T12:00:00Z";

function page(
  id: string,
  url: string,
  title: string,
  pageType: SourcePage["pageType"],
): SourcePage {
  return { id, url, title, pageType, accessedAt: ACCESSED_AT };
}

function evidence(source: SourcePage, excerpt: string): EvidenceSource {
  return { ...source, excerpt };
}

function disclosed(
  value: string | number | boolean | string[],
  displayValue: string,
  source: SourcePage,
  excerpt: string,
  normalizedValue: NormalizedValue | null = null,
  options: { claimKind?: Fact["claimKind"]; calculation?: Calculation | null; note?: string | null } = {},
): Fact {
  return factSchema.parse({
    status: "disclosed",
    value,
    displayValue,
    normalizedValue,
    sources: [evidence(source, excerpt)],
    claimKind: options.claimKind ?? "source_stated",
    calculation: options.calculation ?? null,
    note: options.note ?? null,
  });
}

function unclear(note: string, source?: SourcePage, excerpt?: string): Fact {
  return factSchema.parse({
    status: "unclear",
    note,
    sources: source && excerpt ? [evidence(source, excerpt)] : [],
  });
}

function conflicting(
  first: { value: string | number; displayValue: string; source: SourcePage; excerpt: string; normalizedValue?: NormalizedValue },
  second: { value: string | number; displayValue: string; source: SourcePage; excerpt: string; normalizedValue?: NormalizedValue },
  note: string,
): Fact {
  return factSchema.parse({
    status: "conflicting",
    note,
    conflictingValues: [
      {
        value: first.value,
        displayValue: first.displayValue,
        normalizedValue: first.normalizedValue ?? null,
        sources: [evidence(first.source, first.excerpt)],
      },
      {
        value: second.value,
        displayValue: second.displayValue,
        normalizedValue: second.normalizedValue ?? null,
        sources: [evidence(second.source, second.excerpt)],
      },
    ],
  });
}

function buildCard(
  slug: string,
  summary: string,
  pages: SourcePage[],
  facts: Partial<OpportunityFacts>,
  conflicts: CardConflict[] = [],
): OpportunityCard {
  const empty = createEmptyCard({ slug, summary, reviewState: "demo" });
  return opportunityCardSchema.parse({
    ...empty,
    reviewedAt: ACCESSED_AT,
    sourcePagesChecked: pages,
    conflicts,
    facts: { ...empty.facts, ...facts },
  });
}

function lanternBayCard(): OpportunityCard {
  const program = page("program", "https://lanternbay.example/field-lab", "Lantern Bay Robotics Field Lab", "official_program_page");
  const cost = page("cost", "https://lanternbay.example/field-lab/cost", "Cost and aid", "official_cost_page");
  const faq = page("faq", "https://lanternbay.example/field-lab/faq", "Field Lab FAQ", "official_faq");
  const selection = page("selection", "https://lanternbay.example/field-lab/selection", "How participants are selected", "official_rules");
  const terms = page("terms", "https://lanternbay.example/field-lab/terms", "Participation terms", "official_terms");

  const facts: Partial<OpportunityFacts> = {
    opportunity_name: disclosed("Lantern Bay Robotics Field Lab", "Lantern Bay Robotics Field Lab", program, "Lantern Bay Robotics Field Lab is a four-week residential design program."),
    opportunity_category: disclosed("summer program", "Summer program", program, "Lantern Bay Robotics Field Lab is a four-week residential design program."),
    official_url: disclosed(program.url, program.url, program, "Official program page: https://lanternbay.example/field-lab", { kind: "text", value: program.url }),
    operating_organization: disclosed("Lantern Bay Learning Cooperative", "Lantern Bay Learning Cooperative", program, "The program is operated by the independent Lantern Bay Learning Cooperative."),
    organization_type: disclosed("independent educational cooperative", "Independent educational cooperative", program, "The program is operated by the independent Lantern Bay Learning Cooperative."),
    named_institution: disclosed("Example Coast Technical Institute", "Example Coast Technical Institute", program, "Sessions take place in space rented from Example Coast Technical Institute."),
    institution_relationship: disclosed("hosted_at_institution", "Hosted at institution", program, "Example Coast Technical Institute supplies classroom space only and does not operate, sponsor, select for, or endorse the program.", { kind: "relationship", value: "hosted_at_institution" }),
    relationship_explanation: disclosed("The institute supplies rented classroom space only; it does not operate, sponsor, select for, or endorse the program.", "The institute supplies rented classroom space only; it does not operate, sponsor, select for, or endorse the program.", program, "Example Coast Technical Institute supplies classroom space only and does not operate, sponsor, select for, or endorse the program."),
    grade_levels: disclosed(["10", "11", "12"], "Grades 10–12", program, "Students entering grades 10, 11, or 12 may apply.", { kind: "text_list", values: ["10", "11", "12"] }),
    ages: disclosed("15–18 at the program start", "Ages 15–18 at program start", program, "Applicants must be 15 through 18 years old on June 22, 2027."),
    prerequisite_skills: disclosed(["one introductory programming course or equivalent project experience"], "Introductory programming or equivalent project experience", program, "Applicants need one introductory programming course or equivalent project experience.", { kind: "text_list", values: ["introductory programming or equivalent project experience"] }),
    entry_format: disclosed("individual", "Individual application", program, "Applications are submitted by individual students, not teams."),
    sponsor_requirement: disclosed("adult emergency contact required; no school sponsor", "Adult emergency contact; no school sponsor", program, "An adult emergency contact is required; a school sponsor is not."),
    application_deadline: disclosed("January 30, 2027", "January 30, 2027", program, "Applications close January 30, 2027 at 11:59 p.m. Central.", { kind: "date", isoDate: "2027-01-30" }),
    decision_date: disclosed("March 15, 2027", "March 15, 2027", program, "Decisions will be emailed by March 15, 2027." , { kind: "date", isoDate: "2027-03-15" }),
    start_date: disclosed("June 22, 2027", "June 22, 2027", program, "The 2027 lab runs June 22 through July 17.", { kind: "date", isoDate: "2027-06-22" }),
    end_date: disclosed("July 17, 2027", "July 17, 2027", program, "The 2027 lab runs June 22 through July 17.", { kind: "date", isoDate: "2027-07-17" }),
    duration: disclosed("four weeks", "4 weeks", program, "Lantern Bay Robotics Field Lab is a four-week residential design program.", { kind: "duration", amount: 4, unit: "weeks" }),
    weekly_hours: disclosed("35 hours per week", "35 hours per week", program, "Participants should expect 35 scheduled hours each week.", { kind: "hours", minimum: 35, maximum: null, period: "week" }),
    required_live_hours: disclosed("32 hours per week", "32 live hours per week", program, "Thirty-two hours each week require live attendance.", { kind: "hours", minimum: 32, maximum: null, period: "week" }),
    participation_format: disclosed("residential", "Residential", program, "Lantern Bay Robotics Field Lab is a four-week residential design program.", { kind: "participation_format", value: "residential" }),
    location: disclosed("Example Coast Technical Institute, Lantern Bay", "Example Coast Technical Institute, Lantern Bay", program, "Sessions take place in space rented from Example Coast Technical Institute."),
    travel_requirements: disclosed("Participants arrange travel to and from Lantern Bay.", "Participants arrange travel to and from Lantern Bay", cost, "Participants arrange and pay for travel to and from Lantern Bay."),
    application_fee: disclosed(0, "$0", cost, "There is no application fee.", { kind: "money", amount: 0, currency: "USD", classification: "fee" }),
    deposit: disclosed(100, "$100 deposit", cost, "Accepted students pay a $100 deposit that is credited toward tuition.", { kind: "money", amount: 100, currency: "USD", classification: "deposit" }),
    tuition: disclosed(450, "$450", cost, "Program tuition is $450, including the credited deposit.", { kind: "money", amount: 450, currency: "USD", classification: "fee" }),
    estimated_total_mandatory_cost: disclosed(450, "$450", cost, "The total mandatory program charge is $450; travel is separate.", { kind: "money", amount: 450, currency: "USD", classification: "fee" }),
    travel_included: disclosed(false, "No", cost, "Participants arrange and pay for travel to and from Lantern Bay.", { kind: "boolean", value: false }),
    lodging_included: disclosed(true, "Yes", cost, "Tuition includes shared lodging and weekday meals.", { kind: "boolean", value: true }),
    meals_included: disclosed(true, "Weekday meals", cost, "Tuition includes shared lodging and weekday meals.", { kind: "boolean", value: true }),
    financial_aid: disclosed("Need-based grants of $225 or $450 are available.", "Need-based grants of $225 or $450", cost, "Need-based grants of $225 or $450 are available through a separate aid form."),
    refund_policy: conflicting(
      { value: "Full refund before May 1", displayValue: "Full refund before May 1", source: cost, excerpt: "The cost page says all payments are refundable before May 1." },
      { value: "$100 deposit is nonrefundable", displayValue: "$100 deposit is nonrefundable", source: faq, excerpt: "The FAQ says the $100 deposit is nonrefundable once a place is accepted." },
      "The cost page and FAQ disagree about whether the deposit is refundable before May 1.",
    ),
    cancellation_policy: disclosed("If the organizer cancels, all program charges are returned; travel is excluded.", "Organizer cancellation returns program charges, not travel", terms, "If Lantern Bay cancels the lab, program charges will be returned, but participant travel costs will not be reimbursed."),
    selection_process: disclosed("Review of short answers, teacher reference, and project sample using a published rubric.", "Short answers, teacher reference, and project sample", selection, "Reviewers score short answers, one teacher reference, and a project sample using the published rubric."),
    applicant_count: disclosed(240, "240 applicants", selection, "For the 2026 cohort, 240 complete applications were reviewed and 48 students were offered seats.", { kind: "number", value: 240, unit: "people" }),
    acceptance_count: disclosed(48, "48 offers", selection, "For the 2026 cohort, 240 complete applications were reviewed and 48 students were offered seats.", { kind: "number", value: 48, unit: "people" }),
    calculated_acceptance_rate: disclosed(20, "20%", selection, "For the 2026 cohort, 240 complete applications were reviewed and 48 students were offered seats.", { kind: "percentage", value: 20 }, { claimKind: "calculated", calculation: { formula: "acceptance_count / applicant_count × 100", inputs: [{ fieldId: "applicant_count", value: 240 }, { fieldId: "acceptance_count", value: 48 }], explanation: "Calculated from published counts." } }),
    selection_evidence: disclosed("numerical", "Numerical", selection, "For the 2026 cohort, 240 complete applications were reviewed and 48 students were offered seats."),
    program_seat: disclosed("one place in the four-week field lab", "Program seat", program, "Accepted participants receive a place in the four-week lab."),
    in_kind_value: disclosed(180, "$180 organizer-stated kit value (in kind)", program, "Each participant keeps a parts kit described by the organizer as a $180 value.", { kind: "money", amount: 180, currency: "USD", classification: "in_kind" }, { claimKind: "organizer_stated", note: "This is an organizer-stated in-kind value, not cash." }),
    certificate: disclosed(true, "Completion certificate", program, "Participants who complete the final safety review receive a certificate.", { kind: "boolean", value: true }),
    mentorship: disclosed("weekly small-group design critique", "Weekly small-group design critique", program, "The schedule includes a weekly small-group design critique with volunteer engineers."),
    other_benefits: disclosed(["parts kit", "design showcase"], "Parts kit and design showcase", program, "Participants keep their kit and present at the final design showcase.", { kind: "text_list", values: ["parts kit", "design showcase"] }),
    personal_information: disclosed(["student contact information", "age", "emergency contact", "teacher reference"], "Contact details, age, emergency contact, and teacher reference", terms, "The application requests student contact information, age, an emergency contact, and a teacher reference.", { kind: "text_list", values: ["student contact information", "age", "emergency contact", "teacher reference"] }),
    data_sharing: disclosed("Application data is shared with reviewers and lodging staff; it is not sold for advertising.", "Shared with reviewers and lodging staff; not sold for advertising", terms, "Application data may be shared with assigned reviewers and lodging staff and is not sold for advertising."),
    project_ownership: disclosed("Students retain ownership.", "Students retain ownership", terms, "Students retain ownership of the projects they create."),
    project_license: disclosed("Nonexclusive permission to display final-project images for program reporting.", "Nonexclusive display license for final-project images", terms, "Students grant a nonexclusive permission to display final-project images in program reports."),
    publicity_rights: disclosed("Separate optional media release.", "Separate optional media release", terms, "Use of a participant's name, photo, or video requires a separate optional media release."),
    cancellation_rights: disclosed("Organizer may cancel for safety or insufficient enrollment.", "May cancel for safety or insufficient enrollment", terms, "Lantern Bay may cancel for safety conditions or insufficient enrollment."),
    material_terms: disclosed(["travel costs are excluded from organizer-cancellation reimbursement", "refund pages conflict about the deposit"], "Travel reimbursement exclusion; conflicting deposit language", terms, "If Lantern Bay cancels the lab, program charges will be returned, but participant travel costs will not be reimbursed.", { kind: "text_list", values: ["travel costs excluded from reimbursement", "deposit refund language conflicts"] }),
  };

  return buildCard(
    "lantern-bay-robotics-field-lab",
    "A residential robotics program hosted in rented institute space, with published selection counts and conflicting deposit-refund language.",
    [program, cost, faq, selection, terms],
    facts,
    [{ fieldId: "refund_policy", summary: "The cost page and FAQ disagree about whether the $100 deposit is refundable before May 1." }],
  );
}

function cipherFinchCard(): OpportunityCard {
  const rules = page("rules", "https://cipherfinch.example/challenge/rules", "Cipher Finch Challenge rules", "official_rules");
  const prizes = page("prizes", "https://cipherfinch.example/challenge/prizes", "Prizes", "official_program_page");
  const privacy = page("privacy", "https://cipherfinch.example/privacy", "Privacy notice", "official_privacy_policy");
  const facts: Partial<OpportunityFacts> = {
    opportunity_name: disclosed("Cipher Finch Student Challenge", "Cipher Finch Student Challenge", rules, "The Cipher Finch Student Challenge is an online team cryptography competition."),
    opportunity_category: disclosed("competition", "Competition", rules, "The Cipher Finch Student Challenge is an online team cryptography competition."),
    official_url: disclosed(rules.url, rules.url, rules, "Official rules: https://cipherfinch.example/challenge/rules", { kind: "text", value: rules.url }),
    operating_organization: disclosed("Cipher Finch Foundation", "Cipher Finch Foundation", rules, "The independent Cipher Finch Foundation operates and judges the challenge."),
    organization_type: disclosed("independent foundation", "Independent foundation", rules, "The independent Cipher Finch Foundation operates and judges the challenge."),
    institution_relationship: disclosed("independent", "Independent", rules, "No school or university operates, sponsors, or hosts the challenge.", { kind: "relationship", value: "independent" }),
    relationship_explanation: disclosed("No school or university operates, sponsors, or hosts the challenge.", "No school or university operates, sponsors, or hosts the challenge", rules, "No school or university operates, sponsors, or hosts the challenge."),
    grade_levels: disclosed(["9", "10", "11", "12"], "Grades 9–12", rules, "Teams may include students in grades 9 through 12.", { kind: "text_list", values: ["9", "10", "11", "12"] }),
    geographic_restrictions: disclosed("Open worldwide where permitted", "Worldwide where permitted", rules, "The challenge is open worldwide where participation is permitted by local law."),
    entry_format: disclosed("teams of 2–4", "Teams of 2–4", rules, "Each team must have two to four students."),
    sponsor_requirement: disclosed("one adult coach", "One adult coach", rules, "Each team must identify one adult coach."),
    application_deadline: disclosed("October 6, 2026", "October 6, 2026", rules, "Team registration closes October 6, 2026.", { kind: "date", isoDate: "2026-10-06" }),
    start_date: disclosed("October 17, 2026", "October 17, 2026", rules, "The timed challenge runs online on October 17, 2026." , { kind: "date", isoDate: "2026-10-17" }),
    end_date: disclosed("October 17, 2026", "October 17, 2026", rules, "The timed challenge runs online on October 17, 2026." , { kind: "date", isoDate: "2026-10-17" }),
    duration: disclosed("6 hours", "6 hours", rules, "Teams have six hours after opening the problem packet.", { kind: "duration", amount: 6, unit: "hours" }),
    required_live_hours: disclosed("6 hours total", "6 live hours total", rules, "Teams have six hours after opening the problem packet.", { kind: "hours", minimum: 6, maximum: null, period: "total" }),
    participation_format: disclosed("online", "Online", rules, "The Cipher Finch Student Challenge is an online team cryptography competition.", { kind: "participation_format", value: "online" }),
    application_fee: disclosed(0, "$0", rules, "Registration is free.", { kind: "money", amount: 0, currency: "USD", classification: "fee" }),
    estimated_total_mandatory_cost: disclosed(0, "$0", rules, "Registration is free and no purchase is required.", { kind: "money", amount: 0, currency: "USD", classification: "fee" }),
    financial_aid: factSchema.parse({ status: "not_applicable", note: "The published mandatory cost is $0." }),
    refund_policy: factSchema.parse({ status: "not_applicable", note: "No payment is required." }),
    selection_process: disclosed("Automated answer checks followed by manual tie-break review.", "Automated checks with manual tie-break review", rules, "Scores use automated answer checks; judges manually review tied teams using the written-method explanation."),
    selection_evidence: disclosed("descriptive", "Descriptive", rules, "Scores use automated answer checks; judges manually review tied teams using the written-method explanation."),
    cash_award: disclosed(2500, "$2,500 cash to the first-place team", prizes, "The first-place team receives a $2,500 cash award divided equally among student members.", { kind: "money", amount: 2500, currency: "USD", classification: "cash" }),
    in_kind_value: disclosed(800, "$800 organizer-stated equipment value (in kind)", prizes, "The first-place team also receives equipment described by the organizer as an $800 retail value.", { kind: "money", amount: 800, currency: "USD", classification: "in_kind" }, { claimKind: "organizer_stated", note: "Organizer-stated retail value; not cash." }),
    certificate: disclosed(true, "Digital participation certificate", prizes, "Every team that submits before time expires receives a digital participation certificate.", { kind: "boolean", value: true }),
    other_benefits: disclosed(["digital certificate", "published solution review"], "Digital certificate and published solution review", prizes, "Participants receive a digital certificate and access to the published solution review.", { kind: "text_list", values: ["digital certificate", "published solution review"] }),
    personal_information: disclosed(["student name", "email", "grade", "coach contact"], "Name, email, grade, and coach contact", privacy, "Registration collects each student's name, email, grade, and coach contact.", { kind: "text_list", values: ["student name", "email", "grade", "coach contact"] }),
    data_sharing: disclosed("Service providers process registration; data is not sold.", "Service providers process registration; data not sold", privacy, "Registration data is shared with service providers that run the event and is not sold."),
    project_ownership: disclosed("Teams retain ownership of submitted explanations.", "Teams retain ownership", rules, "Teams retain ownership of their written explanations."),
    project_license: disclosed("Nonexclusive license to publish submitted explanations with team attribution.", "Nonexclusive publication license", rules, "Teams grant a nonexclusive license to publish submitted explanations with team attribution."),
    publicity_rights: disclosed("Winning team names may be published; student images require separate consent.", "Winner names may be published; images need separate consent", rules, "The foundation may publish winning team names; student images require separate consent."),
    cancellation_rights: disclosed("Organizer may reschedule for platform failure.", "May reschedule after platform failure", rules, "The foundation may pause or reschedule the challenge after a material platform failure."),
    material_terms: disclosed(["cash award divided among student team members", "submission publication license"], "Team award division and publication license", rules, "Teams grant a nonexclusive license to publish submitted explanations with team attribution.", { kind: "text_list", values: ["cash award divided among team", "publication license"] }),
  };
  return buildCard("cipher-finch-student-challenge", "A free worldwide online team competition that distinguishes its cash prize from an organizer-valued equipment package.", [rules, prizes, privacy], facts);
}

function orchardSkyCard(): OpportunityCard {
  const program = page("program", "https://orchardsky.example/research-week", "Orchard Sky Research Week", "official_program_page");
  const cost = page("cost", "https://orchardsky.example/research-week/cost", "Research Week cost", "official_cost_page");
  const aid = page("aid", "https://orchardsky.example/research-week/aid", "Research Week aid", "official_financial_aid_page");
  const terms = page("terms", "https://orchardsky.example/research-week/terms", "Research Week terms", "official_terms");
  const facts: Partial<OpportunityFacts> = {
    opportunity_name: disclosed("Orchard Sky Research Week", "Orchard Sky Research Week", program, "Orchard Sky Research Week is a seven-day residential environmental research program."),
    opportunity_category: disclosed("research program", "Research program", program, "Orchard Sky Research Week is a seven-day residential environmental research program."),
    official_url: disclosed(program.url, program.url, program, "Official page: https://orchardsky.example/research-week", { kind: "text", value: program.url }),
    operating_organization: disclosed("Orchard Sky University Extension", "Orchard Sky University Extension", program, "Orchard Sky University Extension operates the program and employs its instructional staff."),
    organization_type: disclosed("university extension division", "University extension division", program, "Orchard Sky University Extension operates the program and employs its instructional staff."),
    named_institution: disclosed("Orchard Sky University", "Orchard Sky University", program, "The program is an Orchard Sky University Extension offering."),
    institution_relationship: disclosed("institution_operated", "Institution operated", program, "Orchard Sky University Extension operates the program and employs its instructional staff.", { kind: "relationship", value: "institution_operated" }),
    relationship_explanation: disclosed("The university extension division operates the program and employs its instructional staff.", "University Extension operates the program and employs its staff", program, "Orchard Sky University Extension operates the program and employs its instructional staff."),
    grade_levels: disclosed(["11", "12"], "Grades 11–12", program, "Students entering grades 11 or 12 are eligible." , { kind: "text_list", values: ["11", "12"] }),
    geographic_restrictions: disclosed("Residents of the fictional Tri-County region", "Tri-County residents", program, "Applicants must live in the Tri-County region."),
    application_deadline: disclosed("February 12, 2027", "February 12, 2027", program, "Applications are due February 12, 2027.", { kind: "date", isoDate: "2027-02-12" }),
    start_date: disclosed("July 11, 2027", "July 11, 2027", program, "The program runs July 11–17, 2027.", { kind: "date", isoDate: "2027-07-11" }),
    end_date: disclosed("July 17, 2027", "July 17, 2027", program, "The program runs July 11–17, 2027.", { kind: "date", isoDate: "2027-07-17" }),
    duration: disclosed("seven days", "7 days", program, "Orchard Sky Research Week is a seven-day residential environmental research program.", { kind: "duration", amount: 7, unit: "days" }),
    weekly_hours: disclosed("42 scheduled hours", "42 scheduled hours", program, "The schedule contains 42 instructional and field hours.", { kind: "hours", minimum: 42, maximum: null, period: "total" }),
    participation_format: disclosed("residential", "Residential", program, "Orchard Sky Research Week is a seven-day residential environmental research program.", { kind: "participation_format", value: "residential" }),
    location: disclosed("Orchard Sky University field station", "Orchard Sky University field station", program, "Students stay and study at the university field station."),
    application_fee: disclosed(15, "$15", cost, "A nonrefundable $15 application fee is required.", { kind: "money", amount: 15, currency: "USD", classification: "fee" }),
    tuition: disclosed(1200, "$1,200", cost, "Program tuition is $1,200.", { kind: "money", amount: 1200, currency: "USD", classification: "fee" }),
    estimated_total_mandatory_cost: unclear("The published application-fee and tuition subtotal is $1,215 before travel, but no deposit or other mandatory-cost disclosure was found, so a complete total cannot be stated.", cost, "The application fee and tuition total $1,215 before travel."),
    lodging_included: disclosed(true, "Yes", cost, "Tuition includes lodging and all meals.", { kind: "boolean", value: true }),
    meals_included: disclosed(true, "Yes", cost, "Tuition includes lodging and all meals.", { kind: "boolean", value: true }),
    travel_included: disclosed(false, "No", cost, "Travel to the field station is not included.", { kind: "boolean", value: false }),
    financial_aid: disclosed("Full and half tuition grants; application fee waivers on request.", "Full and half tuition grants; fee waivers", aid, "Need-based full and half tuition grants are available, and applicants may request an application-fee waiver."),
    refund_policy: disclosed("Tuition refundable through June 1; application fee nonrefundable.", "Tuition refundable through June 1; application fee nonrefundable", cost, "Tuition is refundable through June 1; the application fee is nonrefundable."),
    selection_process: factSchema.parse({ status: "not_found", note: "No selection process was found on the reviewed program, cost, aid, or terms pages." }),
    selection_evidence: factSchema.parse({ status: "not_found", note: "The reviewed pages publish neither numerical nor descriptive selection evidence." }),
    program_seat: disclosed("residential research-week seat", "Program seat", program, "Selected students receive a seat in the residential research week."),
    college_credit: disclosed("one elective credit after completion and assessment", "1 elective credit after completion and assessment", program, "Students who complete the assessment may earn one Orchard Sky elective credit."),
    mentorship: disclosed("faculty and graduate mentor groups", "Faculty and graduate mentor groups", program, "Each student joins a faculty and graduate mentor group."),
    other_benefits: disclosed(["field notebook", "one elective credit when assessment requirements are met"], "Field notebook and possible elective credit", program, "Students keep a field notebook and may earn one elective credit after assessment.", { kind: "text_list", values: ["field notebook", "one elective credit after assessment"] }),
    project_ownership: disclosed("Students retain ownership of field notes and reports.", "Students retain ownership", terms, "Students retain ownership of their field notes and reports."),
    project_license: disclosed("University may archive final reports for teaching with attribution.", "Archival teaching license with attribution", terms, "Students grant the university permission to archive final reports for teaching with attribution."),
    publicity_rights: unclear("The terms refer to a separate media form, but the reviewed pages do not say whether it is optional.", terms, "Participants receive a media form before arrival."),
    cancellation_rights: disclosed("University may cancel for field conditions and refund tuition.", "May cancel for field conditions with tuition refund", terms, "The university may cancel for unsafe field conditions and will refund tuition paid."),
    material_terms: disclosed(["application fee is nonrefundable", "media-form choice is not stated"], "Nonrefundable application fee; unclear media form", terms, "Participants receive a media form before arrival.", { kind: "text_list", values: ["application fee nonrefundable", "media form optionality unclear"] }),
  };
  return buildCard("orchard-sky-research-week", "A university-operated residential research week with itemized charges, need-based grants, and an unclear media-form choice.", [program, cost, aid, terms], facts);
}

function tideglassCard(): OpportunityCard {
  const program = page("program", "https://tideglass.example/fellowship", "Tideglass Civic Data Fellowship", "official_program_page");
  const faq = page("faq", "https://tideglass.example/fellowship/faq", "Fellowship FAQ", "official_faq");
  const terms = page("terms", "https://tideglass.example/fellowship/terms", "Fellowship terms", "official_terms");
  const facts: Partial<OpportunityFacts> = {
    opportunity_name: disclosed("Tideglass Civic Data Fellowship", "Tideglass Civic Data Fellowship", program, "The Tideglass Civic Data Fellowship is a twelve-week hybrid program."),
    opportunity_category: disclosed("fellowship", "Fellowship", program, "The Tideglass Civic Data Fellowship is a twelve-week hybrid program."),
    official_url: disclosed(program.url, program.url, program, "Official page: https://tideglass.example/fellowship", { kind: "text", value: program.url }),
    operating_organization: disclosed("Tideglass Civic Lab", "Tideglass Civic Lab", program, "Tideglass Civic Lab operates the fellowship."),
    organization_type: unclear("The reviewed pages call Tideglass a lab but do not state its legal or organizational type.", program, "Tideglass Civic Lab operates the fellowship."),
    named_institution: disclosed("Sample Harbor University", "Sample Harbor University", program, "Some sessions are listed at Sample Harbor University."),
    institution_relationship: unclear("The pages list university classrooms and faculty speakers but do not state an operating, sponsorship, partnership, or hosting agreement.", program, "Some sessions are listed at Sample Harbor University, and two faculty members appear as guest speakers."),
    relationship_explanation: unclear("Location and speaker affiliations alone do not establish the institution's relationship to the operator.", program, "Some sessions are listed at Sample Harbor University, and two faculty members appear as guest speakers."),
    grade_levels: disclosed(["12"], "Grade 12", program, "Current grade 12 students may apply.", { kind: "text_list", values: ["12"] }),
    geographic_restrictions: disclosed("Within 40 miles of Sample Harbor", "Within 40 miles of Sample Harbor", program, "Applicants must live or attend school within 40 miles of Sample Harbor."),
    application_deadline: disclosed("November 20, 2026", "November 20, 2026", program, "Applications close November 20, 2026.", { kind: "date", isoDate: "2026-11-20" }),
    start_date: disclosed("January 9, 2027", "January 9, 2027", program, "The fellowship runs January 9 through March 27, 2027.", { kind: "date", isoDate: "2027-01-09" }),
    end_date: disclosed("March 27, 2027", "March 27, 2027", program, "The fellowship runs January 9 through March 27, 2027.", { kind: "date", isoDate: "2027-03-27" }),
    duration: disclosed("twelve weeks", "12 weeks", program, "The Tideglass Civic Data Fellowship is a twelve-week hybrid program.", { kind: "duration", amount: 12, unit: "weeks" }),
    weekly_hours: conflicting(
      { value: 5, displayValue: "5 hours per week", source: program, excerpt: "The overview asks fellows to reserve five hours each week.", normalizedValue: { kind: "hours", minimum: 5, maximum: null, period: "week" } },
      { value: 8, displayValue: "8 hours per week", source: faq, excerpt: "The FAQ says fellows should plan for eight hours per week including project work.", normalizedValue: { kind: "hours", minimum: 8, maximum: null, period: "week" } },
      "The overview and FAQ publish different weekly commitments.",
    ),
    required_live_hours: disclosed("3 hours per week", "3 live hours per week", faq, "Three hours each week are scheduled live sessions.", { kind: "hours", minimum: 3, maximum: null, period: "week" }),
    participation_format: disclosed("hybrid", "Hybrid", program, "The Tideglass Civic Data Fellowship is a twelve-week hybrid program.", { kind: "participation_format", value: "hybrid" }),
    location: disclosed("Online and listed Sample Harbor meeting rooms", "Online and Sample Harbor meeting rooms", program, "Fellows meet online and at listed Sample Harbor meeting rooms."),
    travel_requirements: disclosed("Local travel to six in-person sessions", "Travel to 6 local sessions", faq, "Fellows arrange local travel to six in-person Saturday sessions."),
    application_fee: disclosed(0, "$0", program, "There is no fee to apply or participate.", { kind: "money", amount: 0, currency: "USD", classification: "fee" }),
    estimated_total_mandatory_cost: disclosed(0, "$0", program, "There is no fee to apply or participate.", { kind: "money", amount: 0, currency: "USD", classification: "fee" }),
    financial_aid: factSchema.parse({ status: "not_applicable", note: "The published mandatory program cost is $0; local travel remains the participant's responsibility." }),
    refund_policy: factSchema.parse({ status: "not_applicable", note: "No program payment is required." }),
    selection_process: disclosed("Application essay, data exercise, and interview.", "Essay, data exercise, and interview", program, "Selection uses a short essay, a data exercise, and a finalist interview."),
    applicant_count: disclosed(500, "500 applicants", program, "The organizer says last year's applicant pool included about 500 completed applications." , { kind: "number", value: 500, unit: "people" }, { claimKind: "organizer_stated", note: "The page gives an approximate organizer-stated count." }),
    acceptance_rate_claim: disclosed(12, "12% organizer-stated acceptance rate", program, "The organizer describes the prior cohort as having a 12% acceptance rate but does not publish an accepted count.", { kind: "percentage", value: 12 }, { claimKind: "organizer_stated", note: "Organizer-stated rate; it cannot be recalculated because an acceptance count was not published." }),
    selection_evidence: disclosed("numerical and descriptive; accepted count absent", "Numerical and descriptive; accepted count absent", program, "The organizer describes the prior cohort as having a 12% acceptance rate but does not publish an accepted count."),
    stipend: disclosed(1500, "$1,500 stipend", program, "Fellows who complete the program receive a $1,500 stipend.", { kind: "money", amount: 1500, currency: "USD", classification: "cash" }),
    mentorship: disclosed("weekly project mentor meeting", "Weekly mentor meeting", program, "Each fellow meets weekly with a project mentor."),
    other_benefits: disclosed(["project mentorship", "public showcase"], "Project mentorship and public showcase", program, "Fellows receive project mentorship and present at a public showcase.", { kind: "text_list", values: ["project mentorship", "public showcase"] }),
    personal_information: disclosed(["contact information", "school", "demographic questions", "work sample"], "Contact details, school, demographics, and work sample", terms, "The application asks for contact information, school, optional demographic questions, and a work sample.", { kind: "text_list", values: ["contact information", "school", "optional demographic questions", "work sample"] }),
    data_sharing: unclear("The terms permit sharing with partners but do not name those partners or limit their uses.", terms, "Application information may be shared with program partners."),
    project_ownership: disclosed("Fellows retain project ownership.", "Fellows retain ownership", terms, "Fellows retain ownership of their project work."),
    project_license: disclosed("Perpetual nonexclusive license to reproduce final reports for program purposes.", "Perpetual nonexclusive program-use license", terms, "Fellows grant a perpetual, nonexclusive license to reproduce final reports for program purposes."),
    publicity_rights: disclosed("Organizer may use name, image, and recorded presentation unless the fellow opts out in writing.", "Name, image, and recording use with written opt-out", terms, "Tideglass may use a fellow's name, image, and recorded presentation unless the fellow opts out in writing."),
    cancellation_rights: disclosed("Organizer may move in-person meetings online.", "May move meetings online", terms, "Tideglass may move an in-person meeting online when facilities are unavailable."),
    material_terms: disclosed(["weekly-hours pages conflict", "partners receiving data are unnamed", "publicity use has written opt-out"], "Hours conflict, unnamed data partners, and publicity opt-out", terms, "Tideglass may use a fellow's name, image, and recorded presentation unless the fellow opts out in writing.", { kind: "text_list", values: ["weekly hours conflict", "unnamed data partners", "written publicity opt-out"] }),
  };
  return buildCard("tideglass-civic-data-fellowship", "A no-fee hybrid fellowship with a cash stipend, an organizer-stated rate that cannot be recalculated, an unclear university relationship, and conflicting weekly hours.", [program, faq, terms], facts, [{ fieldId: "weekly_hours", summary: "The overview says five hours per week while the FAQ says eight." }]);
}

function paperCraneCard(): OpportunityCard {
  const award = page("award", "https://papercrane.example/design-award", "Paper Crane Design Award", "official_program_page");
  const rules = page("rules", "https://papercrane.example/design-award/rules", "Award rules", "official_rules");
  const privacy = page("privacy", "https://papercrane.example/privacy", "Privacy", "official_privacy_policy");
  const facts: Partial<OpportunityFacts> = {
    opportunity_name: disclosed("Paper Crane Student Design Award", "Paper Crane Student Design Award", award, "The Paper Crane Student Design Award recognizes student-designed assistive objects."),
    opportunity_category: disclosed("award", "Award", award, "The Paper Crane Student Design Award recognizes student-designed assistive objects."),
    official_url: disclosed(award.url, award.url, award, "Official award page: https://papercrane.example/design-award", { kind: "text", value: award.url }),
    operating_organization: disclosed("Paper Crane Design Guild", "Paper Crane Design Guild", award, "Paper Crane Design Guild operates the award."),
    organization_type: disclosed("independent membership association", "Independent membership association", award, "The guild describes itself as an independent membership association."),
    named_institution: disclosed("Model Prairie College of Art", "Model Prairie College of Art", award, "The guild and Model Prairie College of Art jointly provide the jury."),
    institution_relationship: disclosed("institution_partnered", "Institution partnered", award, "The guild and Model Prairie College of Art jointly provide the jury, while the guild administers entries and prizes.", { kind: "relationship", value: "institution_partnered" }),
    relationship_explanation: disclosed("The guild administers entries and prizes; both organizations provide jurors.", "Guild administers entries and prizes; both provide jurors", award, "The guild and Model Prairie College of Art jointly provide the jury, while the guild administers entries and prizes."),
    grade_levels: disclosed(["9", "10", "11", "12"], "Grades 9–12", rules, "Students in grades 9–12 may enter.", { kind: "text_list", values: ["9", "10", "11", "12"] }),
    geographic_restrictions: disclosed("United States and territories", "United States and territories", rules, "Entrants must attend school in the United States or its territories."),
    entry_format: disclosed("individual", "Individual entry", rules, "Entries must be submitted by one student designer."),
    sponsor_requirement: disclosed("teacher verification", "Teacher verification", rules, "A teacher must verify student status but does not own or submit the work."),
    application_deadline: disclosed("March 2, 2027", "March 2, 2027", rules, "Entries close March 2, 2027.", { kind: "date", isoDate: "2027-03-02" }),
    decision_date: disclosed("May 5, 2027", "May 5, 2027", rules, "Finalists will be notified May 5, 2027.", { kind: "date", isoDate: "2027-05-05" }),
    duration: factSchema.parse({ status: "not_applicable", note: "This is a submission-based award, not a scheduled program." }),
    participation_format: disclosed("online", "Online submission", rules, "Entries are submitted online.", { kind: "participation_format", value: "online" }),
    application_fee: disclosed(25, "$25", rules, "Each entry requires a $25 submission fee.", { kind: "money", amount: 25, currency: "USD", classification: "fee" }),
    estimated_total_mandatory_cost: disclosed(25, "$25", rules, "Each entry requires a $25 submission fee and no other purchase is required.", { kind: "money", amount: 25, currency: "USD", classification: "fee" }),
    financial_aid: disclosed("Fee waivers available through a teacher request.", "Teacher-requested fee waivers", rules, "Teachers may request a submission-fee waiver for a student with financial need."),
    refund_policy: disclosed("Submission fees are nonrefundable after upload.", "Nonrefundable after upload", rules, "Submission fees are nonrefundable after a file is uploaded."),
    cancellation_policy: disclosed("If the award is cancelled, submission fees are returned.", "Fees returned if award is cancelled", rules, "If the guild cancels the award, paid submission fees will be returned."),
    selection_process: disclosed("Blind preliminary jury followed by finalist review against four published criteria.", "Blind preliminary jury, then finalist review", rules, "A blind preliminary jury selects finalists, followed by review against four published criteria."),
    acceptance_count: disclosed(12, "12 finalists", rules, "The rules name twelve finalist places.", { kind: "number", value: 12, unit: "people" }),
    selection_evidence: disclosed("numerical and descriptive; applicant count absent", "Numerical and descriptive; applicant count absent", rules, "The rules name twelve finalist places but do not publish a prior applicant count."),
    cash_award: disclosed(500, "$500 cash for each finalist", award, "Each finalist receives $500 cash.", { kind: "money", amount: 500, currency: "USD", classification: "cash" }),
    in_kind_value: disclosed(300, "$300 organizer-stated exhibit-production value (in kind)", award, "The guild describes finalist exhibit production as a $300 in-kind benefit.", { kind: "money", amount: 300, currency: "USD", classification: "in_kind" }, { claimKind: "organizer_stated", note: "Organizer-stated production value; not a cash payment." }),
    certificate: disclosed(true, "Finalist certificate", award, "Each finalist receives a certificate.", { kind: "boolean", value: true }),
    other_benefits: disclosed(["finalist exhibition", "jury feedback"], "Finalist exhibition and jury feedback", award, "Finalists receive exhibition placement and written jury feedback.", { kind: "text_list", values: ["finalist exhibition", "jury feedback"] }),
    personal_information: disclosed(["name", "school", "grade", "teacher contact", "project files"], "Name, school, grade, teacher contact, and project files", privacy, "The entry form collects name, school, grade, teacher contact, and project files.", { kind: "text_list", values: ["name", "school", "grade", "teacher contact", "project files"] }),
    data_sharing: disclosed("Finalist details shared with exhibit fabricator; not used for targeted ads.", "Finalist details shared with exhibit fabricator; no targeted ads", privacy, "Finalist details are shared with the exhibit fabricator and are not used for targeted advertising."),
    project_ownership: disclosed("Entrants retain ownership.", "Entrants retain ownership", rules, "Entrants retain ownership of submitted designs."),
    project_license: disclosed("Broad five-year license to reproduce, adapt, display, and promote entries.", "Five-year reproduction, adaptation, display, and promotion license", rules, "Entrants grant the guild a five-year, worldwide, nonexclusive license to reproduce, adapt, display, and promote the entry."),
    publicity_rights: disclosed("Finalist name, school, photo, and interview may be used for award publicity.", "Finalist name, school, photo, and interview may be used", rules, "Finalists grant permission to use their name, school, photo, and recorded interview for award publicity."),
    cancellation_rights: disclosed("Guild may cancel or change dates; fees returned only if the award is cancelled.", "May cancel or change dates; cancellation returns fees", rules, "The guild may cancel the award or change dates; fees are returned only if the award is cancelled."),
    material_terms: disclosed(["five-year adaptation license", "finalist publicity permission", "fee becomes nonrefundable after upload"], "Adaptation license, finalist publicity, and upload refund cutoff", rules, "Entrants grant the guild a five-year, worldwide, nonexclusive license to reproduce, adapt, display, and promote the entry.", { kind: "text_list", values: ["five-year adaptation license", "finalist publicity permission", "fee nonrefundable after upload"] }),
  };
  return buildCard("paper-crane-student-design-award", "A partnered design award with a submission fee, fee waivers, cash and separately labeled in-kind benefits, and a broad five-year project license.", [award, rules, privacy], facts);
}

function redwoodCometCard(): OpportunityCard {
  const program = page("program", "https://redwoodcomet.example/summer-studio", "Redwood Comet Summer Studio", "official_program_page");
  const costs = page("costs", "https://redwoodcomet.example/summer-studio/costs", "Studio costs", "official_cost_page");
  const terms = page("terms", "https://redwoodcomet.example/summer-studio/terms", "Studio terms", "official_terms");
  const facts: Partial<OpportunityFacts> = {
    opportunity_name: disclosed("Redwood Comet Summer Studio", "Redwood Comet Summer Studio", program, "Redwood Comet Summer Studio is a three-week commuter fabrication program."),
    opportunity_category: disclosed("enrichment program", "Enrichment program", program, "Redwood Comet Summer Studio is a three-week commuter fabrication program."),
    official_url: disclosed(program.url, program.url, program, "Official studio page: https://redwoodcomet.example/summer-studio", { kind: "text", value: program.url }),
    operating_organization: disclosed("Redwood Comet Makers Association", "Redwood Comet Makers Association", program, "Redwood Comet Makers Association operates the studio."),
    organization_type: disclosed("membership association", "Membership association", program, "Redwood Comet Makers Association describes itself as a membership association."),
    named_institution: disclosed("Demonstration Valley University", "Demonstration Valley University", program, "Demonstration Valley University sponsors ten tuition waivers but does not operate the studio."),
    institution_relationship: disclosed("institution_sponsored", "Institution sponsored", program, "Demonstration Valley University sponsors ten tuition waivers but does not operate the studio.", { kind: "relationship", value: "institution_sponsored" }),
    relationship_explanation: disclosed("The university funds ten tuition waivers; the association operates the studio.", "University funds ten waivers; association operates the studio", program, "Demonstration Valley University sponsors ten tuition waivers but does not operate the studio."),
    grade_levels: disclosed(["10", "11", "12"], "Grades 10–12", program, "Students entering grades 10–12 may register.", { kind: "text_list", values: ["10", "11", "12"] }),
    prerequisite_skills: disclosed(["shop safety orientation"], "Shop safety orientation", program, "Participants must complete the online shop safety orientation before the first day.", { kind: "text_list", values: ["shop safety orientation"] }),
    entry_format: disclosed("individual", "Individual registration", program, "Students register individually."),
    application_deadline: disclosed("April 15, 2027", "April 15, 2027", program, "Registration closes April 15, 2027 or when seats fill.", { kind: "date", isoDate: "2027-04-15" }),
    start_date: disclosed("June 7, 2027", "June 7, 2027", program, "The studio runs June 7–25, 2027.", { kind: "date", isoDate: "2027-06-07" }),
    end_date: disclosed("June 25, 2027", "June 25, 2027", program, "The studio runs June 7–25, 2027.", { kind: "date", isoDate: "2027-06-25" }),
    duration: disclosed("three weeks", "3 weeks", program, "Redwood Comet Summer Studio is a three-week commuter fabrication program.", { kind: "duration", amount: 3, unit: "weeks" }),
    weekly_hours: disclosed("30 hours per week", "30 hours per week", program, "The scheduled commitment is 30 hours per week.", { kind: "hours", minimum: 30, maximum: null, period: "week" }),
    participation_format: disclosed("commuter", "Commuter", program, "Redwood Comet Summer Studio is a three-week commuter fabrication program.", { kind: "participation_format", value: "commuter" }),
    location: disclosed("Redwood Comet Community Workshop", "Redwood Comet Community Workshop", program, "Sessions meet at Redwood Comet Community Workshop."),
    travel_requirements: disclosed("Daily transportation is the participant's responsibility.", "Participant arranges daily transportation", costs, "Participants arrange daily transportation to the workshop."),
    application_fee: disclosed(0, "$0", costs, "There is no application fee.", { kind: "money", amount: 0, currency: "USD", classification: "fee" }),
    deposit: disclosed(250, "$250 deposit", costs, "A $250 deposit holds a seat and is credited toward tuition.", { kind: "money", amount: 250, currency: "USD", classification: "deposit" }),
    tuition: disclosed(3000, "$3,000", costs, "Tuition is $3,000 including the deposit.", { kind: "money", amount: 3000, currency: "USD", classification: "fee" }),
    other_mandatory_costs: disclosed(75, "$75 materials fee", costs, "A separate $75 materials fee is required.", { kind: "money", amount: 75, currency: "USD", classification: "fee" }),
    estimated_total_mandatory_cost: disclosed(3075, "$3,075", costs, "Tuition plus the materials fee totals $3,075.", { kind: "money", amount: 3075, currency: "USD", classification: "fee" }, { claimKind: "calculated", calculation: { formula: "tuition + other_mandatory_costs", inputs: [{ fieldId: "tuition", value: 3000 }, { fieldId: "other_mandatory_costs", value: 75 }], explanation: "Calculated from published mandatory charges; the credited deposit is not added twice." } }),
    travel_included: disclosed(false, "No", costs, "Participants arrange daily transportation to the workshop.", { kind: "boolean", value: false }),
    lodging_included: factSchema.parse({ status: "not_applicable", note: "The program is commuter." }),
    meals_included: disclosed(false, "No", costs, "Meals are not provided.", { kind: "boolean", value: false }),
    financial_aid: disclosed("Ten full tuition waivers; materials fee remains due.", "10 full tuition waivers; $75 materials fee remains", costs, "Ten full tuition waivers are available; waiver recipients still pay the $75 materials fee."),
    refund_policy: unclear("The cost page calls the deposit a seat hold but does not say whether or when it is refundable.", costs, "A $250 deposit holds a seat and is credited toward tuition."),
    cancellation_policy: unclear("The reviewed terms reserve cancellation rights but do not state what payments would be returned.", terms, "The association may cancel a session if enrollment is too low."),
    selection_process: disclosed("First complete registrations until seats fill; waivers separately reviewed for need and statement.", "First complete registrations; separate waiver review", program, "Paid seats go to complete registrations in order received; waiver applications are reviewed for financial need and a short statement."),
    selection_evidence: disclosed("descriptive", "Descriptive", program, "Paid seats go to complete registrations in order received; waiver applications are reviewed for financial need and a short statement."),
    tuition_waiver: disclosed(3000, "$3,000 tuition waiver (not cash)", costs, "Each full waiver covers the $3,000 tuition charge and is not a cash payment.", { kind: "money", amount: 3000, currency: "USD", classification: "tuition_waiver" }),
    program_seat: disclosed("commuter fabrication studio seat", "Program seat", program, "Registered students receive a seat in the fabrication studio."),
    certificate: disclosed(true, "Safety and completion certificate", program, "Students completing required sessions receive a safety and completion certificate.", { kind: "boolean", value: true }),
    other_benefits: disclosed(["use of workshop equipment", "completion certificate"], "Workshop equipment access and certificate", program, "Tuition includes supervised workshop equipment access and a completion certificate.", { kind: "text_list", values: ["workshop equipment access", "completion certificate"] }),
    personal_information: disclosed(["contact details", "school", "emergency contact", "waiver financial information if requested"], "Contact, school, emergency contact, and optional waiver financial information", terms, "Registration collects contact details, school, emergency contact, and financial information only from waiver applicants.", { kind: "text_list", values: ["contact details", "school", "emergency contact", "waiver financial information"] }),
    data_sharing: disclosed("Emergency information shared with instructors; waiver information restricted to review panel.", "Emergency details to instructors; waiver data to review panel", terms, "Emergency information is shared with instructors; waiver financial information is limited to the review panel."),
    project_ownership: disclosed("Students own completed physical projects.", "Students own completed projects", terms, "Students own the physical projects they complete."),
    project_license: factSchema.parse({ status: "not_found", note: "No project license was found in the reviewed terms." }),
    publicity_rights: disclosed("Optional photo permission selected during registration.", "Optional photo permission", terms, "Photo permission is optional and selected separately during registration."),
    cancellation_rights: disclosed("Organizer may cancel for low enrollment.", "May cancel for low enrollment", terms, "The association may cancel a session if enrollment is too low."),
    material_terms: disclosed(["deposit refundability not stated", "organizer-cancellation reimbursement not stated", "waiver excludes materials fee"], "Unclear deposit and cancellation refunds; waiver excludes materials", terms, "The association may cancel a session if enrollment is too low.", { kind: "text_list", values: ["deposit refundability not stated", "cancellation reimbursement not stated", "waiver excludes materials fee"] }),
  };
  return buildCard("redwood-comet-summer-studio", "A university-sponsored commuter studio where sponsorship funds waivers rather than operation; deposit and organizer-cancellation refunds are not stated.", [program, costs, terms], facts);
}

function emberAtlasCard(): OpportunityCard {
  const program = page("program", "https://emberatlas.example/micro-internship", "Ember Atlas Micro-Internship", "official_program_page");
  const faq = page("faq", "https://emberatlas.example/micro-internship/faq", "Micro-Internship FAQ", "official_faq");
  const terms = page("terms", "https://emberatlas.example/micro-internship/terms", "Micro-Internship terms", "official_terms");
  const facts: Partial<OpportunityFacts> = {
    opportunity_name: disclosed("Ember Atlas Mapping Micro-Internship", "Ember Atlas Mapping Micro-Internship", program, "Ember Atlas Mapping Micro-Internship is an eight-week remote paid internship."),
    opportunity_category: disclosed("internship", "Internship", program, "Ember Atlas Mapping Micro-Internship is an eight-week remote paid internship."),
    official_url: disclosed(program.url, program.url, program, "Official page: https://emberatlas.example/micro-internship", { kind: "text", value: program.url }),
    operating_organization: disclosed("Ember Atlas Cartography Studio", "Ember Atlas Cartography Studio", program, "Ember Atlas Cartography Studio operates and supervises the internship."),
    organization_type: disclosed("privately held studio", "Privately held studio", program, "The operator describes itself as a privately held cartography studio."),
    named_institution: disclosed("Placeholder Ridge College", "Placeholder Ridge College", faq, "The studio was founded by two Placeholder Ridge College alumni."),
    institution_relationship: disclosed("founded_by_affiliates", "Founded by affiliates", faq, "The studio was founded by two Placeholder Ridge College alumni; the college has no role in the internship.", { kind: "relationship", value: "founded_by_affiliates" }),
    relationship_explanation: disclosed("Two founders are alumni; the college has no role in the internship.", "Founders are alumni; college has no program role", faq, "The studio was founded by two Placeholder Ridge College alumni; the college has no role in the internship."),
    grade_levels: disclosed(["11", "12"], "Grades 11–12", program, "Students currently in grades 11 or 12 may apply.", { kind: "text_list", values: ["11", "12"] }),
    geographic_restrictions: disclosed("United States, excluding locations where youth employment arrangement is unavailable", "United States where youth employment arrangement is available", program, "Applicants must reside in a U.S. location where the studio can arrange youth employment."),
    citizenship_restrictions: disclosed("Must already be authorized for paid work in the United States", "Must be authorized for paid U.S. work", program, "Applicants must already be authorized for paid work in the United States; sponsorship is not offered."),
    prerequisite_skills: disclosed(["spreadsheet basics", "one GIS or mapping sample"], "Spreadsheet basics and a GIS or mapping sample", program, "Applicants need spreadsheet basics and one GIS or mapping sample.", { kind: "text_list", values: ["spreadsheet basics", "GIS or mapping sample"] }),
    entry_format: disclosed("individual", "Individual application", program, "Applications are individual."),
    sponsor_requirement: disclosed("parent or guardian signature if under 18", "Guardian signature if under 18", terms, "A parent or guardian must sign the employment forms for an intern under 18."),
    application_deadline: disclosed("September 18, 2026", "September 18, 2026", program, "Applications close September 18, 2026.", { kind: "date", isoDate: "2026-09-18" }),
    decision_date: disclosed("October 9, 2026", "October 9, 2026", program, "Offers are scheduled by October 9, 2026.", { kind: "date", isoDate: "2026-10-09" }),
    start_date: disclosed("October 26, 2026", "October 26, 2026", program, "The internship runs October 26 through December 18, 2026.", { kind: "date", isoDate: "2026-10-26" }),
    end_date: disclosed("December 18, 2026", "December 18, 2026", program, "The internship runs October 26 through December 18, 2026.", { kind: "date", isoDate: "2026-12-18" }),
    duration: disclosed("eight weeks", "8 weeks", program, "Ember Atlas Mapping Micro-Internship is an eight-week remote paid internship.", { kind: "duration", amount: 8, unit: "weeks" }),
    weekly_hours: disclosed("6–8 hours per week", "6–8 hours per week", program, "Interns work six to eight hours per week.", { kind: "hours", minimum: 6, maximum: 8, period: "week" }),
    required_live_hours: disclosed("1 hour per week", "1 live hour per week", faq, "A one-hour weekly team meeting is required live.", { kind: "hours", minimum: 1, maximum: null, period: "week" }),
    participation_format: disclosed("online", "Online", program, "Ember Atlas Mapping Micro-Internship is an eight-week remote paid internship.", { kind: "participation_format", value: "online" }),
    application_fee: disclosed(0, "$0", program, "There is no application or participation fee.", { kind: "money", amount: 0, currency: "USD", classification: "fee" }),
    estimated_total_mandatory_cost: disclosed(0, "$0", program, "There is no application or participation fee.", { kind: "money", amount: 0, currency: "USD", classification: "fee" }),
    financial_aid: factSchema.parse({ status: "not_applicable", note: "No fee is charged and this is a paid internship." }),
    refund_policy: factSchema.parse({ status: "not_applicable", note: "No participant payment is required." }),
    selection_process: disclosed("Portfolio screen, structured interview, and paid trial task.", "Portfolio screen, structured interview, and paid trial task", program, "Selection includes a portfolio screen, structured interview, and a two-hour paid trial task."),
    selection_evidence: disclosed("descriptive", "Descriptive", program, "Selection includes a portfolio screen, structured interview, and a two-hour paid trial task."),
    stipend: disclosed(1200, "$1,200 total wages", program, "Interns are paid $1,200 in total wages across the eight weeks.", { kind: "money", amount: 1200, currency: "USD", classification: "cash" }, { note: "Presented as cash wages, not an in-kind valuation." }),
    mentorship: disclosed("weekly supervisor feedback", "Weekly supervisor feedback", faq, "Interns receive weekly feedback from a mapping supervisor."),
    other_benefits: disclosed(["paid trial task", "weekly supervisor feedback", "portfolio-ready map with client permission"], "Paid trial, feedback, and permission-based portfolio work", faq, "The studio pays for the trial task, provides weekly feedback, and may permit a sanitized final map in a portfolio.", { kind: "text_list", values: ["paid trial task", "weekly supervisor feedback", "permission-based portfolio work"] }),
    personal_information: disclosed(["contact details", "school", "work authorization", "portfolio", "payment forms after offer"], "Contact, school, work authorization, portfolio, and post-offer payment forms", terms, "The application requests contact details, school, work authorization, and a portfolio; payment forms are collected only after an offer.", { kind: "text_list", values: ["contact details", "school", "work authorization", "portfolio", "post-offer payment forms"] }),
    data_sharing: disclosed("Hiring platform and payroll provider process applicant or employee data.", "Hiring platform and payroll provider", terms, "Applicant and employee data is processed by the studio's hiring platform and payroll provider."),
    project_ownership: disclosed("Client owns commissioned map outputs; interns retain pre-existing portfolio materials.", "Client owns commissioned outputs; intern retains pre-existing materials", terms, "The client owns commissioned map outputs; interns retain their pre-existing portfolio materials."),
    project_license: disclosed("Intern grants license to incorporated pre-existing material only as needed for the client output.", "Limited license for incorporated pre-existing material", terms, "An intern licenses incorporated pre-existing material only as needed to use the commissioned client output."),
    confidentiality: disclosed("Client data and unreleased maps are confidential.", "Client data and unreleased maps confidential", terms, "Interns must keep client data and unreleased maps confidential."),
    publicity_rights: disclosed("No publicity permission in employment terms.", "No publicity permission stated", terms, "The employment terms do not request permission to use an intern's name, image, or video."),
    cancellation_rights: disclosed("Either side may end employment subject to applicable youth-employment rules; completed hours are paid.", "Either side may end; completed hours paid", terms, "Either side may end employment subject to applicable youth-employment rules, and all completed hours will be paid."),
    material_terms: disclosed(["client ownership of commissioned output", "confidential client data", "work authorization required"], "Client ownership, confidentiality, and work authorization", terms, "The client owns commissioned map outputs; interns retain their pre-existing portfolio materials.", { kind: "text_list", values: ["client owns commissioned output", "client data confidential", "work authorization required"] }),
  };
  return buildCard("ember-atlas-mapping-micro-internship", "A paid remote micro-internship whose college connection is limited to founder alumni status, with explicit wages, ownership, and confidentiality terms.", [program, faq, terms], facts);
}

async function main(): Promise<void> {
  const cards = [
    lanternBayCard(),
    cipherFinchCard(),
    orchardSkyCard(),
    tideglassCard(),
    paperCraneCard(),
    redwoodCometCard(),
    emberAtlasCard(),
  ];

  const root = process.cwd();
  await mkdir(path.join(root, "data", "demo"), { recursive: true });
  for (const card of cards) {
    await writeFile(
      path.join(root, "data", "demo", `${card.slug}.json`),
      `${JSON.stringify(card, null, 2)}\n`,
      "utf8",
    );
  }
  await exportPublicArtifacts(root);
}

void main();
