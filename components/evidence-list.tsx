import type { EvidenceSource } from "@/lib/opportunity/schema";

function formatAccessDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function pageTypeLabel(pageType: EvidenceSource["pageType"]) {
  return pageType.replaceAll("_", " ");
}

export function EvidenceList({
  sources,
  label = "Inspect evidence",
}: {
  sources: EvidenceSource[];
  label?: string;
}) {
  if (sources.length === 0) return null;

  return (
    <details className="evidence-disclosure">
      <summary>
        {label} <span aria-hidden="true">({sources.length})</span>
      </summary>
      <div className="evidence-stack">
        {sources.map((source, index) => (
          <article className="evidence-record" key={`${source.id}-${index}`}>
            <div className="evidence-meta">
              <span>{pageTypeLabel(source.pageType)}</span>
              <span>Accessed {formatAccessDate(source.accessedAt)}</span>
            </div>
            <blockquote>“{source.excerpt}”</blockquote>
            <a href={source.url} target="_blank" rel="noreferrer noopener">
              {source.title} <span className="external-mark" aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </article>
        ))}
      </div>
    </details>
  );
}
