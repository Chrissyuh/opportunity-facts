import { z } from "zod";

import {
  CLAIM_KINDS,
  EVIDENCE_STATUSES,
  FIELD_DEFINITIONS,
  FIELD_IDS,
  MONEY_CLASSIFICATION_BY_FIELD,
  PAGE_TYPES,
  PARTICIPATION_FORMATS,
  RELATIONSHIP_TYPES,
  REVIEW_STATES,
  SECTIONS,
  type FieldId,
} from "./fields";
import { hasSensitiveUrlQuery, isObviouslyPublicHttpUrl } from "./public-url";
import { SCHEMA_VERSION, V1_SCHEMA_VERSION } from "./schema-version";

export { V1_SCHEMA_VERSION } from "./schema-version";
export const INITIAL_CARD_VERSION = 1 as const;

const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .describe("An RFC 3339 timestamp with an explicit UTC offset.");

const publicHttpUrlSchema = z
  .url()
  .max(2_048)
  .refine(
    (value) => isObviouslyPublicHttpUrl(value) && !hasSensitiveUrlQuery(value),
    "Only public HTTP(S) URLs without credentials, sensitive query tokens, or obvious local/private hosts are allowed.",
  );

export const evidenceStatusSchema = z.enum(EVIDENCE_STATUSES);
export const reviewStateSchema = z.enum(REVIEW_STATES);
const v1ReviewStateSchema = z.enum([
  "demo",
  "draft",
  "human_reviewed",
  "organizer_confirmed",
]);
export const pageTypeSchema = z.enum(PAGE_TYPES);
export const claimKindSchema = z.enum(CLAIM_KINDS);
export const relationshipTypeSchema = z.enum(RELATIONSHIP_TYPES);
export const participationFormatSchema = z.enum(PARTICIPATION_FORMATS);
export const opportunitySectionSchema = z.enum(SECTIONS);
export const fieldIdSchema = z.enum(FIELD_IDS);

export const sourcePageSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  url: publicHttpUrlSchema,
  title: z.string().trim().min(1).max(240),
  pageType: pageTypeSchema,
  accessedAt: isoDateTimeSchema,
});

export const evidenceSourceSchema = sourcePageSchema.extend({
  excerpt: z.string().trim().min(1).max(4_000),
});

export const rawFactValueSchema = z.union([
  z.string().trim().min(1),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().trim().min(1)).min(1),
]);

const normalizedTextSchema = z.strictObject({
  kind: z.literal("text"),
  value: z.string().trim().min(1),
});

const normalizedTextListSchema = z.strictObject({
  kind: z.literal("text_list"),
  values: z.array(z.string().trim().min(1)).min(1),
});

const normalizedDateSchema = z.strictObject({
  kind: z.literal("date"),
  isoDate: z.iso.date(),
});

const normalizedMoneySchema = z.strictObject({
  kind: z.literal("money"),
  amount: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  classification: z.enum(["fee", "deposit", "cash", "in_kind", "tuition_waiver"]),
});

const normalizedNumberSchema = z.strictObject({
  kind: z.literal("number"),
  value: z.number().finite().nonnegative(),
  unit: z.string().trim().min(1).nullable().default(null),
});

const normalizedBooleanSchema = z.strictObject({
  kind: z.literal("boolean"),
  value: z.boolean(),
});

const normalizedPercentageSchema = z.strictObject({
  kind: z.literal("percentage"),
  value: z.number().finite().min(0).max(100),
});

const normalizedDurationSchema = z.strictObject({
  kind: z.literal("duration"),
  amount: z.number().finite().nonnegative(),
  unit: z.enum(["hours", "days", "weeks", "months"]),
});

const normalizedHoursSchema = z.strictObject({
  kind: z.literal("hours"),
  minimum: z.number().finite().nonnegative(),
  maximum: z.number().finite().nonnegative().nullable().default(null),
  period: z.enum(["total", "day", "week"]),
}).superRefine((value, context) => {
  if (value.maximum !== null && value.maximum < value.minimum) {
    context.addIssue({
      code: "custom",
      path: ["maximum"],
      message: "Maximum hours cannot be less than minimum hours.",
    });
  }
});

const normalizedRelationshipSchema = z.strictObject({
  kind: z.literal("relationship"),
  value: relationshipTypeSchema,
});

const normalizedParticipationFormatSchema = z.strictObject({
  kind: z.literal("participation_format"),
  value: participationFormatSchema,
});

export const normalizedValueSchema = z.discriminatedUnion("kind", [
  normalizedTextSchema,
  normalizedTextListSchema,
  normalizedDateSchema,
  normalizedMoneySchema,
  normalizedNumberSchema,
  normalizedBooleanSchema,
  normalizedPercentageSchema,
  normalizedDurationSchema,
  normalizedHoursSchema,
  normalizedRelationshipSchema,
  normalizedParticipationFormatSchema,
]);

export const calculationSchema = z.strictObject({
  formula: z.string().trim().min(1).max(240),
  inputs: z
    .array(
      z.strictObject({
        fieldId: fieldIdSchema,
        value: z.number().finite(),
      }),
    )
    .min(1),
  explanation: z.string().trim().min(1).max(500),
});

export const projectionMetadataSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  rule: z.string().trim().min(1).max(120),
  // An assessed absence is itself a deterministic projection even though it
  // has no positive source claim to reference.
  claimRefs: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160)),
});

export const conflictingValueSchema = z.strictObject({
  value: rawFactValueSchema,
  displayValue: z.string().trim().min(1),
  normalizedValue: normalizedValueSchema.nullable().default(null),
  sources: z.array(evidenceSourceSchema).min(1),
  note: z.string().trim().min(1).max(1_000).nullable().default(null),
});

export const factSchema = z
  .strictObject({
    status: evidenceStatusSchema,
    value: rawFactValueSchema.nullable().default(null),
    displayValue: z.string().trim().min(1).nullable().default(null),
    normalizedValue: normalizedValueSchema.nullable().default(null),
    sources: z.array(evidenceSourceSchema).default([]),
    note: z.string().trim().min(1).max(1_000).nullable().default(null),
    confidence: z.number().finite().min(0).max(1).nullable().default(null),
    claimKind: claimKindSchema.nullable().default(null),
    conflictingValues: z.array(conflictingValueSchema).default([]),
    calculation: calculationSchema.nullable().default(null),
    projection: projectionMetadataSchema.nullable().default(null),
  })
  .superRefine((fact, context) => {
    if (fact.status === "disclosed") {
      if (fact.value === null || fact.displayValue === null) {
        context.addIssue({
          code: "custom",
          message: "A disclosed fact requires both value and displayValue.",
        });
      }
      if (fact.sources.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["sources"],
          message: "A disclosed fact requires at least one evidence source.",
        });
      }
      if (fact.claimKind === null) {
        context.addIssue({
          code: "custom",
          path: ["claimKind"],
          message: "A disclosed fact requires a claim kind.",
        });
      }
    }

    if (fact.status === "conflicting") {
      if (fact.conflictingValues.length < 2) {
        context.addIssue({
          code: "custom",
          path: ["conflictingValues"],
          message: "A conflict must preserve at least two supported values.",
        });
      }
      if (
        fact.value !== null ||
        fact.displayValue !== null ||
        fact.normalizedValue !== null ||
        fact.claimKind !== null ||
        fact.calculation !== null
      ) {
        context.addIssue({
          code: "custom",
          message: "A conflicting fact cannot silently select one top-level value or claim kind.",
        });
      }
      const distinctValues = new Set(
        fact.conflictingValues.map((candidate) => JSON.stringify(candidate.value)),
      );
      if (distinctValues.size !== fact.conflictingValues.length) {
        context.addIssue({
          code: "custom",
          path: ["conflictingValues"],
          message: "Conflicting values must be distinct.",
        });
      }
    } else if (fact.conflictingValues.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["conflictingValues"],
        message: "Only a conflicting fact may contain conflictingValues.",
      });
    }

    if (fact.status === "not_found" || fact.status === "not_applicable") {
      if (
        fact.value !== null ||
        fact.displayValue !== null ||
        fact.normalizedValue !== null ||
        fact.sources.length > 0 ||
        fact.claimKind !== null ||
        fact.calculation !== null
      ) {
        context.addIssue({
          code: "custom",
          message: `${fact.status} facts cannot carry a displayed value or evidence.`,
        });
      }
      if (fact.status === "not_applicable" && fact.note === null) {
        context.addIssue({
          code: "custom",
          path: ["note"],
          message: "A not-applicable fact requires an affirmative reason.",
        });
      }
    }

    if (
      fact.status === "unclear" &&
      (fact.value !== null ||
        fact.displayValue !== null ||
        fact.normalizedValue !== null ||
        fact.calculation !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "An unclear fact cannot present an unresolved statement as a value or calculation.",
      });
    }

    if (fact.claimKind === "calculated" && fact.calculation === null) {
      context.addIssue({
        code: "custom",
        path: ["calculation"],
        message: "A calculated fact requires its formula, inputs, and explanation.",
      });
    }
    if (fact.calculation !== null && fact.claimKind !== "calculated") {
      context.addIssue({
        code: "custom",
        path: ["calculation"],
        message: "Calculation metadata is only valid for a calculated claim.",
      });
    }
    if (fact.calculation !== null) {
      const inputIds = fact.calculation.inputs.map((input) => input.fieldId);
      if (new Set(inputIds).size !== inputIds.length) {
        context.addIssue({
          code: "custom",
          path: ["calculation", "inputs"],
          message: "Calculation inputs must name each field at most once.",
        });
      }
    }
  });

const factShape = Object.fromEntries(
  FIELD_IDS.map((fieldId) => [fieldId, factSchema]),
) as Record<FieldId, typeof factSchema>;

export const opportunityFactsSchema = z.strictObject(factShape);

export const cardConflictSchema = z.strictObject({
  fieldId: fieldIdSchema,
  summary: z.string().trim().min(1).max(500),
});

const NORMALIZED_KIND_FOR_VALUE_TYPE = {
  text: "text",
  text_list: "text_list",
  url: "text",
  date: "date",
  money: "money",
  number: "number",
  boolean: "boolean",
  percentage: "percentage",
  duration: "duration",
  hours: "hours",
  relationship: "relationship",
  participation_format: "participation_format",
} as const;

const CALCULATED_FIELDS = new Set<FieldId>([
  "calculated_acceptance_rate",
  "estimated_total_mandatory_cost",
]);
const MANDATORY_COST_INPUT_FIELDS = new Set<FieldId>([
  "application_fee",
  "deposit",
  "tuition",
  "other_mandatory_costs",
]);

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}

function canonicalMoneyDisplay(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function disclosedNumber(card: { facts: OpportunityFacts }, fieldId: FieldId): number | null {
  const fact = card.facts[fieldId];
  if (fact.status !== "disclosed") return null;
  if (fact.normalizedValue?.kind === "number") return fact.normalizedValue.value;
  return typeof fact.value === "number" ? fact.value : null;
}

function disclosedMoney(card: { facts: OpportunityFacts }, fieldId: FieldId) {
  const fact = card.facts[fieldId];
  return fact.status === "disclosed" && fact.normalizedValue?.kind === "money"
    ? fact.normalizedValue
    : null;
}

export const v1OpportunityCardSchema = z
  .strictObject({
    schemaVersion: z.literal(V1_SCHEMA_VERSION),
    cardVersion: z.number().int().positive(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
    summary: z.string().trim().min(1).max(500),
    reviewState: v1ReviewStateSchema,
    reviewedAt: isoDateTimeSchema.nullable().default(null),
    sourcePagesChecked: z.array(sourcePageSchema).default([]),
    conflicts: z.array(cardConflictSchema).default([]),
    facts: opportunityFactsSchema,
  })
  .superRefine((card, context) => {
    for (const fieldId of FIELD_IDS) {
      if (card.facts[fieldId].projection !== null) {
        context.addIssue({
          code: "custom",
          path: ["facts", fieldId, "projection"],
          message: "Schema v1 facts cannot carry v2 projection metadata.",
        });
      }
    }
    const pagesById = new Map(card.sourcePagesChecked.map((page) => [page.id, page]));
    if (pagesById.size !== card.sourcePagesChecked.length) {
      context.addIssue({
        code: "custom",
        path: ["sourcePagesChecked"],
        message: "Source page IDs must be unique within a card.",
      });
    }
    const pageUrls = card.sourcePagesChecked.flatMap((page) => {
      try {
        const url = new URL(page.url);
        url.hash = "";
        return [url.href];
      } catch {
        return [];
      }
    });
    if (new Set(pageUrls).size !== pageUrls.length) {
      context.addIssue({
        code: "custom",
        path: ["sourcePagesChecked"],
        message: "Each canonical source URL may appear only once; reuse its stable page ID across facts.",
      });
    }

    const conflictIds = new Set(card.conflicts.map((conflict) => conflict.fieldId));
    if (conflictIds.size !== card.conflicts.length) {
      context.addIssue({
        code: "custom",
        path: ["conflicts"],
        message: "A field may appear only once in card-level conflict metadata.",
      });
    }

    for (const definition of FIELD_DEFINITIONS) {
      const fact = card.facts[definition.id];
      if (!definition.allowedStatuses.includes(fact.status)) {
        context.addIssue({
          code: "custom",
          path: ["facts", definition.id, "status"],
          message: `${fact.status} is not allowed for ${definition.id}.`,
        });
      }

      const normalizedValues = [
        fact.normalizedValue,
        ...fact.conflictingValues.map((candidate) => candidate.normalizedValue),
      ].filter((value) => value !== null);
      const expectedKind = NORMALIZED_KIND_FOR_VALUE_TYPE[definition.valueType];
      for (const normalized of normalizedValues) {
        if (normalized.kind !== expectedKind) {
          context.addIssue({
            code: "custom",
            path: ["facts", definition.id, "normalizedValue"],
            message: `${definition.id} expects normalized kind ${expectedKind}, not ${normalized.kind}.`,
          });
        }
        if (normalized.kind === "money") {
          const expectedClassification = MONEY_CLASSIFICATION_BY_FIELD[definition.id as keyof typeof MONEY_CLASSIFICATION_BY_FIELD];
          if (expectedClassification && normalized.classification !== expectedClassification) {
            context.addIssue({
              code: "custom",
              path: ["facts", definition.id, "normalizedValue", "classification"],
              message: `${definition.id} must use money classification ${expectedClassification}, not ${normalized.classification}.`,
            });
          }
        }
      }

      if (fact.claimKind === "calculated" && !CALCULATED_FIELDS.has(definition.id)) {
        context.addIssue({
          code: "custom",
          path: ["facts", definition.id, "claimKind"],
          message: `${definition.id} cannot be published as a calculated claim.`,
        });
      }

      if (
        definition.id === "calculated_acceptance_rate" &&
        fact.status === "disclosed" &&
        fact.claimKind !== "calculated"
      ) {
        context.addIssue({
          code: "custom",
          path: ["facts", definition.id, "claimKind"],
          message: "calculated_acceptance_rate must be a calculated claim with auditable inputs.",
        });
      }

      if (
        definition.id === "acceptance_rate_claim" &&
        fact.status === "disclosed" &&
        fact.claimKind !== "organizer_stated"
      ) {
        context.addIssue({
          code: "custom",
          path: ["facts", definition.id, "claimKind"],
          message: "acceptance_rate_claim is an organizer-stated rate, not an independently calculated rate.",
        });
      }

      if (fact.claimKind === "calculated" && fact.calculation) {
        if (definition.id === "calculated_acceptance_rate") {
          const inputs = new Map(fact.calculation.inputs.map((input) => [input.fieldId, input.value]));
          const applicantCount = disclosedNumber(card, "applicant_count");
          const acceptanceCount = disclosedNumber(card, "acceptance_count");
          const output = fact.normalizedValue?.kind === "percentage" ? fact.normalizedValue.value : null;
          const expectedRate =
            applicantCount !== null && acceptanceCount !== null && applicantCount > 0
              ? Math.round((acceptanceCount / applicantCount) * 10_000) / 100
              : null;
          if (
            inputs.size !== 2 ||
            inputs.get("applicant_count") !== applicantCount ||
            inputs.get("acceptance_count") !== acceptanceCount ||
            output === null ||
            expectedRate === null ||
            acceptanceCount > applicantCount ||
            !approximatelyEqual(output, expectedRate) ||
            typeof fact.value !== "number" ||
            !approximatelyEqual(fact.value, output) ||
            fact.displayValue !== `${output}%`
          ) {
            context.addIssue({
              code: "custom",
              path: ["facts", definition.id, "calculation"],
              message: "Calculated acceptance rate must exactly match the disclosed applicant and acceptance counts.",
            });
          }
        }

        if (definition.id === "estimated_total_mandatory_cost") {
          const output = fact.normalizedValue?.kind === "money" ? fact.normalizedValue : null;
          const inputIds = new Set(fact.calculation.inputs.map((input) => input.fieldId));
          const explanation = fact.calculation.explanation.toLowerCase();
          let calculatedTotal = 0;
          let validInputs =
            fact.calculation.inputs.length > 0 &&
            [...MANDATORY_COST_INPUT_FIELDS].every((fieldId) =>
              ["disclosed", "not_applicable"].includes(card.facts[fieldId].status),
            );
          for (const fieldId of MANDATORY_COST_INPUT_FIELDS) {
            const disclosed = disclosedMoney(card, fieldId);
            if (disclosed === null || approximatelyEqual(disclosed.amount, 0) || inputIds.has(fieldId)) {
              continue;
            }
            const transparentCreditedDeposit =
              fieldId === "deposit" &&
              /deposit/u.test(explanation) &&
              /credited|included|not added twice/u.test(explanation);
            if (!transparentCreditedDeposit) validInputs = false;
          }
          for (const input of fact.calculation.inputs) {
            const sourceMoney = disclosedMoney(card, input.fieldId);
            if (
              !MANDATORY_COST_INPUT_FIELDS.has(input.fieldId) ||
              sourceMoney === null ||
              output === null ||
              sourceMoney.currency !== output.currency ||
              !approximatelyEqual(sourceMoney.amount, input.value)
            ) {
              validInputs = false;
            }
            calculatedTotal += input.value;
          }
          if (
            output === null ||
            !validInputs ||
            !approximatelyEqual(output.amount, calculatedTotal) ||
            typeof fact.value !== "number" ||
            !approximatelyEqual(fact.value, output.amount) ||
            fact.displayValue !== canonicalMoneyDisplay(output.amount, output.currency)
          ) {
            context.addIssue({
              code: "custom",
              path: ["facts", definition.id, "calculation"],
              message: "Calculated mandatory cost requires every cost category to be assessed and every nonzero disclosed input to be included, except a transparently credited deposit.",
            });
          }
        }
      }

      if (definition.valueType === "url") {
        const urlValues =
          fact.status === "conflicting"
            ? fact.conflictingValues.map((candidate) => candidate.value)
            : fact.value === null
              ? []
              : [fact.value];
        if (urlValues.some((value) => !publicHttpUrlSchema.safeParse(value).success)) {
          context.addIssue({
            code: "custom",
            path: ["facts", definition.id, "value"],
            message: "URL facts require a valid HTTP(S) URL value.",
          });
        }
      }

      const allSources = [
        ...fact.sources,
        ...fact.conflictingValues.flatMap((candidate) => candidate.sources),
      ];
      for (const source of allSources) {
        const page = pagesById.get(source.id);
        if (!page) {
          context.addIssue({
            code: "custom",
            path: ["facts", definition.id, "sources"],
            message: `Evidence source ${source.id} is missing from sourcePagesChecked.`,
          });
          continue;
        }
        if (
          page.url !== source.url ||
          page.title !== source.title ||
          page.pageType !== source.pageType ||
          page.accessedAt !== source.accessedAt
        ) {
          context.addIssue({
            code: "custom",
            path: ["facts", definition.id, "sources"],
            message: `Evidence source ${source.id} does not match its checked-page metadata.`,
          });
        }
      }

      if (fact.status === "conflicting" && !conflictIds.has(definition.id)) {
        context.addIssue({
          code: "custom",
          path: ["conflicts"],
          message: `Conflict metadata is required for ${definition.id}.`,
        });
      }
      if (fact.status !== "conflicting" && conflictIds.has(definition.id)) {
        context.addIssue({
          code: "custom",
          path: ["conflicts"],
          message: `Conflict metadata for ${definition.id} has no conflicting fact.`,
        });
      }
    }

    if (
      (card.reviewState === "human_reviewed" ||
        card.reviewState === "organizer_confirmed") &&
      card.reviewedAt === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["reviewedAt"],
        message: `${card.reviewState} cards require a reviewedAt timestamp.`,
      });
    }
    if (
      (card.reviewState === "human_reviewed" ||
        card.reviewState === "organizer_confirmed") &&
      card.sourcePagesChecked.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourcePagesChecked"],
        message: `${card.reviewState} cards require at least one checked source page.`,
      });
    }

    if (card.reviewState === "demo") {
      const allUrls = card.sourcePagesChecked.map((source) => source.url);
      const officialUrlFact = card.facts.official_url;
      if (officialUrlFact.status === "conflicting") {
        allUrls.push(
          ...officialUrlFact.conflictingValues.flatMap((candidate) =>
            typeof candidate.value === "string" ? [candidate.value] : []
          ),
        );
      } else if (typeof officialUrlFact.value === "string") {
        allUrls.push(officialUrlFact.value);
      }
      if (allUrls.some((value) => !new URL(value).hostname.endsWith(".example"))) {
        context.addIssue({
          code: "custom",
          message: "Demo cards may cite only reserved .example hostnames.",
        });
      }
    }
  });

export type SourcePage = z.infer<typeof sourcePageSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type RawFactValue = z.infer<typeof rawFactValueSchema>;
export type NormalizedValue = z.infer<typeof normalizedValueSchema>;
export type Calculation = z.infer<typeof calculationSchema>;
export type ProjectionMetadata = z.infer<typeof projectionMetadataSchema>;
export type ConflictingValue = z.infer<typeof conflictingValueSchema>;
export type Fact = z.infer<typeof factSchema>;
export type OpportunityFacts = z.infer<typeof opportunityFactsSchema>;
export type CardConflict = z.infer<typeof cardConflictSchema>;
export type V1OpportunityCard = z.infer<typeof v1OpportunityCardSchema>;

export function createEmptyFact(): Fact;
export function createEmptyFact(status: "not_found"): Fact;
export function createEmptyFact(status: "not_applicable", reason: string): Fact;
export function createEmptyFact(
  status: "not_found" | "not_applicable" = "not_found",
  reason?: string,
): Fact {
  return factSchema.parse({
    status,
    note: status === "not_applicable" ? reason : null,
  });
}

export function createEmptyFacts(): OpportunityFacts {
  return opportunityFactsSchema.parse(
    Object.fromEntries(FIELD_IDS.map((fieldId) => [fieldId, { status: "not_found" }])),
  );
}

export interface CreateCardOptions {
  slug: string;
  summary?: string;
  reviewState?: "demo" | "draft";
}

export function createEmptyV1Card({
  slug,
  summary = "Card in progress. Source-backed details have not been added yet.",
  reviewState = "draft",
}: CreateCardOptions): V1OpportunityCard {
  return v1OpportunityCardSchema.parse({
    schemaVersion: V1_SCHEMA_VERSION,
    cardVersion: INITIAL_CARD_VERSION,
    slug,
    summary,
    reviewState,
    reviewedAt: null,
    sourcePagesChecked: [],
    conflicts: [],
    facts: Object.fromEntries(FIELD_IDS.map((fieldId) => [fieldId, { status: "not_found" }])),
  });
}
