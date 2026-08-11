import { z } from "zod";

import { opportunityCardSchema, type OpportunityCard } from "./schema";

export class OpportunityCardImportError extends Error {
  readonly issues: readonly z.core.$ZodIssue[];

  constructor(message: string, issues: readonly z.core.$ZodIssue[] = []) {
    super(message);
    this.name = "OpportunityCardImportError";
    this.issues = issues;
  }
}
export function parseOpportunityCard(input: unknown): OpportunityCard {
  const result = opportunityCardSchema.safeParse(input);
  if (!result.success) {
    throw new OpportunityCardImportError("The file is not a valid Opportunity Facts card.", result.error.issues);
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
