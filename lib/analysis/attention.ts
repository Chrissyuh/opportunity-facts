import { z } from "zod";
import { FIELD_IDS, type FieldId } from "@/lib/opportunity/fields";
import { FIELD_REGISTRY_BY_ID } from "@/lib/opportunity/registry";
import type { EvidenceSource, OpportunityCard } from "@/lib/opportunity/schema";

export const ATTENTION_CATEGORIES = [
  "cost",
  "deadline",
  "eligibility",
  "organization_relationship",
  "selection",
  "outcome",
  "refund",
  "source_coverage",
  "cycle",
  "other",
] as const;
export type AttentionCategory = (typeof ATTENTION_CATEGORIES)[number];
export type AttentionPriority = "high" | "medium" | "low";

export const modelAttentionCandidateSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  category: z.enum(ATTENTION_CATEGORIES),
  priority: z.enum(["high", "medium", "low"]),
  title: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(700),
  fieldIds: z.array(z.enum(FIELD_IDS)).max(12),
  claimIds: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100)).max(20),
}).superRefine((value, context) => {
  if (value.fieldIds.length === 0 && value.claimIds.length === 0) {
    context.addIssue({ code: "custom", path: ["fieldIds"], message: "Attention candidates need at least one fact or structured-claim reference." });
  }
});

export type ModelAttentionCandidate = z.infer<typeof modelAttentionCandidateSchema>;

export interface AttentionItem {
  readonly id: string;
  readonly category: AttentionCategory;
  readonly priority: AttentionPriority;
  readonly title: string;
  readonly explanation: string;
  readonly fieldIds: readonly FieldId[];
  readonly claimIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly suggestedNextStep: string | null;
  readonly origin: "model_grounded" | "deterministic_fallback";
}

interface ClaimIndexEntry {
  readonly sources: readonly EvidenceSource[];
  readonly text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectClaimIndex(value: unknown, result = new Map<string, ClaimIndexEntry>()): Map<string, ClaimIndexEntry> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectClaimIndex(item, result));
    return result;
  }
  if (!isRecord(value)) return result;
  if (typeof value.claimId === "string" && value.status === "disclosed" && Array.isArray(value.sources)) {
    const sources = value.sources.filter((source): source is EvidenceSource =>
      isRecord(source) && typeof source.id === "string" && typeof source.excerpt === "string",
    );
    result.set(value.claimId, {
      sources,
      text: [JSON.stringify(value.value ?? ""), ...sources.map((source) => source.excerpt)].join(" "),
    });
  }
  Object.entries(value).forEach(([key, child]) => {
    if (key !== "sources" && key !== "conflictingValues") collectClaimIndex(child, result);
  });
  return result;
}

const CONCRETE_TOKEN = /(?:[$€£]\s*\d[\d,.]*|\b\d+(?:\.\d+)?%|\b20\d{2}\b|https?:\/\/\S+)/giu;
const PROPER_NOUN_TOKEN = /\b(?:[A-Z][a-z]{2,}|[A-Z]{2,})\b/gu;
const COMMON_CAPITALIZED_WORDS = new Set([
  "A", "An", "Application", "Award", "Check", "Cost", "Deadline", "Financial",
  "Institution", "Numerical", "Official", "Opportunity", "Program", "Refund",
  "Selection", "Source", "The", "This", "Total", "Verify",
]);

function explanationHasUnsupportedConcreteToken(explanation: string, basis: string): boolean {
  const normalizedBasis = basis.toLowerCase().replaceAll(",", "");
  return [...explanation.matchAll(CONCRETE_TOKEN)].some((match) =>
    !normalizedBasis.includes(match[0].toLowerCase().replaceAll(",", "")),
  );
}

function textHasUnsupportedProperNoun(text: string, basis: string): boolean {
  const normalizedBasis = basis.toLowerCase();
  return [...text.matchAll(PROPER_NOUN_TOKEN)].some((match) =>
    !COMMON_CAPITALIZED_WORDS.has(match[0]) && !normalizedBasis.includes(match[0].toLowerCase()),
  );
}

const PRIORITY_ORDER: Record<AttentionPriority, number> = { high: 0, medium: 1, low: 2 };
const CATEGORY_ORDER: Record<AttentionCategory, number> = {
  cost: 0,
  deadline: 1,
  eligibility: 2,
  organization_relationship: 3,
  selection: 4,
  outcome: 5,
  refund: 6,
  source_coverage: 7,
  cycle: 8,
  other: 9,
};

function deterministicPriority(category: AttentionCategory, requested: AttentionPriority): AttentionPriority {
  if (["cost", "deadline", "eligibility", "organization_relationship"].includes(category)) return "high";
  if (requested === "high" && ["selection", "outcome", "refund", "source_coverage"].includes(category)) return "high";
  return requested;
}

function fallback(
  id: string,
  category: AttentionCategory,
  priority: AttentionPriority,
  title: string,
  explanation: string,
  fieldIds: readonly FieldId[],
  suggestedNextStep: string | null,
): AttentionItem {
  return { id, category, priority, title, explanation, fieldIds, claimIds: [], sourceIds: [], suggestedNextStep, origin: "deterministic_fallback" };
}

const SELECTIVITY_CONTEXT = /\b(selective|selection|review(?:ed|ing)?|interview|finalist|semifinal|rank(?:ed|ing)?|advance(?:ment|s|d)?|limited (?:seats?|spots?|places?)|accepted cohort|chosen|competitive)\b/iu;

function hasMaterialSelectivityContext(card: OpportunityCard): boolean {
  const selectionFacts = [
    card.facts.selection_process,
    card.facts.selection_evidence,
  ];
  if (selectionFacts.some((fact) => {
    if (fact.status !== "disclosed" && fact.status !== "conflicting") return false;
    const text = [
      fact.displayValue ?? "",
      fact.note ?? "",
      ...fact.sources.map((source) => source.excerpt),
      ...fact.conflictingValues.flatMap((value) => [value.displayValue, ...value.sources.map((source) => source.excerpt)]),
    ].join(" ");
    return SELECTIVITY_CONTEXT.test(text);
  })) return true;
  if (card.stages.status !== "modeled") return false;
  return card.stages.records.some((stage) => {
    const text = JSON.stringify(stage);
    return SELECTIVITY_CONTEXT.test(text);
  });
}

export function deriveDeterministicAttention(card: OpportunityCard): AttentionItem[] {
  const items: AttentionItem[] = [];
  const fact = (fieldId: FieldId) => card.facts[fieldId];
  if (fact("estimated_total_mandatory_cost").status === "unclear" ||
      (["disclosed", "conflicting"].includes(fact("tuition").status) &&
        fact("estimated_total_mandatory_cost").status === "not_found") ||
      (card.costItems.status === "modeled" && card.costItems.completeness === "incomplete")) {
    items.push(fallback(
      "mandatory-cost-incomplete",
      "cost",
      "high",
      "Total mandatory cost cannot be established",
      "The retained cost record is incomplete or does not support one universal mandatory total. A listed tuition or fee should not be treated as the complete price.",
      ["estimated_total_mandatory_cost", "tuition", "other_mandatory_costs"],
      "Check the official cost, travel, housing, materials, and deposit pages before budgeting.",
    ));
  }
  if (fact("application_deadline").status === "conflicting") {
    items.push(fallback(
      "deadline-conflict",
      "deadline",
      "high",
      "Application deadlines conflict",
      "The retained official evidence supports more than one incompatible deadline, so Opportunity Facts did not select one silently.",
      ["application_deadline"],
      "Confirm the deadline for your exact cycle, cohort, or pathway with the organizer.",
    ));
  } else if (["not_found", "unclear"].includes(fact("application_deadline").status)) {
    items.push(fallback(
      "deadline-unresolved",
      "deadline",
      "high",
      "Application deadline is unresolved",
      "The reviewed material did not establish one applicable application deadline.",
      ["application_deadline"],
      "Check the current application or schedule page for your exact cycle.",
    ));
  }
  if (["not_found", "unclear"].includes(fact("refund_policy").status) &&
      ["disclosed", "conflicting"].includes(fact("tuition").status)) {
    items.push(fallback(
      "refund-unresolved",
      "refund",
      "high",
      "Refund terms were not established",
      "The sources support a tuition or mandatory fee, but the retained record does not establish the applicable refund terms.",
      ["refund_policy", "tuition"],
      "Read the enrollment, cancellation, and payment terms before paying.",
    ));
  }
  if (["not_found", "unclear"].includes(fact("institution_relationship").status) && fact("named_institution").status === "disclosed") {
    items.push(fallback(
      "institution-relationship-unresolved",
      "organization_relationship",
      "high",
      "Institution relationship is unclear",
      "An institution is named, but the retained evidence does not establish one precise operating, sponsoring, hosting, credit, or affiliation relationship.",
      ["named_institution", "institution_relationship"],
      "Check whether the institution itself describes the relationship.",
    ));
  }
  if (["not_found", "unclear"].includes(fact("applicant_count").status) &&
      ["not_found", "unclear"].includes(fact("acceptance_count").status) &&
      ["not_found", "unclear"].includes(fact("acceptance_rate_claim").status) &&
      hasMaterialSelectivityContext(card)) {
    items.push(fallback(
      "selectivity-not-quantified",
      "selection",
      "medium",
      "Numerical selectivity data was not found",
      "The retained record does not contain current-cycle applicant totals, acceptance totals, or a published acceptance rate. This does not establish whether the opportunity is or is not selective.",
      ["applicant_count", "acceptance_count", "acceptance_rate_claim"],
      null,
    ));
  }
  if (card.cycle.status !== "modeled" && ["disclosed", "conflicting"].includes(fact("application_deadline").status)) {
    items.push(fallback(
      "cycle-unresolved",
      "cycle",
      "high",
      "Applicable cycle is unclear",
      "A date is present, but the retained structured record does not establish one unambiguous target cycle.",
      ["application_deadline"],
      "Verify that the date applies to the cycle you intend to enter.",
    ));
  }
  return items;
}

export function groundAttentionCandidates(
  card: OpportunityCard,
  candidates: readonly ModelAttentionCandidate[],
): readonly AttentionItem[] {
  const claimIndex = collectClaimIndex(card);
  const grounded = candidates.flatMap((candidate): AttentionItem[] => {
    const fields = candidate.fieldIds.filter((fieldId) => {
      const status = card.facts[fieldId].status;
      return status !== "not_applicable";
    });
    const claims = candidate.claimIds.filter((claimId) => claimIndex.has(claimId));
    if (fields.length === 0 && claims.length === 0) return [];
    const fieldBasis = fields.flatMap((fieldId) => {
      const value = card.facts[fieldId];
      return [JSON.stringify(value.value ?? ""), value.note ?? "", ...value.sources.map((source) => source.excerpt)];
    });
    const claimBasis = claims.flatMap((claimId) => [claimIndex.get(claimId)?.text ?? ""]);
    const basis = [...fieldBasis, ...claimBasis].join(" ");
    if (
      explanationHasUnsupportedConcreteToken(candidate.explanation, basis) ||
      textHasUnsupportedProperNoun(`${candidate.title} ${candidate.explanation}`, basis)
    ) return [];
    const sourceIds = new Set<string>();
    fields.forEach((fieldId) => card.facts[fieldId].sources.forEach((source) => sourceIds.add(source.id)));
    claims.forEach((claimId) => claimIndex.get(claimId)?.sources.forEach((source) => sourceIds.add(source.id)));
    return [{
      id: candidate.id,
      category: candidate.category,
      priority: deterministicPriority(candidate.category, candidate.priority),
      title: candidate.title,
      explanation: candidate.explanation,
      fieldIds: fields,
      claimIds: claims,
      sourceIds: [...sourceIds],
      suggestedNextStep: null,
      origin: "model_grounded",
    }];
  });
  const deduplicated = new Map<string, AttentionItem>();
  for (const item of [...grounded, ...deriveDeterministicAttention(card)]) {
    const key = `${item.category}:${[...item.fieldIds].sort().join(",")}:${[...item.claimIds].sort().join(",")}`;
    if (!deduplicated.has(key)) deduplicated.set(key, item);
  }
  return [...deduplicated.values()].sort((left, right) =>
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category],
  );
}

export function evidenceForAttentionItem(
  card: OpportunityCard,
  item: Pick<AttentionItem, "fieldIds" | "claimIds">,
): EvidenceSource[] {
  const claimIndex = collectClaimIndex(card);
  const evidence = [
    ...item.fieldIds.flatMap((fieldId) => card.facts[fieldId].sources),
    ...item.claimIds.flatMap((claimId) => claimIndex.get(claimId)?.sources ?? []),
  ];
  const unique = new Map<string, EvidenceSource>();
  for (const source of evidence) {
    const key = `${source.id}\n${source.url}\n${source.excerpt}`;
    if (!unique.has(key)) unique.set(key, source);
  }
  return [...unique.values()];
}

export function attentionFieldLabel(fieldId: FieldId): string {
  return FIELD_REGISTRY_BY_ID[fieldId].label;
}
