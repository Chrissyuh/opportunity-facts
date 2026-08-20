import { z } from "zod";

import { FIELD_IDS } from "./fields";
import { getProjectionDrift } from "./projection";
import {
  INITIAL_CARD_VERSION,
  V1_SCHEMA_VERSION,
  cardConflictSchema,
  createEmptyFacts,
  fieldIdSchema,
  opportunityFactsSchema,
  reviewStateSchema,
  sourcePageSchema,
  v1OpportunityCardSchema,
  type CreateCardOptions,
  type EvidenceSource,
} from "./schema-v1";
import {
  costItemCollectionSchema,
  cycleContainerSchema,
  entityIdSchema,
  institutionRelationshipRecordSchema,
  organizationRecordSchema,
  organizationRoleRecordSchema,
  outcomeRecordSchema,
  pathwayRecordSchema,
  recordCollectionSchema,
  stageRecordSchema,
  variantRecordSchema,
  type CostItemRecord,
  type CycleRecord,
  type InstitutionRelationshipRecord,
  type OrganizationRecord,
  type OrganizationRoleRecord,
  type OutcomeRecord,
  type PathwayRecord,
  type Scope,
  type StageRecord,
  type VariantRecord,
} from "./structured-schema";
import { SCHEMA_VERSION } from "./schema-version";

export { SCHEMA_VERSION } from "./schema-version";

export const migrationMetadataSchema = z.strictObject({
  schemaVersion: z.literal(V1_SCHEMA_VERSION),
  cardVersion: z.number().int().positive(),
  reviewedAt: z.string().datetime({ offset: true }).nullable(),
  cardSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const projectionRefsSchema = z
  .partialRecord(
    fieldIdSchema,
    z.array(entityIdSchema),
  )
  .default({});

export const opportunityCardProjectionInputSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  opportunityId: entityIdSchema.nullable(),
  cycle: cycleContainerSchema,
  cardVersion: z.number().int().positive(),
  slug: entityIdSchema.max(100),
  summary: z.string().trim().min(1).max(500),
  reviewState: reviewStateSchema,
  reviewedAt: z.string().datetime({ offset: true }).nullable(),
  sourcePagesChecked: z.array(sourcePageSchema).default([]),
  conflicts: z.array(cardConflictSchema).default([]),
  organizations: recordCollectionSchema(organizationRecordSchema),
  organizationRoles: recordCollectionSchema(organizationRoleRecordSchema),
  institutionRelationships: recordCollectionSchema(institutionRelationshipRecordSchema),
  variants: recordCollectionSchema(variantRecordSchema),
  stages: recordCollectionSchema(stageRecordSchema),
  pathways: recordCollectionSchema(pathwayRecordSchema),
  costItems: costItemCollectionSchema,
  outcomes: recordCollectionSchema(outcomeRecordSchema),
  facts: opportunityFactsSchema,
  projectionRefs: projectionRefsSchema,
  migratedFrom: migrationMetadataSchema.nullable(),
});

type ClaimLike = {
  claimId: string;
  status: string;
  sources: EvidenceSource[];
  conflictingValues: Array<{ sources: EvidenceSource[] }>;
};

interface ClaimLocation {
  claim: ClaimLike;
  path: (string | number)[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectClaims(value: unknown, path: (string | number)[] = []): ClaimLocation[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectClaims(item, [...path, index]));
  }
  if (!isRecord(value)) return [];
  const ownClaim =
    typeof value.claimId === "string" &&
    typeof value.status === "string" &&
    Array.isArray(value.sources) &&
    Array.isArray(value.conflictingValues)
      ? [{ claim: value as unknown as ClaimLike, path }]
      : [];
  return [
    ...ownClaim,
    ...Object.entries(value).flatMap(([key, child]) =>
      key === "sources" || key === "conflictingValues"
        ? []
        : collectClaims(child, [...path, key]),
    ),
  ];
}

function claimSources(claim: ClaimLike): EvidenceSource[] {
  return [
    ...claim.sources,
    ...claim.conflictingValues.flatMap((candidate) => candidate.sources),
  ];
}

function sourceMetadata(source: EvidenceSource) {
  return {
    id: source.id,
    url: source.url,
    title: source.title,
    pageType: source.pageType,
    accessedAt: source.accessedAt,
  };
}

function modeledRecords<T>(collection: { status: string; records: T[] }): T[] {
  return collection.status === "modeled" ? collection.records : [];
}

function addIssue(
  context: z.RefinementCtx,
  path: (string | number)[],
  message: string,
) {
  context.addIssue({ code: "custom", path, message });
}

function validateScope(
  scope: Scope,
  variants: Set<string>,
  stages: Set<string>,
  pathways: Set<string>,
  context: z.RefinementCtx,
  path: (string | number)[],
) {
  const dimensions: Array<[keyof Scope, Set<string>]> = [
    ["variantIds", variants],
    ["stageIds", stages],
    ["pathwayIds", pathways],
  ];
  for (const [key, allowed] of dimensions) {
    if (new Set(scope[key]).size !== scope[key].length) {
      addIssue(context, [...path, key], "Scope IDs must be unique within each dimension.");
    }
    scope[key].forEach((id, index) => {
      if (!allowed.has(id)) {
        addIssue(context, [...path, key, index], `Scope references unknown ${key.replace("Ids", "")} ${id}.`);
      }
    });
  }
}

function collectScopes(value: unknown, path: (string | number)[] = []): Array<{ scope: Scope; path: (string | number)[] }> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectScopes(item, [...path, index]));
  }
  if (!isRecord(value)) return [];
  const scopeCandidate = value.scope;
  const ownScope = isRecord(scopeCandidate) &&
      Array.isArray(scopeCandidate.variantIds) &&
      Array.isArray(scopeCandidate.stageIds) &&
      Array.isArray(scopeCandidate.pathwayIds)
    ? [{ scope: scopeCandidate as unknown as Scope, path: [...path, "scope"] }]
    : [];
  return [
    ...ownScope,
    ...Object.entries(value).flatMap(([key, child]) =>
      key === "scope" ? [] : collectScopes(child, [...path, key]),
    ),
  ];
}

function stripFactProjection(facts: z.infer<typeof opportunityFactsSchema>) {
  return Object.fromEntries(
    FIELD_IDS.map((fieldId) => [
      fieldId,
      { ...facts[fieldId], projection: null },
    ]),
  );
}

export const opportunityCardSchema = opportunityCardProjectionInputSchema.superRefine(
  (card, context) => {
    const legacyFactsValidation = v1OpportunityCardSchema.safeParse({
      schemaVersion: V1_SCHEMA_VERSION,
      cardVersion: card.cardVersion,
      slug: card.slug,
      summary: card.summary,
      reviewState: card.reviewState,
      reviewedAt: card.reviewedAt,
      sourcePagesChecked: card.sourcePagesChecked,
      conflicts: card.conflicts,
      facts: stripFactProjection(card.facts),
    });
    if (!legacyFactsValidation.success) {
      for (const issue of legacyFactsValidation.error.issues) {
        const isStructuredCostTotalCompatibilityIssue =
          issue.path[0] === "facts" &&
          issue.path[1] === "estimated_total_mandatory_cost" &&
          issue.path[2] === "calculation" &&
          card.costItems.status === "modeled" &&
          card.costItems.completeness === "complete" &&
          ["costs.total-exact", "costs.total-range"].includes(
            card.facts.estimated_total_mandatory_cost.projection?.rule ?? "",
          );

        // V1 calculations required all four scalar cost categories to be
        // disclosed or marked not applicable. A complete V2 inventory is the
        // authoritative input set, so absent categories must not be fabricated
        // as not-applicable facts merely to satisfy the legacy cross-field rule.
        // Projection drift validation below proves that the stored total still
        // exactly matches the structured items and their evidence.
        if (isStructuredCostTotalCompatibilityIssue) continue;

        addIssue(
          context,
          issue.path.filter((part): part is string | number => typeof part !== "symbol"),
          issue.message,
        );
      }
    }

    const isAttested = card.reviewState === "human_reviewed" || card.reviewState === "organizer_confirmed";
    if (isAttested) {
      if (card.opportunityId === null) {
        addIssue(context, ["opportunityId"], "A reviewed v2 card requires a cycle-independent opportunity ID.");
      }
      if (card.cycle.status !== "modeled") {
        addIssue(context, ["cycle"], "A reviewed v2 card requires a modeled cycle.");
      }
      const requiredCollections = [
        ["organizations", card.organizations],
        ["organizationRoles", card.organizationRoles],
        ["institutionRelationships", card.institutionRelationships],
        ["variants", card.variants],
        ["stages", card.stages],
        ["pathways", card.pathways],
        ["costItems", card.costItems],
        ["outcomes", card.outcomes],
      ] as const;
      for (const [key, collection] of requiredCollections) {
        if (collection.status === "unassessed") {
          addIssue(context, [key], `A reviewed v2 card cannot leave ${key} unassessed.`);
        }
      }
    }

    const collections = [
      ...modeledRecords(card.organizations),
      ...modeledRecords(card.organizationRoles),
      ...modeledRecords(card.institutionRelationships),
      ...modeledRecords(card.variants),
      ...modeledRecords(card.stages),
      ...modeledRecords(card.pathways),
      ...modeledRecords(card.costItems),
      ...modeledRecords(card.outcomes),
    ];
    const recordIds = [
      ...(card.cycle.status === "modeled" ? [card.cycle.value.id] : []),
      ...collections.map((record) => record.id),
    ];
    if (new Set(recordIds).size !== recordIds.length) {
      addIssue(context, [], "Structured record IDs must be globally unique within a card.");
    }

    const structuredRoot = {
      cycle: card.cycle,
      organizations: card.organizations,
      organizationRoles: card.organizationRoles,
      institutionRelationships: card.institutionRelationships,
      variants: card.variants,
      stages: card.stages,
      pathways: card.pathways,
      costItems: card.costItems,
      outcomes: card.outcomes,
    };
    const claims = collectClaims(structuredRoot);
    const claimIds = claims.map(({ claim }) => claim.claimId);
    if (new Set(claimIds).size !== claimIds.length) {
      addIssue(context, [], "Structured claim IDs must be globally unique within a card.");
    }

    const pagesById = new Map(card.sourcePagesChecked.map((page) => [page.id, page]));
    for (const { claim, path } of claims) {
      for (const [sourceIndex, source] of claimSources(claim).entries()) {
        const page = pagesById.get(source.id);
        if (page === undefined) {
          addIssue(context, [...path, "sources", sourceIndex], `Claim evidence references unknown page ${source.id}.`);
        } else if (JSON.stringify(page) !== JSON.stringify(sourceMetadata(source))) {
          addIssue(context, [...path, "sources", sourceIndex], `Claim evidence metadata must match checked page ${source.id}.`);
        }
      }
    }

    const organizations = modeledRecords(card.organizations);
    const roles = modeledRecords(card.organizationRoles);
    const relationships = modeledRecords(card.institutionRelationships);
    const variants = modeledRecords(card.variants);
    const stages = modeledRecords(card.stages);
    const pathways = modeledRecords(card.pathways);
    const costs = modeledRecords(card.costItems);
    const outcomes = modeledRecords(card.outcomes);
    const organizationIds = new Set(organizations.map((record) => record.id));
    const variantIds = new Set(variants.map((record) => record.id));
    const stageIds = new Set(stages.map((record) => record.id));
    const pathwayIds = new Set(pathways.map((record) => record.id));
    const costIds = new Set(costs.map((record) => record.id));

    roles.forEach((role, index) => {
      if (!organizationIds.has(role.organizationId)) {
        addIssue(context, ["organizationRoles", "records", index, "organizationId"], "Organization roles must reference a known organization.");
      }
    });
    relationships.forEach((relationship, index) => {
      if (relationship.assertion.status !== "disclosed") return;
      const expectedSubject = {
        founders_affiliated_with: "founders",
        mentors_affiliated_with: "mentors",
        staff_affiliated_with: "staff",
      } as const;
      const relationshipType = relationship.assertion.value.relationshipType;
      const requiredSubject = expectedSubject[relationshipType as keyof typeof expectedSubject];
      if (requiredSubject !== undefined && relationship.assertion.value.subject !== requiredSubject) {
        addIssue(
          context,
          ["institutionRelationships", "records", index, "assertion", "value", "subject"],
          `${relationshipType} requires subject ${requiredSubject}; a person affiliation cannot be represented as an opportunity-level institutional relationship.`,
        );
      }
      const subjectAffiliationType = {
        founders: "founders_affiliated_with",
        mentors: "mentors_affiliated_with",
        staff: "staff_affiliated_with",
      } as const;
      const subject = relationship.assertion.value.subject;
      const allowedAffiliationType = subjectAffiliationType[subject as keyof typeof subjectAffiliationType];
      if (
        allowedAffiliationType !== undefined &&
        relationshipType !== allowedAffiliationType &&
        relationshipType !== "unclear" &&
        relationshipType !== "other"
      ) {
        addIssue(
          context,
          ["institutionRelationships", "records", index, "assertion", "value", "relationshipType"],
          `${subject} can only carry ${allowedAffiliationType}, unclear, or other; a person affiliation cannot be upgraded to an institutional relationship.`,
        );
      }
      for (const [key, id] of [
        ["subjectOrganizationId", relationship.assertion.value.subjectOrganizationId],
        ["targetOrganizationId", relationship.assertion.value.targetOrganizationId],
      ] as const) {
        if (id !== null && !organizationIds.has(id)) {
          addIssue(context, ["institutionRelationships", "records", index, "assertion", "value", key], "Institution relationships must reference a known organization.");
        }
      }
      if (
        relationship.assertion.value.relationshipType !== "independent" &&
        relationship.assertion.value.targetOrganizationId === null &&
        relationship.assertion.value.targetInstitutionName === null
      ) {
        addIssue(context, ["institutionRelationships", "records", index, "assertion", "value"], "A non-independent relationship must identify its target institution.");
      }
    });
    variants.forEach((variant, index) => {
      const parent = variant.definition.value.parentVariantId;
      if (parent !== null && !variantIds.has(parent)) {
        addIssue(context, ["variants", "records", index, "definition", "value", "parentVariantId"], "A parent variant must exist in the same card.");
      }
    });
    pathways.forEach((pathway, index) => {
      const steps = pathway.steps.map((step) => step.value.stageId);
      if (new Set(steps).size !== steps.length) {
        addIssue(context, ["pathways", "records", index, "steps"], "A pathway cannot repeat the same stage.");
      }
      steps.forEach((stageId, stepIndex) => {
        if (!stageIds.has(stageId)) {
          addIssue(context, ["pathways", "records", index, "steps", stepIndex], "Pathway steps must reference a known stage.");
        }
      });
      pathway.definition.value.variantIds.forEach((variantId, variantIndex) => {
        if (!variantIds.has(variantId)) {
          addIssue(context, ["pathways", "records", index, "definition", "value", "variantIds", variantIndex], "Pathway variants must exist in the same card.");
        }
      });
    });
    costs.forEach((cost, index) => {
      if (cost.treatment?.status === "disclosed") {
        cost.treatment.value.targetCostItemIds.forEach((target, targetIndex) => {
          if (!costIds.has(target) || target === cost.id) {
            addIssue(context, ["costItems", "records", index, "treatment", "value", "targetCostItemIds", targetIndex], "A credited cost must reference another cost item.");
          }
        });
      }
    });
    outcomes.forEach((outcome, index) => {
      const type = outcome.definition.value.outcomeType;
      const cashTypes = new Set(["personal_cash_prize", "team_cash_prize", "educator_cash_prize", "stipend"]);
      if (
        cashTypes.has(type) &&
        (outcome.monetaryNature?.status !== "disclosed" || outcome.monetaryNature.value !== "cash")
      ) {
        addIssue(context, ["outcomes", "records", index, "monetaryNature"], "Cash prizes and stipends require a disclosed cash classification.");
      }
      if (type === "project_budget") {
        if (outcome.monetaryNature?.status !== "disclosed" || outcome.monetaryNature.value !== "restricted_funding") {
          addIssue(context, ["outcomes", "records", index, "monetaryNature"], "Project budgets must be classified as restricted funding.");
        }
        if (outcome.useRestriction?.status !== "disclosed") {
          addIssue(context, ["outcomes", "records", index, "useRestriction"], "Project budgets require a source-backed use restriction.");
        }
      }
      if (type === "personal_cash_prize" && outcome.recipientScope.status === "disclosed" && outcome.recipientScope.value !== "individual") {
        addIssue(context, ["outcomes", "records", index, "recipientScope"], "A personal cash prize must have individual recipient scope.");
      }
      if (type === "team_cash_prize" && outcome.recipientScope.status === "disclosed" && outcome.recipientScope.value !== "team") {
        addIssue(context, ["outcomes", "records", index, "recipientScope"], "A team cash prize must have team recipient scope.");
      }
      if (type === "educator_cash_prize" && outcome.recipientScope.status === "disclosed" && outcome.recipientScope.value !== "educator") {
        addIssue(context, ["outcomes", "records", index, "recipientScope"], "An educator cash prize must have educator recipient scope.");
      }
    });

    collectScopes(structuredRoot).forEach(({ scope, path }) => {
      validateScope(scope, variantIds, stageIds, pathwayIds, context, path);
    });

    if (card.cycle.status === "modeled") {
      const timingClaims = new Map(
        stages.flatMap((stage) => stage.timings.map((timing) => [timing.claimId, timing] as const)),
      );
      const expectedEvents = {
        opens: "opens",
        closes: "deadline",
        coverageStart: "starts",
        coverageEnd: "ends",
      } as const;
      for (const [key, expectedEvent] of Object.entries(expectedEvents) as Array<[
        keyof CycleRecord["timingRefs"],
        string,
      ]>) {
        const claimId = card.cycle.value.timingRefs[key];
        if (claimId === null) continue;
        const timing = timingClaims.get(claimId);
        if (timing === undefined) {
          addIssue(context, ["cycle", "value", "timingRefs", key], "Cycle timing references must resolve to a stage timing claim.");
        } else if (timing.status === "disclosed" && timing.value.event !== expectedEvent) {
          addIssue(context, ["cycle", "value", "timingRefs", key], `Cycle ${key} must reference a ${expectedEvent} timing.`);
        }
      }
    }

    const knownClaims = new Set(claimIds);
    for (const [fieldId, refs] of Object.entries(card.projectionRefs)) {
      if (refs === undefined) continue;
      if (new Set(refs).size !== refs.length) {
        addIssue(context, ["projectionRefs", fieldId], "Projection claim references must be unique.");
      }
      refs.forEach((claimId, index) => {
        if (!knownClaims.has(claimId)) {
          addIssue(context, ["projectionRefs", fieldId, index], `Projection references unknown claim ${claimId}.`);
        }
      });
      const fact = card.facts[fieldId as keyof typeof card.facts];
      if (fact.projection === null || fact.projection.rule.length === 0) {
        addIssue(context, ["facts", fieldId, "projection"], "A structured projection requires fact-level projection metadata.");
      } else if (JSON.stringify(fact.projection.claimRefs) !== JSON.stringify(refs)) {
        addIssue(context, ["facts", fieldId, "projection", "claimRefs"], "Fact projection metadata must match projectionRefs.");
      }
    }

    const drift = getProjectionDrift(card);
    for (const fieldId of drift.fields) {
      addIssue(
        context,
        ["facts", fieldId],
        "Stored summary fact does not match the deterministic v2 projection.",
      );
    }
    if (drift.refs) {
      addIssue(
        context,
        ["projectionRefs"],
        "Stored projection references do not match the deterministic v2 projection.",
      );
    }
    if (drift.conflicts) {
      addIssue(
        context,
        ["conflicts"],
        "Stored conflict metadata does not match the deterministic v2 projection.",
      );
    }
  },
);

export type OpportunityCard = z.infer<typeof opportunityCardSchema>;
export type V2OpportunityCard = OpportunityCard;
export type MigrationMetadata = z.infer<typeof migrationMetadataSchema>;

function unassessedCollection() {
  return { status: "unassessed" as const, records: [], note: null };
}

export function createEmptyCard({
  slug,
  summary = "Card in progress. Source-backed details have not been added yet.",
  reviewState = "draft",
}: CreateCardOptions): OpportunityCard {
  return opportunityCardSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    opportunityId: null,
    cycle: { status: "unassessed", value: null },
    cardVersion: INITIAL_CARD_VERSION,
    slug,
    summary,
    reviewState,
    reviewedAt: null,
    sourcePagesChecked: [],
    conflicts: [],
    organizations: unassessedCollection(),
    organizationRoles: unassessedCollection(),
    institutionRelationships: unassessedCollection(),
    variants: unassessedCollection(),
    stages: unassessedCollection(),
    pathways: unassessedCollection(),
    costItems: unassessedCollection(),
    outcomes: unassessedCollection(),
    facts: createEmptyFacts(),
    projectionRefs: {},
    migratedFrom: null,
  });
}

export type {
  CostItemRecord,
  CycleRecord,
  InstitutionRelationshipRecord,
  OrganizationRecord,
  OrganizationRoleRecord,
  OutcomeRecord,
  PathwayRecord,
  Scope,
  StageRecord,
  VariantRecord,
};
