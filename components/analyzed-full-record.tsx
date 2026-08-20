"use client";

import type { OpportunityCard } from "@/lib/opportunity/schema";
import type { FieldId } from "@/lib/opportunity/fields";
import { FactsCard } from "./facts-card";
import { FullRecordControls } from "./full-record-controls";

export function AnalyzedFullRecord({ card, assessedFieldIds }: { card: OpportunityCard; assessedFieldIds: readonly FieldId[] }) {
  const assessed = new Set(assessedFieldIds);
  const unassessed = new Set(Object.keys(card.facts).filter((id) => !assessed.has(id as FieldId)) as FieldId[]);
  return (
    <FullRecordControls>
      <FactsCard card={card} embedded unassessedFields={unassessed} />
    </FullRecordControls>
  );
}
