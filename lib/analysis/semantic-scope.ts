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
    const attendance = /\b(participat|attend|held at|takes place|session|event|campus|online|virtual|remote)\b/iu.test(text);
    if (office && !attendance) return false;
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
  }

  if (["travel_requirements", "location", "duration", "required_live_hours", "weekly_hours"].includes(fieldId)) {
    if (isFinalistOnly(text) && !/\bapplicants? who (?:advance|are selected)|if selected\b/iu.test(text)) {
      return false;
    }
  }

  if (["cancellation_policy", "material_terms", "sponsor_requirement"].includes(fieldId)) {
    const optionalService =
      /\b(optional|opt(?:ing)? in|text messages?|sms|notifications?|account feature)\b/iu.test(text) &&
      !PROGRAM_REQUIREMENT.test(text);
    if (optionalService) return false;
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
  if (sources.length === 0 || sources.every((source) => sourceSupportsField(fieldId, source))) {
    return { supported: true, reason: null };
  }

  const reasons: Partial<Record<FieldId, string>> = {
    ages: "The cited age language governs a platform, account, website, or legal service rather than opportunity eligibility.",
    geographic_restrictions: "The cited geography language governs legal/service availability rather than participant eligibility.",
    citizenship_restrictions: "The cited jurisdiction language does not establish participant citizenship or residency eligibility.",
    sponsor_requirement: "The cited adult language governs account or service supervision rather than an opportunity adult/adviser requirement.",
    location: "The cited place is an organizer, office, or stage-specific location rather than a universal participant location.",
    travel_requirements: "The cited travel language applies only to a later recipient group or stage, not every applicant or participant.",
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

  if (/locations/u.test(pathText)) {
    const office = /\b(office|headquarters|headquartered|mailing address|contact us|located at)\b/iu.test(text);
    const participation = /\b(participat|attend|held at|takes place|session|event|campus)\b/iu.test(text);
    if (office && !participation) {
      return "an organizer or office address was proposed as a participant stage location";
    }
  }

  if (/travelRequirements|locations|timeCommitments|durations/u.test(pathText) && isFinalistOnly(text)) {
    const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
    const scope = record && typeof record.scope === "object" && record.scope !== null
      ? record.scope as Record<string, unknown>
      : null;
    const hasStageScope = Array.isArray(scope?.stageIds) && scope.stageIds.length > 0;
    const hasPathwayScope = Array.isArray(scope?.pathwayIds) && scope.pathwayIds.length > 0;
    if (!hasStageScope && !hasPathwayScope) {
      return "a finalist- or winner-only requirement lacked stage or pathway scope";
    }
  }

  if (family === "outcomes" && /\b(teachers?|schools?|educators?)\b/iu.test(text)) {
    const recipient = typeof value === "string" ? value : null;
    if (recipient !== null && !["school", "organization"].includes(recipient)) {
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
