import type { EvidenceStatus, ReviewState } from "@/lib/opportunity/fields";

const statusLabels: Record<EvidenceStatus, string> = {
  disclosed: "Disclosed",
  not_found: "Not found",
  unclear: "Unclear",
  conflicting: "Conflicting",
  not_applicable: "Not applicable",
};

const reviewLabels: Record<ReviewState, string> = {
  demo: "Demo data",
  draft: "Draft",
  automated_draft: "Automated draft",
  ai_audited: "AI-audited",
  human_reviewed: "Human reviewed",
  organizer_confirmed: "Organizer confirmed",
};

const reviewShortDescriptions: Record<ReviewState, string> = {
  demo: "Fictional data created only to demonstrate the product.",
  draft: "A working record that has not completed a formal review.",
  automated_draft: "Standard analyzer output with automated evidence checks.",
  ai_audited:
    "Independently checked by a higher-capability AI workflow, not the standard analyzer.",
  human_reviewed:
    "A person checked the displayed claims against their cited sources.",
  organizer_confirmed:
    "The organizer supplied or confirmed information; this is not independent verification.",
};

const reviewDescriptions: Record<ReviewState, string> = {
  demo:
    "Fictional data created to demonstrate Opportunity Facts. It does not describe a real organization or opportunity.",
  draft:
    "A working record that has not completed a formal source review. Important claims and evidence still need checking.",
  automated_draft:
    "Created by the standard Opportunity Facts analyzer. Deterministic checks matched retained excerpts to acquired source text, but no independent review is claimed.",
  ai_audited:
    "Reviewed by a higher-capability AI audit workflow, separate from the standard Opportunity Facts analyzer. This audit used the same AI tooling that helped develop and test the site. No human review is claimed.",
  human_reviewed:
    "A person independently checked the relevant displayed claims against their cited sources. This verifies source-to-record alignment, not the organizer's underlying claims or the opportunity's quality.",
  organizer_confirmed:
    "The organizer supplied or confirmed information in this record. Organizer confirmation is not independent verification or a recommendation.",
};

export function StatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>
  );
}

export function ReviewBadge({ state }: { state: ReviewState }) {
  return (
    <details className="review-state-explanation" data-review-state={state}>
      <summary
        className="review-badge"
        data-description={`${reviewLabels[state]} — ${reviewDescriptions[state]}`}
      >
        <span>{reviewLabels[state]}</span>
        <span className="review-badge-help" aria-hidden="true">i</span>
        <span className="sr-only">
          . {reviewShortDescriptions[state]} {reviewDescriptions[state]} Activate for details.
        </span>
      </summary>
    </details>
  );
}

export {
  reviewDescriptions,
  reviewLabels,
  reviewShortDescriptions,
  statusLabels,
};
