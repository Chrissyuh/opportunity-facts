import { CORE_FIELD_IDS, type FieldId } from "@/lib/opportunity/fields";
import { getDisclosureCount } from "@/lib/opportunity/registry";
import type { OpportunityCard } from "@/lib/opportunity/schema";

export function DisclosureMeter({
  card,
  unassessedFields = new Set(),
}: {
  card: OpportunityCard;
  unassessedFields?: ReadonlySet<FieldId>;
}) {
  const count = getDisclosureCount(card, unassessedFields);

  return (
    <div className="disclosure-meter">
      <div className="disclosure-meter-label">
        <strong>{count.label}</strong>
        <span>{count.detailLabel}</span>
        <span>Assessment coverage—not trust, quality, or independent verification</span>
      </div>
      <ul className="disclosure-track" aria-label="Core-area assessment statuses">
        {CORE_FIELD_IDS.map((fieldId) => {
          const status = unassessedFields.has(fieldId)
            ? "unassessed"
            : card.facts[fieldId].status;
          return (
            <li key={fieldId}>
              <span data-status={status} aria-hidden="true" />
              <span className="sr-only">
                {fieldId.replaceAll("_", " ")}: {status.replaceAll("_", " ")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
