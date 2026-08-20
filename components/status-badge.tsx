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

export function StatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>
  );
}

export function ReviewBadge({ state }: { state: ReviewState }) {
  return <span className="review-badge">{reviewLabels[state]}</span>;
}

export { reviewLabels, statusLabels };
