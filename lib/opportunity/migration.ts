import { canonicalJson, sha256Hex } from "./canonical";
import { applyOpportunityProjections } from "./projection";
import {
  V1_SCHEMA_VERSION,
  v1OpportunityCardSchema,
  type V1OpportunityCard,
} from "./schema-v1";
import {
  SCHEMA_VERSION,
  opportunityCardProjectionInputSchema,
  opportunityCardSchema,
  type OpportunityCard,
} from "./schema-v2";
import { LEGACY_V2_SCHEMA_VERSION } from "./schema-version";

function unassessedCollection() {
  return { status: "unassessed" as const, records: [], note: null };
}

export function migrateV1ToV2(input: unknown): OpportunityCard {
  const v1 = v1OpportunityCardSchema.parse(input);
  return opportunityCardSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    opportunityId: null,
    cycle: { status: "unassessed", value: null },
    cardVersion: v1.cardVersion + 1,
    slug: v1.slug,
    summary: v1.summary,
    reviewState: "draft",
    reviewedAt: null,
    sourcePagesChecked: v1.sourcePagesChecked,
    conflicts: v1.conflicts,
    organizations: unassessedCollection(),
    organizationRoles: unassessedCollection(),
    institutionRelationships: unassessedCollection(),
    variants: unassessedCollection(),
    stages: unassessedCollection(),
    pathways: unassessedCollection(),
    costItems: unassessedCollection(),
    outcomes: unassessedCollection(),
    facts: v1.facts,
    projectionRefs: {},
    migratedFrom: {
      schemaVersion: V1_SCHEMA_VERSION,
      cardVersion: v1.cardVersion,
      reviewedAt: v1.reviewedAt,
      cardSha256: sha256Hex(canonicalJson(v1)),
    },
  });
}

export function isV1OpportunityCard(input: unknown): input is V1OpportunityCard {
  return v1OpportunityCardSchema.safeParse(input).success;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function claimValues(claim: unknown): unknown[] {
  if (!isRecord(claim)) return [];
  const values = [claim.value];
  if (Array.isArray(claim.conflictingValues)) {
    for (const candidate of claim.conflictingValues) {
      if (isRecord(candidate)) values.push(candidate.value);
    }
  }
  return values;
}

function assertLegacyV2Vocabulary(input: Record<string, unknown>): void {
  const outcomes = input.outcomes;
  if (!isRecord(outcomes) || !Array.isArray(outcomes.records)) return;

  for (const outcome of outcomes.records) {
    if (!isRecord(outcome)) continue;
    const definition = isRecord(outcome.definition) ? outcome.definition : null;
    for (const value of claimValues(definition)) {
      if (isRecord(value) && value.outcomeType === "educator_cash_prize") {
        throw new Error(
          "A schema 2.0.0 card cannot use the schema 2.1.0 educator_cash_prize outcome type.",
        );
      }
    }
    for (const value of claimValues(outcome.recipientScope)) {
      if (value === "educator") {
        throw new Error(
          "A schema 2.0.0 card cannot use the schema 2.1.0 educator recipient scope.",
        );
      }
    }
    for (const value of claimValues(outcome.distribution)) {
      if (!Array.isArray(value)) continue;
      for (const distribution of value) {
        if (
          isRecord(distribution) &&
          (distribution.payee === "educator" || distribution.payee === "school")
        ) {
          throw new Error(
            `A schema 2.0.0 card cannot use the schema 2.1.0 ${distribution.payee} distribution payee.`,
          );
        }
      }
    }
  }
}

function migrateLegacyProjectionVersions(facts: unknown): unknown {
  if (!isRecord(facts)) return facts;
  return Object.fromEntries(
    Object.entries(facts).map(([fieldId, fact]) => {
      if (!isRecord(fact) || fact.projection === null || fact.projection === undefined) {
        return [fieldId, fact];
      }
      if (
        !isRecord(fact.projection) ||
        fact.projection.schemaVersion !== LEGACY_V2_SCHEMA_VERSION
      ) {
        throw new Error(
          `Schema 2.0.0 fact ${fieldId} must use 2.0.0 projection metadata.`,
        );
      }
      return [
        fieldId,
        {
          ...fact,
          projection: {
            ...fact.projection,
            schemaVersion: SCHEMA_VERSION,
          },
        },
      ];
    }),
  );
}

/**
 * Upgrades the retired 2.0.0 envelope to the current minor schema. Card
 * revision, review state, rich structured claims, and evidence remain
 * unchanged; the derived 59-field summary is recomputed under current rules.
 * Version 2.1-only vocabulary is rejected when it is mislabeled as 2.0.0
 * rather than silently grandfathered.
 */
export function migrateV2_0ToCurrent(input: unknown): OpportunityCard {
  if (
    !isRecord(input) ||
    input.schemaVersion !== LEGACY_V2_SCHEMA_VERSION
  ) {
    throw new Error("Expected an Opportunity Facts schema 2.0.0 card.");
  }
  assertLegacyV2Vocabulary(input);
  const normalized = opportunityCardProjectionInputSchema.parse({
    ...input,
    schemaVersion: SCHEMA_VERSION,
    facts: migrateLegacyProjectionVersions(input.facts),
  });
  // Projection rules are versioned with the card contract. Preserve the rich
  // structured source of truth and its evidence, but deterministically rebuild
  // the 59-field summary so a retired projection rule cannot survive import.
  return opportunityCardSchema.parse(applyOpportunityProjections(normalized));
}
