import "server-only";

import type { FieldId } from "@/lib/opportunity/fields";
import type { Fact } from "@/lib/opportunity/schema";
import type { EvidenceSource } from "@/lib/opportunity";

export const CLAIM_SUBJECTS = [
  "applicant_participant",
  "team",
  "teacher_adviser",
  "parent_guardian",
  "school",
  "organizer",
  "platform_account_user",
  "institution",
  "employee_mentor",
  "website_visitor",
  "finalist_winner",
  "historical_participant_cohort",
  "legal_service_jurisdiction",
  "unclear",
] as const;

export type ClaimSubject = (typeof CLAIM_SUBJECTS)[number];

const PROGRAM_SUBJECT =
  /\b(applicants?|participants?|entrants?|students?|teams?|finalists?|winners?|eligible|eligibility|who can apply|program participants?)\b/iu;
const PLATFORM_SUBJECT =
  /\b(account(?: holder| creation| access)?s?|platform|website|site|services?|users?|visitor(?:s)?)\b/iu;
const LEGAL_CONTEXT =
  /\b(governed by|jurisdiction|venue|choice of law|laws? of|services? (?:are|is) available|access to (?:our|the) services?)\b/iu;
const PROGRAM_REQUIREMENT =
  /\b(eligible|eligibility|must (?:be|have|submit|attend|participate)|required to|requirement|who can apply|applicants? must|participants? must|teams? must)\b/iu;
const PARTICIPATION_LOCATION =
  /\b(participat|attend|held at|takes place|session|event|campus|online|virtual|remote|residential|in[ -]person)\b/iu;
const GEOGRAPHIC_ELIGIBILITY =
  /\b(eligible|eligibility|open to|may apply|who can apply|must (?:live|reside|attend school|be based)|residents? of|students? from|based in)\b/iu;
const SELECTION_SEMANTICS =
  /\b(apply|application|review(?:ed)?|interview|select(?:ed|ion)?|judg(?:e|ed|ing)|criteria|decision|shortlist|semifinal|finalist|advance|matching|lottery|first[ -]come|admission)\b/iu;
const OPTIONAL_CHARGE = /\b(optional|elective|add[ -]?on|not required)\b/iu;
const RESTRICTED_PROJECT_FUNDING =
  /\b(project|experiment|build|venture)\b.{0,100}\b(fund|funding|budget|grant)\b|\b(fund|funding|budget|grant)\b.{0,100}\b(project|experiment|build|venture)\b|\b(?:money|funds?|award)\b.{0,80}\bto (?:build|develop|conduct|complete)\b|\b(?:receive(?:s|d)?|provid(?:e|es|ed))\b.{0,50}[$£€]\s?\d[\d,.]*.{0,80}\bto (?:build|develop|conduct|complete)\b/iu;
const EXPLICIT_CASH =
  /\b(cash|prize money|cash award|monetary award|prize funds?)\b|\b(?:prize|award)\s+of\s+[$£€]/iu;

const AMOUNT_LABELED_PRIZE =
  /\p{Sc}\s?\d[\d,.]*(?:\s+(?:cash|monetary))?\s+(?:prize|award)\b/iu;

const ADMISSION_ACTION =
  /\b(?:admi(?:t(?:ted|s|ting)?|ssion)|accept(?:ed|ance|s|ing)?|enroll(?:ed|ing|ment|s)?|seats?|places?|placement)\b/giu;
const EXTERNAL_ADMISSION_TARGET =
  /\b(?:college|university|school|institution|employer|company)\b/giu;
const OPPORTUNITY_SEAT_TARGET =
  /\b(?:opportunity|program|fellowship|course|cohort|session|academy|camp|challenge|competition)\b/giu;
const OPPORTUNITY_IMMEDIATELY_BEFORE_ADMISSION =
  /\b(?:opportunity|program|fellowship|course|cohort|session|academy|camp|challenge|competition)\s*$/iu;

function explicitlyStatesCash(text: string): boolean {
  return EXPLICIT_CASH.test(text) || AMOUNT_LABELED_PRIZE.test(text);
}

/**
 * Admission can be a genuine outcome without being a seat in the opportunity
 * itself. A program noun must be in the admission target phrase (after the
 * admission action and before a later institution, or immediately before the
 * action). Merely mentioning the opportunity earlier in the sentence cannot
 * turn later college, school, or employer admission into `program_seat`.
 */
function admissionTargetsExternalEntity(text: string): boolean {
  const normalized = text.toLowerCase();
  for (const action of normalized.matchAll(ADMISSION_ACTION)) {
    if (action.index === undefined) continue;
    const before = normalized.slice(Math.max(0, action.index - 80), action.index);
    const after = normalized.slice(
      action.index + action[0].length,
      action.index + action[0].length + 180,
    );
    const externalAfter = [...after.matchAll(EXTERNAL_ADMISSION_TARGET)]
      .find((match) => match.index !== undefined)?.index ?? -1;
    const opportunityAfter = [...after.matchAll(OPPORTUNITY_SEAT_TARGET)]
      .find((match) => match.index !== undefined)?.index ?? -1;
    const externalBefore = [...before.matchAll(EXTERNAL_ADMISSION_TARGET)].at(-1);
    const externalBeforeDistance = externalBefore?.index === undefined
      ? Number.POSITIVE_INFINITY
      : before.length - (externalBefore.index + externalBefore[0].length);
    const hasExternalTarget = externalAfter >= 0 || externalBeforeDistance <= 40;
    const opportunityIsDirectTarget =
      (opportunityAfter >= 0 &&
        opportunityAfter <= 100 &&
        (externalAfter < 0 || opportunityAfter < externalAfter)) ||
      OPPORTUNITY_IMMEDIATELY_BEFORE_ADMISSION.test(before);
    if (hasExternalTarget && !opportunityIsDirectTarget) {
      return true;
    }
  }
  return false;
}

function evidence(fact: Fact): EvidenceSource[] {
  return [
    ...fact.sources,
    ...fact.conflictingValues.flatMap((candidate) => candidate.sources),
  ];
}

function lower(source: EvidenceSource): string {
  return source.excerpt.toLowerCase();
}

function isPlatformOnly(text: string): boolean {
  return PLATFORM_SUBJECT.test(text) && !PROGRAM_SUBJECT.test(text);
}

function isFinalistOnly(text: string): boolean {
  return /\b(finalists?|winners?|semifinalists?|selected teams?|advancing teams?)\b/iu.test(text) &&
    !/\b(all|every)\s+(?:applicants?|participants?|teams?)\b/iu.test(text);
}

function sourceSupportsField(fieldId: FieldId, source: EvidenceSource): boolean {
  const text = lower(source);

  if (fieldId === "ages") {
    if (isPlatformOnly(text)) return false;
    return !/\b(?:at least|minimum age|under)\s+\d{1,2}\b/iu.test(text) ||
      PROGRAM_SUBJECT.test(text) || PROGRAM_REQUIREMENT.test(text);
  }

  if (fieldId === "geographic_restrictions" || fieldId === "citizenship_restrictions") {
    if (LEGAL_CONTEXT.test(text) && !PROGRAM_SUBJECT.test(text)) return false;
    if (
      fieldId === "geographic_restrictions" &&
      /\b(national|global|international|worldwide)\b/iu.test(text) &&
      !GEOGRAPHIC_ELIGIBILITY.test(text)
    ) {
      return false;
    }
  }

  if (fieldId === "sponsor_requirement") {
    const accountSupervision =
      (/\b(parent|guardian)\b.{0,120}\b(supervis|consent|account|terms|services?)\b/iu.test(text) ||
        /\b(supervis|consent|account|terms|services?)\b.{0,120}\b(parent|guardian)\b/iu.test(text)) &&
      isPlatformOnly(text);
    if (accountSupervision) return false;
  }

  if (fieldId === "location") {
    const office = /\b(office|headquarters|headquartered|mailing address|contact us|located at)\b/iu.test(text);
    const attendance = PARTICIPATION_LOCATION.test(text.replace(/\battend school\b/giu, ""));
    if (office && !attendance) return false;
    const eligibilityGeography =
      /\b(reside|residence|live|attend school|school district|congressional district|eligible|eligibility)\b/iu.test(text);
    if (eligibilityGeography && !attendance) return false;
  }

  if (["cash_award", "stipend", "tuition_waiver", "program_seat", "in_kind_value", "certificate", "college_credit", "mentorship", "other_benefits"].includes(fieldId)) {
    const participantRecipientText = text.replace(
      /\b(?:student|participant|entrant|finalist|winner)(?:'s|\u2019s)\s+(?:teacher|adviser|educator|school|mentor)\b/giu,
      "",
    );
    const nonParticipantRecipient = (
      /\b(teachers?|advisers?|educators?|schools?|mentors?|employees?)\b.{0,60}\b(receive|receives|awarded|provided|eligible for)\b/iu.test(text) ||
      /\b(receive|receives|awarded|provided)\b.{0,60}\b(teachers?|advisers?|educators?|schools?|mentors?|employees?)\b/iu.test(text)
    ) && !(
      /\b(participants?|students?|entrants?|teams?|finalists?|winners?)\b.{0,60}\b(receive|receives|awarded|provided|eligible for)\b/iu.test(participantRecipientText) ||
      /\b(receive|receives|awarded|provided)\b.{0,60}\b(participants?|students?|entrants?|teams?|finalists?|winners?)\b/iu.test(participantRecipientText)
    );
    if (nonParticipantRecipient) return false;
    if (
      fieldId === "cash_award" &&
      (RESTRICTED_PROJECT_FUNDING.test(text) || !explicitlyStatesCash(text))
    ) {
      return false;
    }
    if (fieldId === "stipend" && !/\bstipend\b/iu.test(text)) return false;
    if (fieldId === "program_seat" && admissionTargetsExternalEntity(text)) {
      return false;
    }
    if (
      fieldId === "program_seat" &&
      /\b(accept(?:ed|ance)|admission)\b.{0,100}\b(enroll|enrollment|program)\b/iu.test(text) &&
      !/\b(award(?:ed)?|prize|scholarship|waiv(?:e|ed)|free|complimentary|receive(?:s|d)?)\b/iu.test(text)
    ) {
      return false;
    }
  }

  if (
    [
      "application_fee",
      "tuition",
      "deposit",
      "other_mandatory_costs",
      "estimated_total_mandatory_cost",
    ].includes(fieldId) &&
    OPTIONAL_CHARGE.test(text)
  ) {
    return false;
  }

  if (["travel_requirements", "location", "duration", "required_live_hours", "weekly_hours"].includes(fieldId)) {
    if (isFinalistOnly(text) && !/\bapplicants? who (?:advance|are selected)|if selected\b/iu.test(text)) {
      return false;
    }
  }

  if (["cancellation_policy", "cancellation_rights", "material_terms", "sponsor_requirement"].includes(fieldId)) {
    const optionalService =
      /\b(optional|opt(?:ing)? in|text messages?|sms|notifications?|account feature)\b/iu.test(text) &&
      !PROGRAM_REQUIREMENT.test(text);
    if (optionalService) return false;
  }

  if (fieldId === "selection_process" && !SELECTION_SEMANTICS.test(text)) {
    return false;
  }

  if (fieldId === "personal_information" || fieldId === "data_sharing") {
    const programDataContext =
      /\b(program (?:projects?|submissions?|progress|communications?|staff|instructors?|delivery)|delivering the program|projects? and submissions?|modules? completed|quiz results?)\b/iu.test(text);
    if (
      isPlatformOnly(text) &&
      !programDataContext &&
      !/\b(applicant|participant|student|program application|mentor matching)\b/iu.test(text)
    ) {
      return false;
    }
  }

  if (fieldId === "project_ownership" || fieldId === "project_license") {
    if (
      /\buser content\b/iu.test(text) &&
      !/\b(project|submission|entry|experiment|research|work product)\b/iu.test(text)
    ) {
      return false;
    }
  }

  if (fieldId === "refund_policy") {
    if (
      /\bplatform|services?\b/iu.test(text) &&
      !/\b(tuition|program fee|deposit|payment|purchase|enrollment)\b/iu.test(text)
    ) {
      return false;
    }
  }

  if (fieldId === "cancellation_rights") {
    if (
      /\b(alter|suspend|discontinue|terminate)\b.{0,80}\b(?:our|the) services?\b/iu.test(text) &&
      !/\b(program|competition|challenge|cohort|participation)\b/iu.test(text)
    ) {
      return false;
    }
    if (
      /\b(health|safety|mask|distancing|protocol|protective measure)\b/iu.test(text) &&
      !/\b(cancel|postpone|suspend|terminate|discontinue|change (?:the )?(?:program|competition|challenge|schedule|rules|format))\b/iu.test(text)
    ) {
      return false;
    }
  }

  return true;
}

export interface FactScopeValidation {
  readonly supported: boolean;
  readonly reason: string | null;
}

/**
 * Rejects an exact excerpt when its grammatical/product subject differs from
 * the subject of the flat Opportunity Facts field. This is intentionally
 * conservative: every citation used for a context-sensitive displayed fact
 * must concern the field's subject. Human review can later separate mixed support.
 */
export function validateFactSubjectScope(
  fieldId: FieldId,
  fact: Fact,
): FactScopeValidation {
  if (fact.status !== "disclosed" && fact.status !== "conflicting") {
    return { supported: true, reason: null };
  }
  const sources = evidence(fact);
  const displayedFact = `${fact.displayValue ?? ""} ${
    Array.isArray(fact.value) ? fact.value.join(" ") : fact.value ?? ""
  }`;
  const proposedNonParticipantBenefit =
    fieldId === "other_benefits" &&
    /\b(?:for|to)\s+(?:the\s+)?(?:winning\s+|winner['’]s\s+)?(?:school|teacher|educator|adviser|advisor)\b|\b(?:school|teacher|educator|adviser|advisor)\s+(?:benefit|prize|award|receives?|is awarded)\b/iu.test(displayedFact);
  if (
    !proposedNonParticipantBenefit &&
    (sources.length === 0 || sources.every((source) => sourceSupportsField(fieldId, source)))
  ) {
    return { supported: true, reason: null };
  }

  const reasons: Partial<Record<FieldId, string>> = {
    ages: "The cited age language governs a platform, account, website, or legal service rather than opportunity eligibility.",
    geographic_restrictions: "The cited geography language governs legal/service availability rather than participant eligibility.",
    citizenship_restrictions: "The cited jurisdiction language does not establish participant citizenship or residency eligibility.",
    sponsor_requirement: "The cited adult language governs account or service supervision rather than an opportunity adult/adviser requirement.",
    location: "The cited place is an organizer, office, or stage-specific location rather than a universal participant location.",
    selection_process: "The cited wording describes the opportunity but does not establish an application, review, selection, or advancement process.",
    travel_requirements: "The cited travel language applies only to a later recipient group or stage, not every applicant or participant.",
    application_fee: "The cited charge is optional and cannot support a universal application fee.",
    tuition: "The cited charge is optional and cannot support universal tuition.",
    deposit: "The cited charge is optional and cannot support a mandatory deposit.",
    other_mandatory_costs: "The cited charge is optional and cannot support another mandatory cost.",
    estimated_total_mandatory_cost: "An optional charge cannot support a mandatory-cost total.",
    cash_award: "The cited money is restricted project funding or does not explicitly establish participant cash.",
    stipend: "The cited excerpt does not explicitly establish a stipend.",
    program_seat: "The cited admission or enrollment is to an external college, university, school, institution, or employer rather than a seat in this opportunity.",
    other_benefits: "The displayed benefit includes a teacher, adviser, educator, or school recipient rather than only participant benefits.",
    cancellation_policy: "The cited service or optional-feature terms do not establish a participant program cancellation policy.",
    material_terms: "The cited optional-service term was not established as a requirement of the opportunity.",
  };
  return {
    supported: false,
    reason:
      reasons[fieldId] ??
      "The cited excerpt concerns a different subject or recipient group than the displayed opportunity fact.",
  };
}

export function structuredSubjectScopeFailure(
  family: string,
  path: readonly (string | number)[],
  value: unknown,
  sources: readonly EvidenceSource[],
): string | null {
  const text = sources.map((source) => source.excerpt).join(" ").toLowerCase();
  const pathText = path.join(".");
  const record = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;

  if (family === "costItems" && /\.definition$/u.test(pathText) && record !== null) {
    const kind = typeof record.kind === "string" ? record.kind : null;
    const requirement = typeof record.requirement === "string" ? record.requirement : null;
    const kindEvidence: Readonly<Record<string, RegExp>> = {
      application_fee: /\bapplication\b.{0,50}\b(fee|cost|payment)\b|\b(fee|cost|payment)\b.{0,50}\bapplication\b/iu,
      tuition: /\b(tuition|program fees?|program costs?|participation fees?|enrollment fees?)\b/iu,
      deposit: /\bdeposit\b/iu,
      travel: /\b(travel|transportation|airfare|flight)\b/iu,
      lodging: /\b(lodging|housing|accommodation|hotel)\b/iu,
      meals: /\b(meals?|food)\b/iu,
      materials: /\b(materials?|supplies|equipment)\b/iu,
      other: /\b(costs?|fees?|charges?|payments?|expenses?|prices?)\b/iu,
    };
    if (kind === null || kindEvidence[kind] === undefined || !kindEvidence[kind].test(text)) {
      return "the proposed cost kind is not stated by the cited excerpt";
    }
    const optional = OPTIONAL_CHARGE.test(text);
    const conditional = /\b(conditional|depending on|depends on|varies by|only if|if selected|if applicable|scholarship[- ]adjusted)\b/iu.test(text);
    if (optional && requirement !== "optional") {
      return "an optional charge was proposed as a required or conditional participant cost";
    }
    if (conditional && requirement === "required") {
      return "a conditional charge was proposed as universally required";
    }
    if (requirement === "optional" && !optional) {
      return "optional cost treatment is not stated by the cited excerpt";
    }
    if (requirement === "conditional" && !conditional) {
      return "conditional cost treatment is not stated by the cited excerpt";
    }
  }

  if (family === "outcomes" && /\.definition$/u.test(pathText) && record !== null) {
    const outcomeType = typeof record.outcomeType === "string" ? record.outcomeType : null;
    const restrictedFunding = RESTRICTED_PROJECT_FUNDING.test(text);
    const explicitCash = explicitlyStatesCash(text);
    const educatorRecipient = /\b(teachers?|educators?|advisers?|advisors?)\b/iu.test(text);
    if (["personal_cash_prize", "team_cash_prize"].includes(outcomeType ?? "")) {
      if (restrictedFunding || !explicitCash || educatorRecipient) {
        return "the cited excerpt does not establish unrestricted participant or team cash";
      }
    }
    if (
      outcomeType === "educator_cash_prize" &&
      (!explicitCash || !educatorRecipient)
    ) {
      return "the cited excerpt does not establish a cash prize for an educator, teacher, or adviser";
    }
    if (outcomeType === "stipend" && !/\bstipend\b/iu.test(text)) {
      return "the cited excerpt does not state a stipend";
    }
    if (outcomeType === "program_seat" && admissionTargetsExternalEntity(text)) {
      return "the cited admission or enrollment targets an external college, university, school, institution, or employer rather than this opportunity";
    }
    if (outcomeType === "project_budget" && !restrictedFunding) {
      return "the cited excerpt does not state restricted project, experiment, build, or venture funding";
    }
    if (outcomeType === "reimbursement" && !/\breimburs(?:e|ed|ement)\b/iu.test(text)) {
      return "the cited excerpt does not state reimbursement";
    }
  }

  if (/locations/u.test(pathText)) {
    const office = /\b(office|headquarters|headquartered|mailing address|contact us|located at)\b/iu.test(text);
    const participation = /\b(participat|attend|held at|takes place|session|event|campus)\b/iu.test(text);
    if (office && !participation) {
      return "an organizer or office address was proposed as a participant stage location";
    }
    const eligibilityGeography =
      /\b(reside|residence|live|attend school|school district|congressional district|eligible|eligibility)\b/iu.test(text);
    if (eligibilityGeography && !PARTICIPATION_LOCATION.test(text.replace(/\battend school\b/giu, ""))) {
      return "eligibility geography was proposed as a participant stage location";
    }
  }

  if (/travelRequirements|locations|timeCommitments|durations/u.test(pathText) && isFinalistOnly(text)) {
    const scope = record && typeof record.scope === "object" && record.scope !== null
      ? record.scope as Record<string, unknown>
      : null;
    const hasStageScope = Array.isArray(scope?.stageIds) && scope.stageIds.length > 0;
    const hasPathwayScope = Array.isArray(scope?.pathwayIds) && scope.pathwayIds.length > 0;
    if (!hasStageScope && !hasPathwayScope) {
      return "a finalist- or winner-only requirement lacked stage or pathway scope";
    }
  }

  if (
    family === "outcomes" &&
    /\.recipientScope$/u.test(pathText) &&
    /\b(teachers?|schools?|educators?|advisers?|advisors?)\b/iu.test(text)
  ) {
    const recipient = typeof value === "string" ? value : null;
    if (recipient !== null && !["school", "organization", "educator"].includes(recipient)) {
      return "the recipient scope conflicts with the teacher or school recipient named in the excerpt";
    }
  }

  if (family === "institutionRelationships" && isPlatformOnly(text)) {
    return "platform-use language cannot establish an opportunity institution relationship";
  }

  if (/requirements/u.test(pathText) && /\b(optional|opt(?:ing)? in|sms|text messages?|account feature)\b/iu.test(text) && !PROGRAM_REQUIREMENT.test(text)) {
    return "an optional platform or communications service was proposed as an opportunity requirement";
  }

  return null;
}
