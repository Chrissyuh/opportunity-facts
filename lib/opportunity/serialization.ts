import { z } from "zod";

import { migrateV1ToV2 } from "./migration";
import { V1_SCHEMA_VERSION } from "./schema-v1";
import { SCHEMA_VERSION, opportunityCardSchema, type OpportunityCard } from "./schema-v2";

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
        "The v1 card is invalid and could not be migrated to schema 2.0.0.",
        issues,
      );
    }
  }
  if (typeof version === "string" && version !== SCHEMA_VERSION) {
    throw new OpportunityCardImportError(
      `Schema version ${version} is not supported. This app supports 1.0.0 imports and 2.0.0 cards.`,
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
  return parseOpportunityCard(input);
}

export function exportOpportunityCardJson(card: OpportunityCard): string {
  const validated = parseOpportunityCard(card);
  return `${JSON.stringify(validated, null, 2)}\n`;
}
