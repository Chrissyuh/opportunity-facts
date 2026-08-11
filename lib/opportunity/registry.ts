import {
  CORE_FIELD_IDS,
  FIELD_DEFINITIONS,
  type FieldDefinition,
  type FieldId,
  type OpportunitySection,
} from "./fields";
import { formatFact } from "./format";
import type { Fact, OpportunityCard } from "./schema";

export interface FieldRegistryEntry extends FieldDefinition {
  readonly id: FieldId;
  readonly format: (fact: Fact) => string;
}

export const FIELD_REGISTRY = FIELD_DEFINITIONS.map((definition) => ({
  ...definition,
  id: definition.id as FieldId,
  format: formatFact,
})) as readonly FieldRegistryEntry[];

export const FIELD_REGISTRY_BY_ID = Object.fromEntries(
  FIELD_REGISTRY.map((entry) => [entry.id, entry]),
) as Record<FieldId, FieldRegistryEntry>;

export const CORE_DISCLOSURE_TOTAL = 13 as const;

export interface DisclosureCount {
  readonly disclosed: number;
  readonly total: typeof CORE_DISCLOSURE_TOTAL;
  readonly label: string;
}

export function getDisclosureCount(card: OpportunityCard): DisclosureCount {
  const disclosed = CORE_FIELD_IDS.filter(
    (fieldId) => card.facts[fieldId].status === "disclosed",
  ).length;
  return {
    disclosed,
    total: CORE_DISCLOSURE_TOTAL,
    label: `${disclosed} of ${CORE_DISCLOSURE_TOTAL} core facts disclosed`,
  };
}

export function getFieldsBySection(section: OpportunitySection): readonly FieldRegistryEntry[] {
  return FIELD_REGISTRY.filter((entry) => entry.section === section);
}

export interface ComparisonCell {
  readonly slug: string;
  readonly fact: Fact;
  readonly formatted: string;
}

export interface ComparisonRow {
  readonly field: FieldRegistryEntry;
  readonly cells: readonly ComparisonCell[];
  readonly differs: boolean;
}

function comparableFact(fact: Fact): string {
  if (fact.status === "conflicting") {
    return JSON.stringify({
      status: fact.status,
      values: fact.conflictingValues.map((candidate) => candidate.normalizedValue ?? candidate.value),
    });
  }
  return JSON.stringify({
    status: fact.status,
    value: fact.normalizedValue ?? fact.value,
  });
}

export function compareOpportunityCards(cards: readonly OpportunityCard[]): readonly ComparisonRow[] {
  if (cards.length < 2 || cards.length > 3) {
    throw new Error("Comparison requires two or three opportunity cards.");
  }

  return FIELD_REGISTRY.map((field) => {
    const cells = cards.map((card) => ({
      slug: card.slug,
      fact: card.facts[field.id],
      formatted: field.format(card.facts[field.id]),
    }));
    return {
      field,
      cells,
      differs: new Set(cells.map((cell) => comparableFact(cell.fact))).size > 1,
    };
  });
}

export function getCalculationContext(fieldId: FieldId): string | null {
  if (fieldId === "calculated_acceptance_rate") {
    return "Calculated from published applicant and acceptance counts.";
  }
  if (fieldId === "estimated_total_mandatory_cost") {
    return "Calculated from disclosed mandatory-cost inputs.";
  }
  return null;
}
