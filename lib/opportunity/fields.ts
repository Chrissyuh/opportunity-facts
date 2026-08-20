export const SECTIONS = [
  "identity",
  "eligibility",
  "commitment",
  "money",
  "selection",
  "outcomes",
  "terms",
] as const;

export type OpportunitySection = (typeof SECTIONS)[number];

export const EVIDENCE_STATUSES = [
  "disclosed",
  "not_found",
  "unclear",
  "conflicting",
  "not_applicable",
] as const;

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const REVIEW_STATES = [
  "demo",
  "draft",
  "automated_draft",
  "ai_audited",
  "human_reviewed",
  "organizer_confirmed",
] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

export function isDraftLikeReviewState(
  state: ReviewState,
): state is "draft" | "automated_draft" {
  return state === "draft" || state === "automated_draft";
}

export function isReviewAttestationState(
  state: ReviewState,
): state is "ai_audited" | "human_reviewed" | "organizer_confirmed" {
  return (
    state === "ai_audited" ||
    state === "human_reviewed" ||
    state === "organizer_confirmed"
  );
}

export function isPublicReviewState(
  state: ReviewState,
): state is "demo" | "ai_audited" | "human_reviewed" | "organizer_confirmed" {
  return state === "demo" || isReviewAttestationState(state);
}

export const PAGE_TYPES = [
  "official_program_page",
  "official_faq",
  "official_cost_page",
  "official_financial_aid_page",
  "official_rules",
  "official_terms",
  "official_privacy_policy",
  "public_record",
  "user_supplied",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export const CLAIM_KINDS = [
  "source_stated",
  "organizer_stated",
  "calculated",
] as const;

export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const RELATIONSHIP_TYPES = [
  "institution_operated",
  "institution_sponsored",
  "institution_partnered",
  "hosted_at_institution",
  "founded_by_affiliates",
  "independent",
  "unclear",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const PARTICIPATION_FORMATS = [
  "online",
  "commuter",
  "residential",
  "hybrid",
  "in_person",
] as const;

export type ParticipationFormat = (typeof PARTICIPATION_FORMATS)[number];

export const VALUE_TYPES = [
  "text",
  "text_list",
  "url",
  "date",
  "money",
  "number",
  "boolean",
  "percentage",
  "duration",
  "hours",
  "relationship",
  "participation_format",
] as const;

export type FieldValueType = (typeof VALUE_TYPES)[number];

export const COMPARISON_BEHAVIORS = [
  "text",
  "list",
  "chronological",
  "numeric",
  "status",
] as const;

export type ComparisonBehavior = (typeof COMPARISON_BEHAVIORS)[number];

export interface FieldDefinition {
  readonly id: string;
  readonly section: OpportunitySection;
  readonly label: string;
  readonly description: string;
  readonly core: boolean;
  readonly valueType: FieldValueType;
  readonly comparison: ComparisonBehavior;
  readonly allowedStatuses: readonly EvidenceStatus[];
}

const ALL_STATUSES = EVIDENCE_STATUSES;

function field<const Id extends string>(
  id: Id,
  section: OpportunitySection,
  label: string,
  description: string,
  valueType: FieldValueType = "text",
  core = false,
  comparison: ComparisonBehavior = "text",
): FieldDefinition & { readonly id: Id } {
  return {
    id,
    section,
    label,
    description,
    core,
    valueType,
    comparison,
    allowedStatuses: ALL_STATUSES,
  };
}

export const FIELD_DEFINITIONS = [
  field("opportunity_name", "identity", "Opportunity name", "The name used by the opportunity's official source."),
  field("opportunity_category", "identity", "Category", "The type of opportunity, such as a competition or summer program."),
  field("official_url", "identity", "Official URL", "The primary page published for the opportunity.", "url"),
  field("operating_organization", "identity", "Operating organization", "The organization that says it operates the opportunity.", "text", true),
  field("organization_type", "identity", "Organization type", "The organization type stated by a reviewed source."),
  field("named_institution", "identity", "Named institution or university", "Any institution named in connection with the opportunity."),
  field("institution_relationship", "identity", "Institution relationship", "The disclosed relationship between the operator and a named institution.", "relationship", true, "status"),
  field("relationship_explanation", "identity", "Relationship explanation", "A concise source-backed explanation of that relationship."),

  field("grade_levels", "eligibility", "Grade levels", "Eligible school grade levels.", "text_list", true, "list"),
  field("ages", "eligibility", "Ages", "Eligible participant ages."),
  field("geographic_restrictions", "eligibility", "Geographic restrictions", "Location-based eligibility restrictions."),
  field("citizenship_restrictions", "eligibility", "Citizenship or residency", "Citizenship or residency requirements."),
  field("prerequisite_skills", "eligibility", "Prerequisite skills", "Skills, coursework, or experience required before applying.", "text_list", false, "list"),
  field("entry_format", "eligibility", "Individual or team entry", "Whether participants enter individually or as a team."),
  field("sponsor_requirement", "eligibility", "Adult, school, or sponsor requirement", "Any adult, school, teacher, or sponsor required."),

  field("application_deadline", "commitment", "Application deadline", "The final stated application date.", "date", true, "chronological"),
  field("decision_date", "commitment", "Decision date", "When decisions or results are expected.", "date", false, "chronological"),
  field("start_date", "commitment", "Start date", "The stated program or event start date.", "date", false, "chronological"),
  field("end_date", "commitment", "End date", "The stated program or event end date.", "date", false, "chronological"),
  field("duration", "commitment", "Duration", "The total stated duration.", "duration", true, "numeric"),
  field("weekly_hours", "commitment", "Expected weekly hours", "The expected time commitment per week.", "hours", false, "numeric"),
  field("required_live_hours", "commitment", "Required live hours", "Hours that must be attended live.", "hours", false, "numeric"),
  field("participation_format", "commitment", "Participation format", "Whether participation is online, commuter, residential, hybrid, or in person.", "participation_format", true, "status"),
  field("location", "commitment", "Location", "The physical or online location stated by the source."),
  field("travel_requirements", "commitment", "Travel requirements", "Travel participants are expected to arrange or complete."),

  field("application_fee", "money", "Application fee", "A fee required to submit an application.", "money", false, "numeric"),
  field("deposit", "money", "Deposit", "A stated deposit, without inferring whether it is refundable.", "money", false, "numeric"),
  field("tuition", "money", "Program tuition or mandatory fee", "Tuition or another mandatory participation fee.", "money", false, "numeric"),
  field("other_mandatory_costs", "money", "Other mandatory costs", "Required costs beyond application fees, deposits, and tuition.", "money", false, "numeric"),
  field("estimated_total_mandatory_cost", "money", "Estimated total mandatory cost", "A stated total or a transparent calculation from disclosed mandatory costs.", "money", true, "numeric"),
  field("travel_included", "money", "Travel included", "Whether required travel is included in the stated price.", "boolean", false, "status"),
  field("lodging_included", "money", "Lodging included", "Whether lodging is included in the stated price.", "boolean", false, "status"),
  field("meals_included", "money", "Meals included", "Whether meals are included in the stated price.", "boolean", false, "status"),
  field("financial_aid", "money", "Financial aid", "Published need-based aid, scholarships, or fee assistance.", "text", true),
  field("refund_policy", "money", "Refund policy", "The disclosed refund terms; a deposit alone does not establish refundability.", "text", true),
  field("cancellation_policy", "money", "Cancellation policy", "What happens to participation or payments if plans are cancelled."),

  field("selection_process", "selection", "Selection process", "The published steps or criteria used to select participants.", "text", true),
  field("applicant_count", "selection", "Published applicant count", "A sourced count of applicants.", "number", false, "numeric"),
  field("acceptance_count", "selection", "Published acceptance or winner count", "A sourced count of accepted participants or winners.", "number", false, "numeric"),
  field("acceptance_rate_claim", "selection", "Published acceptance-rate claim", "An acceptance rate directly stated by the organizer.", "percentage", false, "numeric"),
  field("calculated_acceptance_rate", "selection", "Calculated acceptance rate", "A rate calculated only from published applicant and acceptance counts.", "percentage", false, "numeric"),
  field("selection_evidence", "selection", "Selection evidence", "Whether published selection evidence is numerical, descriptive, or absent.", "text", true, "status"),

  field("cash_award", "outcomes", "Cash award", "Cash paid to a participant or winner.", "money", false, "numeric"),
  field("stipend", "outcomes", "Stipend", "Cash support paid for participation or work.", "money", false, "numeric"),
  field("tuition_waiver", "outcomes", "Tuition waiver", "Tuition waived rather than cash paid to the participant.", "money", false, "numeric"),
  field("program_seat", "outcomes", "Program seat", "Admission to, or a place in, the program."),
  field("in_kind_value", "outcomes", "In-kind value", "A non-cash benefit and its source-stated value, if any.", "money", false, "numeric"),
  field("certificate", "outcomes", "Certificate", "A certificate or credential stated as an outcome.", "boolean", false, "status"),
  field("college_credit", "outcomes", "College credit", "College credit stated as an outcome."),
  field("mentorship", "outcomes", "Mentorship", "Mentoring stated as a participant benefit."),
  field("other_benefits", "outcomes", "Other participant benefits", "Other participant or winner benefits, kept distinct from cash.", "text_list", true, "list"),

  field("personal_information", "terms", "Personal information requested", "Personal information the opportunity says it collects.", "text_list", false, "list"),
  field("data_sharing", "terms", "Data sharing or advertising", "Published data-sharing, marketing, or advertising language."),
  field("project_ownership", "terms", "Project ownership", "Who retains ownership of submitted work."),
  field("project_license", "terms", "Project license", "Rights the participant grants the organizer in submitted work."),
  field("publicity_rights", "terms", "Publicity rights", "Permission involving a participant's photo, name, voice, or video."),
  field("confidentiality", "terms", "Confidentiality requirements", "Any confidentiality or nondisclosure requirement."),
  field("cancellation_rights", "terms", "Organizer cancellation rights", "Rights the organizer reserves to cancel, modify, or suspend the opportunity."),
  field("material_terms", "terms", "Material terms requiring attention", "Other terms a participant should read before agreeing.", "text_list", true, "list"),
] as const satisfies readonly FieldDefinition[];

export type FieldId = (typeof FIELD_DEFINITIONS)[number]["id"];

export type MoneyClassification = "fee" | "deposit" | "cash" | "in_kind" | "tuition_waiver";

export const MONEY_CLASSIFICATION_BY_FIELD = {
  application_fee: "fee",
  deposit: "deposit",
  tuition: "fee",
  other_mandatory_costs: "fee",
  estimated_total_mandatory_cost: "fee",
  cash_award: "cash",
  stipend: "cash",
  tuition_waiver: "tuition_waiver",
  in_kind_value: "in_kind",
} as const satisfies Partial<Record<FieldId, MoneyClassification>>;

export const FIELD_IDS = FIELD_DEFINITIONS.map((definition) => definition.id) as [
  FieldId,
  ...FieldId[],
];

export const CORE_FIELD_IDS = FIELD_DEFINITIONS.filter(
  (definition) => definition.core,
).map((definition) => definition.id) as FieldId[];

if (CORE_FIELD_IDS.length !== 13) {
  throw new Error(`The registry must define exactly 13 core facts; found ${CORE_FIELD_IDS.length}.`);
}
