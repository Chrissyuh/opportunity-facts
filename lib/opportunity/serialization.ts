import { z } from "zod";

import { isReviewAttestationState } from "./fields";
import {
  migrateV1ToV2,
  migrateV2_0ToCurrent,
  migrateV2_1ToCurrent,
} from "./migration";
import { V1_SCHEMA_VERSION } from "./schema-v1";
import { SCHEMA_VERSION, opportunityCardSchema, type OpportunityCard } from "./schema-v2";
import {
  LEGACY_V2_SCHEMA_VERSION,
  PRIOR_V2_SCHEMA_VERSION,
} from "./schema-version";

export class OpportunityCardImportError extends Error {
  readonly issues: readonly z.core.$ZodIssue[];

  constructor(message: string, issues: readonly z.core.$ZodIssue[] = []) {
    super(message);
    this.name = "OpportunityCardImportError";
    this.issues = issues;
  }
}
export function parseOpportunityCard(input: unknown): OpportunityCard {
  const version =
    typeof input === "object" && input !== null && "schemaVersion" in input
      ? (input as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (version === V1_SCHEMA_VERSION) {
    try {
      return migrateV1ToV2(input);
    } catch (error) {
      const issues = error instanceof z.ZodError ? error.issues : [];
      throw new OpportunityCardImportError(
        `The v1 card is invalid and could not be migrated to schema ${SCHEMA_VERSION}.`,
        issues,
      );
    }
  }
  if (version === LEGACY_V2_SCHEMA_VERSION) {
    try {
      return migrateV2_0ToCurrent(input);
    } catch (error) {
      const issues = error instanceof z.ZodError ? error.issues : [];
      throw new OpportunityCardImportError(
        `The schema ${LEGACY_V2_SCHEMA_VERSION} card is invalid and could not be migrated to schema ${SCHEMA_VERSION}.`,
        issues,
      );
    }
  }
  if (version === PRIOR_V2_SCHEMA_VERSION) {
    try {
      return migrateV2_1ToCurrent(input);
    } catch (error) {
      const issues = error instanceof z.ZodError ? error.issues : [];
      throw new OpportunityCardImportError(
        `The schema ${PRIOR_V2_SCHEMA_VERSION} card is invalid and could not be migrated to schema ${SCHEMA_VERSION}.`,
        issues,
      );
    }
  }
  if (typeof version === "string" && version !== SCHEMA_VERSION) {
    throw new OpportunityCardImportError(
      `Schema version ${version} is not supported. This app supports ${V1_SCHEMA_VERSION}, ${LEGACY_V2_SCHEMA_VERSION}, and ${PRIOR_V2_SCHEMA_VERSION} imports plus ${SCHEMA_VERSION} cards.`,
    );
  }
  const result = opportunityCardSchema.safeParse(input);
  if (!result.success) {
    throw new OpportunityCardImportError(
      version === undefined
        ? "The file does not declare a supported Opportunity Facts schema version."
        : "The file is not a valid Opportunity Facts card.",
      result.error.issues,
    );
  }
  return result.data;
}

export function importOpportunityCardJson(json: string): OpportunityCard {
  let input: unknown;
  try {
    input = JSON.parse(json) as unknown;
  } catch {
    throw new OpportunityCardImportError("The selected file is not valid JSON.");
  }
  return invalidatePortableReviewAttestation(parseOpportunityCard(input));
}

export function invalidatePortableReviewAttestation(
  card: OpportunityCard,
): OpportunityCard {
  // A portable JSON file cannot carry the repository's review attestation into
  // this browser. Keep the reviewed material, but require a new review before
  // the imported revision can be represented as AI-audited, human-reviewed,
  // or organizer-confirmed.
  // `demo` is data provenance rather than review attestation and must remain
  // visible so fictional content is never relabeled as an ordinary draft.
  if (!isReviewAttestationState(card.reviewState)) {
    return card;
  }
  return opportunityCardSchema.parse({
    ...card,
    cardVersion: card.cardVersion + 1,
    reviewState: "draft",
    reviewedAt: null,
  });
}

export function exportOpportunityCardJson(card: OpportunityCard): string {
  const validated = parseOpportunityCard(card);
  return `${JSON.stringify(validated, null, 2)}\n`;
}
