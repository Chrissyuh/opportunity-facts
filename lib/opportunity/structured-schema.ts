import { z } from "zod";

import { PARTICIPATION_FORMATS } from "./fields";
import { evidenceSourceSchema } from "./schema-v1";

export const ENTITY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const entityIdSchema = z.string().regex(ENTITY_ID_PATTERN).max(160);
export const claimIdSchema = entityIdSchema;

export const ORGANIZATION_ROLES = [
  "operator",
  "manager",
  "administrator",
  "sponsor",
  "funder",
  "host",
  "academic_partner",
  "platform_provider",
  "other",
] as const;

export const INSTITUTION_RELATIONSHIP_TYPES = [
  "institution_operated",
  "institution_sponsored",
  "institution_partnered",
  "hosted_at_institution",
  "credit_partnership",
  "founders_affiliated_with",
  "mentors_affiliated_with",
  "staff_affiliated_with",
  "independent",
  "unclear",
  "other",
] as const;

export const ORGANIZATION_KINDS = [
  "government_agency",
  "private_company",
  "education_provider",
  "higher_education_institution",
  "institution_unit",
] as const;

export const VARIANT_KINDS = ["cohort", "tier", "track"] as const;

export const STAGE_KINDS = [
  "application",
  "interview",
  "proposal_review",
  "semifinal",
  "pitch",
  "finalist",
  "build_period",
  "summit_final",
  "winner_selection",
  "matching",
  "program",
  "flight",
  "other",
] as const;

export const STAGE_EVENT_KINDS = [
  "opens",
  "deadline",
  "starts",
  "ends",
  "decision",
  "notification",
] as const;

export const CYCLE_STATUSES = [
  "announced",
  "applications_open",
  "applications_closed",
  "active",
  "complete",
] as const;

export const COST_KINDS = [
  "application_fee",
  "deposit",
  "tuition",
  "travel",
  "lodging",
  "meals",
  "materials",
  "other",
] as const;

export const COST_REQUIREMENTS = ["required", "optional", "conditional"] as const;
export const CHARGE_BASES = [
  "per_application",
  "per_participant",
  "per_team",
  "per_traveler",
] as const;

export const OUTCOME_TYPES = [
  "personal_cash_prize",
  "team_cash_prize",
  "educator_cash_prize",
  "stipend",
  "project_budget",
  "reimbursement",
  "tuition_waiver",
  "scholarship",
  "program_seat",
  "travel_support",
  "mentorship",
  "flight_or_experiment_opportunity",
  "certificate",
  "college_credit",
  "equipment",
  "other_in_kind",
  "other",
] as const;

export const RECIPIENT_SCOPES = [
  "individual",
  "team",
  "project",
  "school",
  "organization",
  "educator",
] as const;

export const MONETARY_NATURES = [
  "cash",
  "restricted_funding",
  "reimbursement",
  "source_stated_estimated_value",
  "not_monetized",
] as const;

export const sourceClaimKindSchema = z.enum(["source_stated", "organizer_stated"]);
const nullableNoteSchema = z.string().trim().min(1).max(1_000).nullable().default(null);

export function typedClaimSchema<T extends z.ZodType>(valueSchema: T) {
  const candidateSchema = z.strictObject({
    value: valueSchema,
    displayValue: z.string().trim().min(1).max(1_000),
    claimKind: sourceClaimKindSchema,
    sources: z.array(evidenceSourceSchema).min(1),
    note: nullableNoteSchema,
  });

  return z.discriminatedUnion("status", [
    z.strictObject({
      claimId: claimIdSchema,
      status: z.literal("disclosed"),
      value: valueSchema,
      displayValue: z.string().trim().min(1).max(1_000),
      claimKind: sourceClaimKindSchema,
      sources: z.array(evidenceSourceSchema).min(1),
      note: nullableNoteSchema,
      conflictingValues: z.array(candidateSchema).max(0).default([]),
    }),
    z.strictObject({
      claimId: claimIdSchema,
      status: z.literal("unclear"),
      value: z.null(),
      displayValue: z.null(),
      claimKind: z.null(),
      sources: z.array(evidenceSourceSchema).min(1),
      note: z.string().trim().min(1).max(1_000),
      conflictingValues: z.array(candidateSchema).max(0).default([]),
    }),
    z.strictObject({
      claimId: claimIdSchema,
      status: z.literal("not_found"),
      value: z.null(),
      displayValue: z.null(),
      claimKind: z.null(),
      sources: z.array(evidenceSourceSchema).max(0).default([]),
      note: z.string().trim().min(1).max(1_000),
      conflictingValues: z.array(candidateSchema).max(0).default([]),
    }),
    z.strictObject({
      claimId: claimIdSchema,
      status: z.literal("not_applicable"),
      value: z.null(),
      displayValue: z.null(),
      claimKind: z.null(),
      sources: z.array(evidenceSourceSchema).max(0).default([]),
      note: z.string().trim().min(1).max(1_000),
      conflictingValues: z.array(candidateSchema).max(0).default([]),
    }),
    z
      .strictObject({
        claimId: claimIdSchema,
        status: z.literal("conflicting"),
        value: z.null(),
        displayValue: z.null(),
        claimKind: z.null(),
        sources: z.array(evidenceSourceSchema).max(0).default([]),
        note: z.string().trim().min(1).max(1_000),
        conflictingValues: z.array(candidateSchema).min(2),
      })
      .superRefine((claim, context) => {
        const values = claim.conflictingValues.map((candidate) =>
          JSON.stringify((candidate as { value: unknown }).value),
        );
        if (new Set(values).size !== values.length) {
          context.addIssue({
            code: "custom",
            path: ["conflictingValues"],
            message: "Conflicting structured values must be distinct.",
          });
        }
      }),
  ]);
}

export function assertionSchema<T extends z.ZodType>(valueSchema: T) {
  // Assertions cannot be conflicting, but the model-facing schema still needs
  // a concrete item shape. `z.never()` serializes as JSON Schema `not`, which
  // strict OpenAI Structured Outputs rejects before making a request. A typed
  // candidate array capped at zero preserves the exact runtime invariant
  // without emitting unsupported schema keywords.
  const impossibleCandidateSchema = z.strictObject({
    value: valueSchema,
    displayValue: z.string().trim().min(1).max(1_000),
    claimKind: sourceClaimKindSchema,
    sources: z.array(evidenceSourceSchema).min(1),
    note: nullableNoteSchema,
  });

  return z.strictObject({
    claimId: claimIdSchema,
    status: z.literal("disclosed"),
    value: valueSchema,
    displayValue: z.string().trim().min(1).max(1_000),
    claimKind: sourceClaimKindSchema,
    sources: z.array(evidenceSourceSchema).min(1),
    note: nullableNoteSchema,
    conflictingValues: z.array(impossibleCandidateSchema).max(0).default([]),
  });
}

export const scopeSchema = z.strictObject({
  variantIds: z.array(entityIdSchema).default([]),
  stageIds: z.array(entityIdSchema).default([]),
  pathwayIds: z.array(entityIdSchema).default([]),
});

export const scopeClaimSchema = assertionSchema(
  z.strictObject({
    scope: scopeSchema,
    condition: z.string().trim().min(1).max(1_000).nullable().default(null),
  }),
);

export function recordCollectionSchema<T extends z.ZodType>(recordSchema: T) {
  return z.discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("unassessed"),
      records: z.array(recordSchema).max(0).default([]),
      note: z.null().default(null),
    }),
    z.strictObject({
      status: z.literal("modeled"),
      records: z.array(recordSchema).min(1),
      note: nullableNoteSchema,
    }),
    z.strictObject({
      status: z.literal("none_found"),
      records: z.array(recordSchema).max(0).default([]),
      note: z.string().trim().min(1).max(1_000),
    }),
    z.strictObject({
      status: z.literal("not_applicable"),
      records: z.array(recordSchema).max(0).default([]),
      note: z.string().trim().min(1).max(1_000),
    }),
  ]);
}

export const temporalValueSchema = z.discriminatedUnion("precision", [
  z.strictObject({
    precision: z.literal("month"),
    year: z.number().int().min(1900).max(2200),
    month: z.number().int().min(1).max(12),
    certainty: z.enum(["stated", "expected"]),
  }),
  z.strictObject({
    precision: z.literal("date"),
    date: z.iso.date(),
    certainty: z.enum(["stated", "expected"]),
  }),
  z.strictObject({
    precision: z.literal("date_time"),
    dateTime: z.string().datetime({ offset: true }),
    certainty: z.enum(["stated", "expected"]),
  }),
]);

export const durationValueSchema = z
  .strictObject({
    minimum: z.number().finite().nonnegative(),
    maximum: z.number().finite().nonnegative().nullable().default(null),
    unit: z.enum(["hours", "days", "weeks", "months"]),
  })
  .superRefine((duration, context) => {
    if (duration.maximum !== null && duration.maximum < duration.minimum) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "A duration maximum cannot be less than its minimum.",
      });
    }
  });

export const moneyValueSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("exact"),
    amount: z.number().finite().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  z
    .strictObject({
      kind: z.literal("range"),
      minimum: z.number().finite().nonnegative(),
      maximum: z.number().finite().nonnegative(),
      currency: z.string().regex(/^[A-Z]{3}$/),
    })
    .superRefine((range, context) => {
      if (range.maximum < range.minimum) {
        context.addIssue({
          code: "custom",
          path: ["maximum"],
          message: "A money range maximum cannot be less than its minimum.",
        });
      }
    }),
]);

export const cycleRecordSchema = z.strictObject({
  id: entityIdSchema,
  label: assertionSchema(z.string().trim().min(1).max(160)),
  status: typedClaimSchema(z.enum(CYCLE_STATUSES)),
  year: typedClaimSchema(z.number().int().min(1900).max(2200)).nullable().default(null),
  startYear: typedClaimSchema(z.number().int().min(1900).max(2200)).nullable().default(null),
  endYear: typedClaimSchema(z.number().int().min(1900).max(2200)).nullable().default(null),
  season: typedClaimSchema(z.enum(["winter", "spring", "summer", "fall"])).nullable().default(null),
  cycleType: typedClaimSchema(
    z.enum(["academic_year", "calendar_year", "seasonal", "competition_cycle", "cohort", "rolling", "current", "other"]),
  ),
  timingRefs: z.strictObject({
    opens: claimIdSchema.nullable().default(null),
    closes: claimIdSchema.nullable().default(null),
    coverageStart: claimIdSchema.nullable().default(null),
    coverageEnd: claimIdSchema.nullable().default(null),
  }),
});

export const organizationRecordSchema = z.strictObject({
  id: entityIdSchema,
  name: assertionSchema(z.string().trim().min(1).max(240)),
  kind: typedClaimSchema(z.enum(ORGANIZATION_KINDS)),
});

export const organizationRoleRecordSchema = z.strictObject({
  id: entityIdSchema,
  organizationId: entityIdSchema,
  role: assertionSchema(
    z.strictObject({
      role: z.enum(ORGANIZATION_ROLES),
      roleLabel: z.string().trim().min(1).max(160).nullable().default(null),
      scope: scopeSchema,
    }),
  ),
});

export const institutionRelationshipRecordSchema = z.strictObject({
  id: entityIdSchema,
  assertion: typedClaimSchema(
    z.strictObject({
      subject: z.enum(["opportunity", "founders", "mentors", "staff"]),
      subjectOrganizationId: entityIdSchema.nullable().default(null),
      targetOrganizationId: entityIdSchema.nullable().default(null),
      targetInstitutionName: z.string().trim().min(1).max(240).nullable().default(null),
      relationshipType: z.enum(INSTITUTION_RELATIONSHIP_TYPES),
      description: z.string().trim().min(1).max(1_000),
      scope: scopeSchema,
    }),
  ),
});

export const variantRecordSchema = z.strictObject({
  id: entityIdSchema,
  definition: assertionSchema(
    z.strictObject({
      label: z.string().trim().min(1).max(240),
      kind: z.enum(VARIANT_KINDS),
      parentVariantId: entityIdSchema.nullable().default(null),
    }),
  ),
  eligibilityDifferences: z
    .array(typedClaimSchema(z.string().trim().min(1).max(1_000)))
    .default([]),
  notes: z.array(assertionSchema(z.string().trim().min(1).max(1_000))).default([]),
});

export const stageTimingClaimSchema = typedClaimSchema(
  z.strictObject({
    event: z.enum(STAGE_EVENT_KINDS),
    when: temporalValueSchema,
    scope: scopeSchema,
  }),
);

export const stageRecordSchema = z.strictObject({
  id: entityIdSchema,
  order: z.number().int().positive(),
  definition: assertionSchema(
    z.strictObject({
      label: z.string().trim().min(1).max(240),
      kind: z.enum(STAGE_KINDS),
      scope: scopeSchema,
    }),
  ),
  timings: z.array(stageTimingClaimSchema).default([]),
  durations: z.array(typedClaimSchema(z.strictObject({ duration: durationValueSchema, scope: scopeSchema }))).default([]),
  timeCommitments: z.array(typedClaimSchema(z.strictObject({
    minimumHours: z.number().finite().nonnegative(),
    maximumHours: z.number().finite().nonnegative().nullable().default(null),
    period: z.enum(["total", "day", "week"]),
    label: z.string().trim().min(1).max(160),
    scope: scopeSchema,
  }).superRefine((commitment, context) => {
    if (commitment.maximumHours !== null && commitment.maximumHours < commitment.minimumHours) {
      context.addIssue({ code: "custom", path: ["maximumHours"], message: "Maximum hours cannot be less than minimum hours." });
    }
  }))).default([]),
  formats: z.array(typedClaimSchema(z.strictObject({ formats: z.array(z.enum(PARTICIPATION_FORMATS)).min(1), scope: scopeSchema }))).default([]),
  locations: z.array(typedClaimSchema(z.strictObject({ location: z.string().trim().min(1).max(500), scope: scopeSchema }))).default([]),
  selectionRules: z.array(typedClaimSchema(z.strictObject({ rule: z.string().trim().min(1).max(1_000), scope: scopeSchema }))).default([]),
  advancement: z.array(typedClaimSchema(z.strictObject({ count: z.number().int().positive().nullable().default(null), description: z.string().trim().min(1).max(500), scope: scopeSchema }))).default([]),
  requirements: z.array(assertionSchema(z.strictObject({ requirement: z.string().trim().min(1).max(500), scope: scopeSchema }))).default([]),
  travelRequirements: z.array(typedClaimSchema(z.strictObject({ requirement: z.enum(["none", "conditional", "required"]), scope: scopeSchema }))).default([]),
});

export const pathwayStepSchema = assertionSchema(
  z.strictObject({
    stageId: entityIdSchema,
    enterWhen: z.string().trim().min(1).max(500).nullable().default(null),
  }),
);

export const pathwayRecordSchema = z.strictObject({
  id: entityIdSchema,
  definition: assertionSchema(
    z.strictObject({
      label: z.string().trim().min(1).max(240),
      variantIds: z.array(entityIdSchema).default([]),
    }),
  ),
  steps: z.array(pathwayStepSchema).min(1),
});

export const costItemRecordSchema = z.strictObject({
  id: entityIdSchema,
  definition: assertionSchema(
    z.strictObject({
      label: z.string().trim().min(1).max(240),
      kind: z.enum(COST_KINDS),
      requirement: z.enum(COST_REQUIREMENTS),
      scope: scopeSchema,
    }),
  ),
  amount: typedClaimSchema(moneyValueSchema),
  chargeBasis: typedClaimSchema(z.enum(CHARGE_BASES)).nullable().default(null),
  treatment: typedClaimSchema(
    z.strictObject({
      kind: z.literal("credited_to_tuition"),
      targetCostItemIds: z.array(entityIdSchema).min(1),
    }),
  ).nullable().default(null),
  refundability: typedClaimSchema(
    z.strictObject({
      kind: z.enum(["refundable", "nonrefundable", "conditional"]),
      condition: z.string().trim().min(1).max(1_000).nullable().default(null),
    }),
  ).nullable().default(null),
  includedItems: z.array(assertionSchema(z.string().trim().min(1).max(500))).default([]),
  excludedItems: z.array(assertionSchema(z.string().trim().min(1).max(500))).default([]),
  conditions: z.array(assertionSchema(z.string().trim().min(1).max(500))).default([]),
});

// A modeled list can still be incomplete: the reviewer may have established
// several prices without establishing that no other mandatory charge exists.
// Totals are permitted only from a complete reviewed inventory.
export const costItemCollectionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("unassessed"),
    records: z.array(costItemRecordSchema).max(0).default([]),
    note: z.null().default(null),
  }),
  z.strictObject({
    status: z.literal("modeled"),
    records: z.array(costItemRecordSchema).min(1),
    note: nullableNoteSchema,
    completeness: z.enum(["complete", "incomplete"]).default("incomplete"),
  }),
  z.strictObject({
    status: z.literal("none_found"),
    records: z.array(costItemRecordSchema).max(0).default([]),
    note: z.string().trim().min(1).max(1_000),
  }),
  z.strictObject({
    status: z.literal("not_applicable"),
    records: z.array(costItemRecordSchema).max(0).default([]),
    note: z.string().trim().min(1).max(1_000),
  }),
]);

export const distributionValueSchema = z.strictObject({
  payee: z.enum(["participant", "team", "educator", "school", "registered_venture", "service_provider"]),
  method: z.enum(["direct", "equal_split", "shared"]),
  condition: z.string().trim().min(1).max(1_000).nullable().default(null),
});

export const outcomeRecordSchema = z.strictObject({
  id: entityIdSchema,
  definition: assertionSchema(
    z.strictObject({
      label: z.string().trim().min(1).max(320),
      outcomeType: z.enum(OUTCOME_TYPES),
      scope: scopeSchema,
    }),
  ),
  recipientScope: typedClaimSchema(z.enum(RECIPIENT_SCOPES)),
  monetaryNature: typedClaimSchema(z.enum(MONETARY_NATURES)).nullable().default(null),
  amount: typedClaimSchema(moneyValueSchema).nullable().default(null),
  distribution: typedClaimSchema(z.array(distributionValueSchema).min(1)).nullable().default(null),
  rank: typedClaimSchema(z.strictObject({ ordinal: z.number().int().positive().nullable().default(null), label: z.string().trim().min(1).max(160) })).nullable().default(null),
  track: typedClaimSchema(z.string().trim().min(1).max(240)).nullable().default(null),
  quantity: typedClaimSchema(z.strictObject({ minimum: z.number().finite().nonnegative(), maximum: z.number().finite().nonnegative().nullable().default(null), unit: z.enum(["sessions", "credits", "seats", "flights", "items"]) })).nullable().default(null),
  useRestriction: typedClaimSchema(z.string().trim().min(1).max(1_000)).nullable().default(null),
  combinability: typedClaimSchema(z.enum(["combinable", "exclusive"])).nullable().default(null),
  conditions: z.array(assertionSchema(z.string().trim().min(1).max(500))).default([]),
});

export const cycleContainerSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("unassessed"), value: z.null() }),
  z.strictObject({ status: z.literal("modeled"), value: cycleRecordSchema }),
]);

export type TypedClaim<T> = z.infer<ReturnType<typeof typedClaimSchema<z.ZodType<T>>>>;
export type Scope = z.infer<typeof scopeSchema>;
export type CycleRecord = z.infer<typeof cycleRecordSchema>;
export type OrganizationRecord = z.infer<typeof organizationRecordSchema>;
export type OrganizationRoleRecord = z.infer<typeof organizationRoleRecordSchema>;
export type InstitutionRelationshipRecord = z.infer<typeof institutionRelationshipRecordSchema>;
export type VariantRecord = z.infer<typeof variantRecordSchema>;
export type StageRecord = z.infer<typeof stageRecordSchema>;
export type PathwayRecord = z.infer<typeof pathwayRecordSchema>;
export type CostItemRecord = z.infer<typeof costItemRecordSchema>;
export type OutcomeRecord = z.infer<typeof outcomeRecordSchema>;
