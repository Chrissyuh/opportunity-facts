import { CORE_FIELD_IDS } from "@/lib/opportunity/fields";
import { getDisclosureCount } from "@/lib/opportunity/registry";
import type { OpportunityCard } from "@/lib/opportunity/schema";

export function DisclosureMeter({ card }: { card: OpportunityCard }) {
  const count = getDisclosureCount(card);

  return (
    <div className="disclosure-meter">
      <div className="disclosure-meter-label">
        <strong>{count.label}</strong>
        <span>Completeness count—not a trust score</span>
      </div>
      <div
        className="disclosure-track"
        role="progressbar"
        aria-label={count.label}
        aria-valuemin={0}
        aria-valuemax={count.total}
        aria-valuenow={count.disclosed}
      >
        {CORE_FIELD_IDS.map((fieldId, index) => (
          <span
            key={fieldId}
            data-filled={index < count.disclosed}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
