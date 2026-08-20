import Link from "next/link";
import {
  FIELD_DEFINITIONS,
  SECTIONS,
  type FieldDefinition,
  type FieldId,
  type OpportunitySection,
} from "@/lib/opportunity/fields";
import type { Fact, OpportunityCard } from "@/lib/opportunity/schema";
import { getCalculationContext } from "@/lib/opportunity/registry";
import { CardActions } from "./card-actions";
import { CorrectionWorkflow } from "./correction-workflow";
import { DisclosureMeter } from "./disclosure-meter";
import { EvidenceList } from "./evidence-list";
import { ReviewBadge, StatusBadge, reviewLabels } from "./status-badge";
import { StructuredOpportunityDetails } from "./structured-opportunity-details";

const sectionLabels: Record<OpportunitySection, string> = {
  identity: "Identity",
  eligibility: "Eligibility",
  commitment: "Commitment",
  money: "Money",
  selection: "Selection",
  outcomes: "Outcomes",
  terms: "Terms",
};

const reviewExplanations: Record<OpportunityCard["reviewState"], string> = {
  demo: "Fictional data created to demonstrate the product. No real organization is described.",
  draft: "A working card that has not completed human source review.",
  automated_draft:
    "AI-assisted research organized these sources into a draft. Check every important claim and evidence excerpt before relying on it.",
  ai_audited:
    "An independent AI-assisted audit checked that displayed values and excerpts align with the cited sources. No person has yet completed the full review.",
  human_reviewed:
    "A person independently checked the relevant displayed claims against their cited sources; the underlying organizer claims were not independently verified.",
  organizer_confirmed:
    "The organizer confirmed or supplied information. This is not independent verification.",
};

function displayFactValue(fact: Fact) {
  if (fact.status === "not_found") return "Not found in the sources checked";
  if (fact.status === "not_applicable") return "Does not apply";
  if (fact.status === "unclear") return fact.note ?? "Relevant wording was not precise enough to state one value";
  if (fact.status === "conflicting") return "Reviewed sources support different values";
  return fact.displayValue ?? "Disclosed value unavailable";
}

function FactRow({
  field,
  fact,
  unassessed = false,
}: {
  field: FieldDefinition & { id: FieldId };
  fact: Fact;
  unassessed?: boolean;
}) {
  return (
    <article className={`fact-row ${unassessed ? "fact-row-unassessed" : `fact-row-${fact.status}`}`}>
      <div className="fact-label-cell">
        <h3>{field.label}</h3>
        {field.core ? <span className="core-mark">Core fact</span> : null}
      </div>
      <div className="fact-value-cell">
        <div className="fact-value-topline">
          <p className="fact-value">{unassessed ? "Not assessed in this draft" : displayFactValue(fact)}</p>
          {unassessed ? <span className="status-badge status-unassessed">Draft field</span> : <StatusBadge status={fact.status} />}
        </div>
        {!unassessed && fact.claimKind === "calculated" && fact.calculation ? (
          <div className="calculation-note">
            <strong>{getCalculationContext(field.id)}</strong>{" "}
            {fact.calculation.explanation}
          </div>
        ) : null}
        {!unassessed && fact.claimKind === "organizer_stated" ? (
          <p className="claim-note">Organizer-stated claim.</p>
        ) : null}
        {!unassessed && fact.status === "conflicting" ? (
          <div className="conflict-values">
            {fact.conflictingValues.map((candidate, index) => (
              <div className="conflict-value" key={`${candidate.displayValue}-${index}`}>
                <p><strong>Source-backed value {index + 1}:</strong> {candidate.displayValue}</p>
                {candidate.note ? <p className="fact-note">{candidate.note}</p> : null}
                <EvidenceList
                  sources={candidate.sources}
                  label={`${field.label}: evidence for source-backed value ${index + 1}`}
                />
              </div>
            ))}
          </div>
        ) : !unassessed ? (
          <EvidenceList sources={fact.sources} label={`Inspect evidence for ${field.label}`} />
        ) : null}
        {!unassessed && fact.note && fact.status !== "unclear" ? (
          <p className="fact-note">{fact.note}</p>
        ) : null}
      </div>
    </article>
  );
}

function formatReviewedDate(value: string | null) {
  if (!value) return "Not yet reviewed";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function FactsCard({
  card,
  embedded = false,
  preview = false,
  unassessedFields,
}: {
  card: OpportunityCard;
  embedded?: boolean;
  preview?: boolean;
  unassessedFields?: ReadonlySet<FieldId>;
}) {
  const name = card.facts.opportunity_name.displayValue ?? card.slug;
  const category = card.facts.opportunity_category.displayValue;
  const officialUrl =
    typeof card.facts.official_url.value === "string"
      ? card.facts.official_url.value
      : null;
  const TitleHeading = embedded ? "h3" : "h1";
  const SectionHeading = embedded ? "h4" : "h2";
  const cycleLabel = card.cycle.status === "modeled"
    ? card.cycle.value.label.value
    : "Cycle not modeled";

  return (
    <article
      aria-label={preview ? "Opportunity Facts card preview" : undefined}
      className={`facts-card ${preview ? "facts-card-preview" : ""}`}
      tabIndex={preview ? 0 : undefined}
    >
      <header className="facts-card-header">
        <div className="facts-card-flags">
          <ReviewBadge state={card.reviewState} />
          {category ? <span className="tag">{category}</span> : null}
        </div>
        <div className="facts-card-title-row">
          <div>
            <p className="record-number">
              Opportunity Facts · {cycleLabel} · card revision {card.cardVersion} · schema {card.schemaVersion}
            </p>
            <TitleHeading className="facts-card-title">{name}</TitleHeading>
            <p className="facts-card-summary">{card.summary}</p>
          </div>
          {officialUrl ? (
            <a className="official-link" href={officialUrl} target="_blank" rel="noreferrer noopener">
              Official page <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
        <DisclosureMeter card={card} unassessedFields={unassessedFields} />
        <div className="review-explanation">
          <strong>{reviewLabels[card.reviewState]}:</strong>{" "}
          {reviewExplanations[card.reviewState]}
        </div>
        {!preview ? <CardActions card={card} /> : null}
      </header>

      <div className="status-key" aria-label="Evidence status key">
        <span>Status key</span>
        <StatusBadge status="disclosed" />
        <StatusBadge status="not_found" />
        <StatusBadge status="unclear" />
        <StatusBadge status="conflicting" />
        <StatusBadge status="not_applicable" />
      </div>

      <StructuredOpportunityDetails card={card} embedded={embedded} />

      <div className="facts-sections">
        {SECTIONS.map((section) => {
          const fields = FIELD_DEFINITIONS.filter((field) => field.section === section);
          return (
            <section className="facts-section" key={section} aria-labelledby={`${card.slug}-${section}`}>
              <header className="facts-section-header">
                <span>{String(SECTIONS.indexOf(section) + 1).padStart(2, "0")}</span>
                <SectionHeading id={`${card.slug}-${section}`}>{sectionLabels[section]}</SectionHeading>
              </header>
              <div className="fact-rows">
                {fields.map((field) => (
                  <FactRow
                    key={field.id}
                    field={field}
                    fact={card.facts[field.id]}
                    unassessed={unassessedFields?.has(field.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {!preview ? (
        <footer className="facts-card-footer">
          <section aria-labelledby={`${card.slug}-sources`}>
            <div className="facts-section-header compact-section-header">
              <span>S</span>
              <SectionHeading id={`${card.slug}-sources`}>Source pages checked</SectionHeading>
            </div>
            {card.sourcePagesChecked.length ? (
              <ol className="source-page-list">
                {card.sourcePagesChecked.map((source) => (
                  <li key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer noopener">
                      {source.title} <span aria-hidden="true">↗</span>
                    </a>
                    <span>{source.pageType.replaceAll("_", " ")}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No source pages are attached to this draft yet.</p>
            )}
          </section>
          <dl className="record-meta">
            <div><dt>Reviewed date</dt><dd>{formatReviewedDate(card.reviewedAt)}</dd></div>
            <div><dt>Card version</dt><dd>{card.cardVersion}</dd></div>
            <div><dt>Schema version</dt><dd>{card.schemaVersion}</dd></div>
          </dl>
          <CorrectionWorkflow card={card} />
          <div className="card-disclaimer">
            <strong>No rating is assigned.</strong> This card reports what its listed
            sources disclose. It does not rate legitimacy, quality, prestige, or
            value, and it is not legal or financial advice. Read the listed source pages
            before applying or paying.
          </div>
          <div className="button-row no-print">
            <Link className="button-secondary" href="/methodology">
              How this card works
            </Link>
            <Link className="button-quiet" href="/opportunities">
              Back to the library
            </Link>
          </div>
        </footer>
      ) : null}
    </article>
  );
}
