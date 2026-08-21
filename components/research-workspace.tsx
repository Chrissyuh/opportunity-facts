import type { ReactNode } from "react";

import type { AnalysisProgressEvent } from "@/lib/analysis/progress";
import type { FieldId } from "@/lib/opportunity/fields";

const RESEARCH_ROWS: ReadonlyArray<{ label: string; fieldIds: readonly FieldId[] }> = [
  { label: "Opportunity", fieldIds: ["opportunity_name", "operating_organization", "institution_relationship"] },
  { label: "Who can apply", fieldIds: ["grade_levels", "ages", "geographic_restrictions", "citizenship_restrictions"] },
  { label: "Deadline", fieldIds: ["application_deadline"] },
  { label: "Dates / duration", fieldIds: ["start_date", "end_date", "duration", "weekly_hours", "required_live_hours"] },
  { label: "Format / location", fieldIds: ["participation_format", "location"] },
  { label: "Cost", fieldIds: ["estimated_total_mandatory_cost", "tuition", "application_fee"] },
  { label: "Financial aid", fieldIds: ["financial_aid"] },
  { label: "Selection", fieldIds: ["selection_process"] },
  { label: "Outcomes", fieldIds: ["cash_award", "tuition_waiver", "program_seat", "other_benefits"] },
];

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function progressEventPresentation(event: AnalysisProgressEvent): { label: string; active: boolean } | null {
  if (event.type === "accepted") return { label: "Opportunity URL accepted", active: false };
  if (event.type === "cache_checked") return { label: "Previous analysis checked", active: false };
  if (event.type === "source_acquired") return { label: `${event.title} reviewed`, active: false };
  if (event.type === "source_failed") return { label: "A discovered page could not be accessed", active: false };
  if (event.type === "source_set_complete") return { label: `${event.acquired} relevant page${event.acquired === 1 ? "" : "s"} acquired`, active: false };
  if (event.type === "cycle_resolved") return { label: event.status === "resolved" ? `${event.label ?? "Cycle"} identified` : "Cycle needs clarification", active: false };
  if (event.type === "normal_model_started") return { label: "Reviewing the practical questions", active: true };
  if (event.type === "normal_model_output_started") return { label: "Extracting source-backed candidates", active: true };
  if (event.type === "normal_model_completed") return { label: "Practical questions reviewed", active: false };
  if (event.type === "normal_model_failed") return { label: "The compact research response did not complete", active: false };
  if (event.type === "family_started") return { label: `Reviewing ${event.family.replaceAll("_", " ")}`, active: true };
  if (event.type === "family_completed") return { label: `${event.family.replaceAll("_", " ")} review complete`, active: false };
  if (event.type === "family_failed") return { label: `${event.family.replaceAll("_", " ")} review could not complete`, active: false };
  if (event.type === "validated_fact") return { label: `${event.label} verified — ${event.displayValue}`, active: false };
  if (event.type === "validation_complete") return { label: `${event.retained} supported facts retained; ${event.withheld} withheld`, active: false };
  if (event.type === "attention_ready") return { label: `${event.count} item${event.count === 1 ? "" : "s"} need attention`, active: false };
  if (event.type === "quality_complete") return { label: "Result quality checked", active: false };
  if (event.type === "extended_started") return { label: "Extended Research started", active: true };
  if (event.type === "extended_section_started") return { label: event.section === "financial" ? "Reviewing detailed costs and outcomes" : "Reviewing terms, relationships, and pathways", active: true };
  if (event.type === "extended_section_completed") return { label: event.section === "financial" ? "Detailed costs and outcomes checked" : "Terms, relationships, and pathways checked", active: false };
  if (event.type === "extended_section_failed") return { label: event.section === "financial" ? "Some financial details could not be completed" : "Some program details could not be completed", active: false };
  if (event.type === "extended_validation_complete") return { label: `${event.retained} extended claims retained; ${event.withheld} withheld`, active: false };
  if (event.type === "extended_complete") return { label: event.partial ? "Extended Research completed with some sections unavailable" : "Extended Research complete", active: false };
  return null;
}

export function ResearchActivity({ events }: { events: readonly AnalysisProgressEvent[] }) {
  const visibleEvents = events.flatMap((event) => {
    const presentation = progressEventPresentation(event);
    return presentation ? [{ event, ...presentation }] : [];
  }).slice(-8);

  return (
    <section className="research-activity-panel" aria-labelledby="research-activity-title">
      <h3 id="research-activity-title">Research activity</h3>
      <ol className="research-activity" aria-live="polite">
        {visibleEvents.map(({ event, label, active }) => (
          <li key={event.sequence} data-active={active ? "true" : "false"}>
            <span aria-hidden="true">{active ? "◌" : "✓"}</span>
            <span>{label}</span>
            <time>{formatElapsed(event.elapsedMs)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ValidatedFacts({ events }: { events: readonly AnalysisProgressEvent[] }) {
  const facts = new Map<FieldId, Extract<AnalysisProgressEvent, { type: "validated_fact" }>>();
  for (const event of events) if (event.type === "validated_fact") facts.set(event.fieldId, event);

  return (
    <section className="validated-fact-workspace" aria-labelledby="validated-facts-title" aria-live="polite">
      <div className="validated-fact-heading">
        <h3 id="validated-facts-title">Research overview</h3>
        <small>{facts.size} source-backed fact{facts.size === 1 ? "" : "s"}</small>
      </div>
      <dl className="validated-fact-groups">
        {RESEARCH_ROWS.map((row) => {
          const rowFacts = row.fieldIds.flatMap((fieldId) => {
            const fact = facts.get(fieldId);
            return fact ? [fact] : [];
          });
          return (
            <div className="validated-fact-row" data-resolved={rowFacts.length ? "true" : "false"} key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {rowFacts.length ? rowFacts.map((fact) => (
                  <span key={fact.fieldId}>
                    <strong>{fact.displayValue}</strong>
                    <small>{fact.evidenceCount} source{fact.evidenceCount === 1 ? "" : "s"} checked</small>
                  </span>
                )) : <span className="validated-fact-pending">Checking sources...</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function SampleAnalysisBadge() {
  return (
    <details className="review-state-explanation sample-analysis-badge">
      <summary className="review-badge" data-description="This sample replays a previously completed Opportunity Facts analysis.">
        <span>Sample analysis</span>
        <span className="review-badge-help" aria-hidden="true">i</span>
        <span className="sr-only">. This sample replays a previously completed Opportunity Facts analysis. Activate for details.</span>
      </summary>
    </details>
  );
}

export function ResearchWorkspace({ events, elapsedMs, fallbackName, context, badge, actions }: {
  events: readonly AnalysisProgressEvent[];
  elapsedMs: number;
  fallbackName: string;
  context?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  const opportunityName = [...events].reverse().find(
    (event): event is Extract<AnalysisProgressEvent, { type: "validated_fact" }> => event.type === "validated_fact" && event.fieldId === "opportunity_name",
  )?.displayValue;

  return (
    <section className="research-workspace" aria-labelledby="research-workspace-title">
      <header className="research-workspace-header">
        <div>
          <div className="research-workspace-state"><span className="research-workspace-pulse" aria-hidden="true" /><span>Researching</span>{badge}</div>
          <h2 id="research-workspace-title">{opportunityName ?? fallbackName}</h2>
          {context ? <p>{context}</p> : null}
        </div>
        <div className="research-workspace-controls"><time>{formatElapsed(elapsedMs)}</time>{actions}</div>
      </header>
      <div className="research-running-grid">
        <ValidatedFacts events={events} />
        <ResearchActivity events={events.filter((event) => event.type !== "validated_fact")} />
      </div>
    </section>
  );
}
