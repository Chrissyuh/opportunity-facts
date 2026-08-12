import { canonicalJson, sha256Hex } from "./canonical";
import {
  V1_SCHEMA_VERSION,
  v1OpportunityCardSchema,
  type V1OpportunityCard,
} from "./schema-v1";
import {
  SCHEMA_VERSION,
  opportunityCardSchema,
  type OpportunityCard,
} from "./schema-v2";

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
