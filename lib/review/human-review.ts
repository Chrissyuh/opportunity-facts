import { z } from "zod";

import { canonicalJson, sha256Hex } from "@/lib/opportunity/canonical";
import {
  FIELD_DEFINITIONS,
  SECTIONS,
  type FieldId,
  type OpportunitySection,
} from "@/lib/opportunity/fields";
import type {
  EvidenceSource,
  Fact,
  OpportunityCard,
  SourcePage,
} from "@/lib/opportunity/schema";

export const HUMAN_REVIEW_FORMAT_VERSION = "1.0.0" as const;
export const HUMAN_REVIEW_CONFIRMATION =
  "I personally checked this card against its cited sources.";

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const reviewItemIdSchema = z.string().trim().min(1).max(240);

export const humanReviewPacketSchema = z.strictObject({
  kind: z.literal("human_review_packet"),
  formatVersion: z.literal(HUMAN_REVIEW_FORMAT_VERSION),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  opportunityId: z.string().trim().min(1),
  schemaVersion: z.string().trim().min(1),
  reviewedCardVersion: z.number().int().positive(),
  targetCardVersion: z.number().int().positive(),
  reviewedContentSha256: digestSchema,
  manifestSha256: digestSchema,
  completedItemIds: z.array(reviewItemIdSchema),
  reviewer: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(2_000).nullable(),
  preparedAt: z.string().datetime({ offset: true }),
  reviewerConfirmedReview: z.literal(true),
});

export const humanReviewAttestationSchema = z.strictObject({
  kind: z.literal("human_review_attestation"),
  formatVersion: z.literal(HUMAN_REVIEW_FORMAT_VERSION),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  opportunityId: z.string().trim().min(1),
  schemaVersion: z.string().trim().min(1),
  cardVersion: z.number().int().positive(),
  reviewedContentSha256: digestSchema,
  manifestSha256: digestSchema,
  completedItemIds: z.array(reviewItemIdSchema),
  reviewer: z.string().trim().min(1).max(120),
  reviewedAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(2_000).nullable(),
  explicitHumanConfirmation: z.literal(true),
  confirmationText: z.literal(HUMAN_REVIEW_CONFIRMATION),
});

export type HumanReviewPacket = z.infer<typeof humanReviewPacketSchema>;
export type HumanReviewAttestation = z.infer<typeof humanReviewAttestationSchema>;

export interface HumanReviewEvidence {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly pageType: string;
  readonly accessedAt: string;
  readonly excerpt: string | null;
}

export interface HumanReviewItem {
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly value: string;
  readonly note: string | null;
  readonly evidence: readonly HumanReviewEvidence[];
}

export interface HumanReviewSection {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly items: readonly HumanReviewItem[];
}

export interface HumanReviewManifest {
  readonly slug: string;
  readonly title: string;
  readonly opportunityId: string;
  readonly schemaVersion: string;
  readonly reviewedCardVersion: number;
  readonly targetCardVersion: number;
  readonly reviewedContentSha256: string;
  readonly manifestSha256: string;
  readonly sections: readonly HumanReviewSection[];
  readonly expectedItemIds: readonly string[];
}

type ClaimLike = {
  claimId: string;
  status: string;
  displayValue: string | null;
  note: string | null;
  sources: EvidenceSource[];
  conflictingValues: Array<{
    displayValue: string;
    note: string | null;
    sources: EvidenceSource[];
  }>;
};

const sectionLabels: Record<OpportunitySection, string> = {
  identity: "Identity",
  eligibility: "Eligibility",
  commitment: "Dates and commitment",
  money: "Costs and financial aid",
  selection: "Selection",
  outcomes: "Outcomes",
  terms: "Terms and data use",
};

const structuredLabels: Record<string, string> = {
  cycle: "Cycle",
  organizations: "Organizations",
  organizationRoles: "Organization roles",
  institutionRelationships: "Institution relationships",
  variants: "Variants and cohorts",
  stages: "Stages",
  pathways: "Pathways",
  costItems: "Structured costs",
  outcomes: "Structured outcomes",
};

const finalChecks: ReadonlyArray<[string, string]> = [
  ["cycle-scope", "Cycle and historical/current scope are correct"],
  ["relationships", "Operator, institution, and person affiliations are not conflated"],
  ["cost-scope", "Costs, aid, and refund statements preserve conditions and scope"],
  ["outcome-scope", "Outcome recipients and cash, in-kind, waiver, and project funding types are distinct"],
  ["selection-scope", "Selection counts and claims use the correct cycle and population"],
  ["source-to-card", "Every retained source excerpt supports the attached claim"],
  ["card-to-source", "Important disclosed information in the checked sources is represented or noted"],
  ["non-verdict", "The record makes no legitimacy, prestige, value, or recommendation claim"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClaimLike(value: unknown): value is ClaimLike {
  return isRecord(value) &&
    typeof value.claimId === "string" &&
    typeof value.status === "string" &&
    (typeof value.displayValue === "string" || value.displayValue === null) &&
    (typeof value.note === "string" || value.note === null) &&
    Array.isArray(value.sources) &&
    Array.isArray(value.conflictingValues);
}

function words(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function evidence(source: EvidenceSource): HumanReviewEvidence {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    pageType: words(source.pageType),
    accessedAt: source.accessedAt,
    excerpt: source.excerpt,
  };
}

function sourceEvidence(source: SourcePage): HumanReviewEvidence {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    pageType: words(source.pageType),
    accessedAt: source.accessedAt,
    excerpt: null,
  };
}

function factEvidence(fact: Fact): HumanReviewEvidence[] {
  return [
    ...fact.sources.map(evidence),
    ...fact.conflictingValues.flatMap((candidate) => candidate.sources.map(evidence)),
  ];
}

function factValue(fact: Fact): string {
  if (fact.status === "conflicting") {
    return fact.conflictingValues.map((candidate) => candidate.displayValue).join(" / ");
  }
  if (fact.displayValue !== null) return fact.displayValue;
  if (fact.note !== null) return fact.note;
  return words(fact.status);
}

function recordLabel(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  for (const key of ["definition", "name", "label", "assertion"]) {
    const candidate = value[key];
    if (!isRecord(candidate)) continue;
    if (typeof candidate.displayValue === "string") return candidate.displayValue;
    if (isRecord(candidate.value)) {
      for (const nested of ["label", "name", "role", "relationshipType", "kind", "outcomeType"]) {
        if (typeof candidate.value[nested] === "string") return words(candidate.value[nested]);
      }
    }
  }
  return fallback;
}

function collectClaimItems(
  value: unknown,
  path: readonly string[],
  labelPrefix: string,
): HumanReviewItem[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const itemLabel = recordLabel(item, `${labelPrefix} ${index + 1}`);
      return collectClaimItems(item, [...path, String(index)], itemLabel);
    });
  }
  if (!isRecord(value)) return [];
  if (isClaimLike(value)) {
    const leaf = path.at(-1);
    const label = leaf === undefined || /^\d+$/u.test(leaf)
      ? labelPrefix
      : `${labelPrefix} - ${words(leaf)}`;
    const conflictingEvidence = value.conflictingValues.flatMap((candidate) =>
      candidate.sources.map(evidence),
    );
    const displayed = value.status === "conflicting"
      ? value.conflictingValues.map((candidate) => candidate.displayValue).join(" / ")
      : value.displayValue ?? value.note ?? words(value.status);
    return [{
      id: `claim:${value.claimId}`,
      label,
      status: value.status,
      value: displayed,
      note: value.note,
      evidence: [...value.sources.map(evidence), ...conflictingEvidence],
    }];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    key === "sources" || key === "conflictingValues"
      ? []
      : collectClaimItems(child, [...path, key], labelPrefix),
  );
}

function structuredSection(
  key: keyof Pick<OpportunityCard,
    | "cycle"
    | "organizations"
    | "organizationRoles"
    | "institutionRelationships"
    | "variants"
    | "stages"
    | "pathways"
    | "costItems"
    | "outcomes">,
  value: unknown,
): HumanReviewSection {
  return {
    id: `structured-${key}`,
    label: structuredLabels[key],
    description: "Check each atomic structured claim, its scope, and its attached evidence.",
    items: collectClaimItems(value, [key], structuredLabels[key]),
  };
}

function reviewedContent(card: OpportunityCard): unknown {
  return Object.fromEntries(
    Object.entries(card).filter(([key]) =>
      key !== "cardVersion" && key !== "reviewedAt" && key !== "reviewState"
    ),
  );
}

export function humanReviewContentDigest(card: OpportunityCard): string {
  return sha256Hex(canonicalJson(reviewedContent(card)));
}

export function buildHumanReviewManifest(card: OpportunityCard): HumanReviewManifest {
  if (card.opportunityId === null) {
    throw new Error("A human review packet requires a cycle-independent opportunity ID.");
  }

  const sourceSection: HumanReviewSection = {
    id: "source-inventory",
    label: "Source inventory",
    description: "Open every page and confirm its identity, cycle relevance, and role in the review.",
    items: card.sourcePagesChecked.map((source) => ({
      id: `source:${source.id}`,
      label: source.title,
      status: words(source.pageType),
      value: source.url,
      note: null,
      evidence: [sourceEvidence(source)],
    })),
  };

  const factSections = SECTIONS.map((section): HumanReviewSection => ({
    id: `facts-${section}`,
    label: sectionLabels[section],
    description: "Check the displayed value or uncertainty state against every attached excerpt and source page.",
    items: FIELD_DEFINITIONS
      .filter((field) => field.section === section)
      .map((field) => {
        const fact = card.facts[field.id as FieldId];
        return {
          id: `fact:${field.id}`,
          label: field.label,
          status: fact.status,
          value: factValue(fact),
          note: fact.note,
          evidence: factEvidence(fact),
        };
      }),
  }));

  const structuredSections = ([
    "cycle",
    "organizations",
    "organizationRoles",
    "institutionRelationships",
    "variants",
    "stages",
    "pathways",
    "costItems",
    "outcomes",
  ] as const).map((key) => structuredSection(key, card[key]));

  const finalSection: HumanReviewSection = {
    id: "final-sign-off",
    label: "Final sign-off",
    description: "Complete these cross-record checks only after reviewing the sources, facts, and structured claims above.",
    items: finalChecks.map(([id, label]) => ({
      id: `final:${id}`,
      label,
      status: "required",
      value: "Human confirmation required",
      note: null,
      evidence: [],
    })),
  };

  const sections = [sourceSection, ...factSections, ...structuredSections, finalSection];
  const expectedItemIds = sections.flatMap((section) => section.items.map((item) => item.id));
  if (new Set(expectedItemIds).size !== expectedItemIds.length) {
    throw new Error("The human review manifest contains duplicate checklist item IDs.");
  }
  const manifestSha256 = sha256Hex(canonicalJson(
    sections.map((section) => ({
      id: section.id,
      itemIds: section.items.map((item) => item.id),
    })),
  ));

  return {
    slug: card.slug,
    title: card.facts.opportunity_name.displayValue ?? card.slug,
    opportunityId: card.opportunityId,
    schemaVersion: card.schemaVersion,
    reviewedCardVersion: card.cardVersion,
    targetCardVersion: card.cardVersion + 1,
    reviewedContentSha256: humanReviewContentDigest(card),
    manifestSha256,
    sections,
    expectedItemIds,
  };
}

function requireCompleteItemSet(
  completedItemIds: readonly string[],
  expectedItemIds: readonly string[],
): void {
  const completed = new Set(completedItemIds);
  if (completed.size !== completedItemIds.length) {
    throw new Error("A human review record cannot contain duplicate checklist items.");
  }
  const missing = expectedItemIds.filter((id) => !completed.has(id));
  const unexpected = completedItemIds.filter((id) => !expectedItemIds.includes(id));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `The human review checklist does not match this card (${missing.length} missing, ${unexpected.length} unexpected).`,
    );
  }
}

export function validateHumanReviewPacket(
  card: OpportunityCard,
  input: unknown,
): HumanReviewPacket {
  const packet = humanReviewPacketSchema.parse(input);
  const manifest = buildHumanReviewManifest(card);
  if (card.reviewState !== "ai_audited") {
    throw new Error("Only an AI-audited repository card can enter this human-review promotion workflow.");
  }
  if (
    packet.slug !== manifest.slug ||
    packet.opportunityId !== manifest.opportunityId ||
    packet.schemaVersion !== manifest.schemaVersion ||
    packet.reviewedCardVersion !== manifest.reviewedCardVersion ||
    packet.targetCardVersion !== manifest.targetCardVersion ||
    packet.reviewedContentSha256 !== manifest.reviewedContentSha256 ||
    packet.manifestSha256 !== manifest.manifestSha256
  ) {
    throw new Error("The review packet is stale or belongs to a different card revision.");
  }
  requireCompleteItemSet(packet.completedItemIds, manifest.expectedItemIds);
  return packet;
}

export function createHumanReviewAttestation(
  card: OpportunityCard,
  input: unknown,
  options: {
    isInteractiveHuman: boolean;
    confirmationText: string;
    reviewedAt: string;
  },
): HumanReviewAttestation {
  if (!options.isInteractiveHuman || options.confirmationText !== HUMAN_REVIEW_CONFIRMATION) {
    throw new Error("Human review promotion requires an explicit confirmation entered by a person.");
  }
  const packet = validateHumanReviewPacket(card, input);
  return humanReviewAttestationSchema.parse({
    kind: "human_review_attestation",
    formatVersion: HUMAN_REVIEW_FORMAT_VERSION,
    slug: packet.slug,
    opportunityId: packet.opportunityId,
    schemaVersion: packet.schemaVersion,
    cardVersion: packet.targetCardVersion,
    reviewedContentSha256: packet.reviewedContentSha256,
    manifestSha256: packet.manifestSha256,
    completedItemIds: packet.completedItemIds,
    reviewer: packet.reviewer,
    reviewedAt: options.reviewedAt,
    notes: packet.notes,
    explicitHumanConfirmation: true,
    confirmationText: options.confirmationText,
  });
}

export function promoteCardWithHumanReview(
  card: OpportunityCard,
  attestationInput: unknown,
): OpportunityCard {
  const attestation = humanReviewAttestationSchema.parse(attestationInput);
  const manifest = buildHumanReviewManifest(card);
  if (card.reviewState !== "ai_audited") {
    throw new Error("Only an AI-audited repository card can be promoted to Human reviewed.");
  }
  if (
    attestation.slug !== card.slug ||
    attestation.opportunityId !== card.opportunityId ||
    attestation.schemaVersion !== card.schemaVersion ||
    attestation.cardVersion !== manifest.targetCardVersion ||
    attestation.reviewedContentSha256 !== manifest.reviewedContentSha256 ||
    attestation.manifestSha256 !== manifest.manifestSha256
  ) {
    throw new Error("The human review attestation is stale or belongs to a different card revision.");
  }
  requireCompleteItemSet(attestation.completedItemIds, manifest.expectedItemIds);
  return {
    ...card,
    cardVersion: attestation.cardVersion,
    reviewState: "human_reviewed",
    reviewedAt: attestation.reviewedAt,
  };
}

export function validateHumanReviewAttestation(
  card: OpportunityCard,
  input: unknown,
): HumanReviewAttestation {
  const attestation = humanReviewAttestationSchema.parse(input);
  if (card.reviewState !== "human_reviewed") {
    throw new Error("A Human reviewed attestation cannot be active on a card in another review state.");
  }
  const prePromotionCard: OpportunityCard = {
    ...card,
    cardVersion: card.cardVersion - 1,
    reviewState: "ai_audited",
    reviewedAt: null,
  };
  const manifest = buildHumanReviewManifest(prePromotionCard);
  if (
    attestation.slug !== card.slug ||
    attestation.opportunityId !== card.opportunityId ||
    attestation.schemaVersion !== card.schemaVersion ||
    attestation.cardVersion !== card.cardVersion ||
    attestation.reviewedAt !== card.reviewedAt ||
    attestation.reviewedContentSha256 !== humanReviewContentDigest(card) ||
    attestation.manifestSha256 !== manifest.manifestSha256
  ) {
    throw new Error("The Human reviewed attestation is stale for this card content or revision.");
  }
  requireCompleteItemSet(attestation.completedItemIds, manifest.expectedItemIds);
  return attestation;
}

export function isHumanReviewWorkspaceEnabled(environment: {
  NODE_ENV?: string;
  HUMAN_REVIEW_WORKSPACE_ENABLED?: string;
}): boolean {
  return environment.NODE_ENV !== "production" &&
    environment.HUMAN_REVIEW_WORKSPACE_ENABLED === "true";
}
