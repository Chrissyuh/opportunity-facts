import Link from "next/link";
import type { ReactNode } from "react";
import type { FieldId } from "@/lib/opportunity/fields";
import {
  evidenceForAttentionItem,
  groundAttentionCandidates,
  type AttentionItem,
} from "@/lib/analysis/attention";
import { FIELD_REGISTRY_BY_ID } from "@/lib/opportunity/registry";
import type { Fact, OpportunityCard } from "@/lib/opportunity/schema";
import { CardActions } from "./card-actions";
import { EvidenceList } from "./evidence-list";
import { PdfDownloadActions } from "./pdf/pdf-download-actions";
import { ReviewBadge, StatusBadge } from "./status-badge";
import {
  CostPanel,
  OrganizationRelationshipPanel,
  OutcomePanel,
  StagePathwayPanel,
  VariantPanel,
} from "./structured-opportunity-details";

type OverviewItem = { label: string; fieldIds: FieldId[] };

const overviewItems: OverviewItem[] = [
  { label: "Who can apply", fieldIds: ["grade_levels", "ages"] },
  { label: "Application deadline", fieldIds: ["application_deadline"] },
  {
    label: "When it happens",
    fieldIds: ["start_date", "end_date", "duration"],
  },
  {
    label: "Format and location",
    fieldIds: ["participation_format", "location"],
  },
  { label: "Cost", fieldIds: ["estimated_total_mandatory_cost", "tuition"] },
  { label: "Financial aid", fieldIds: ["financial_aid"] },
  { label: "Operated by", fieldIds: ["operating_organization"] },
  {
    label: "Institution relationships",
    fieldIds: ["institution_relationship"],
  },
  { label: "Selection", fieldIds: ["selection_process"] },
  {
    label: "What participants receive",
    fieldIds: [
      "cash_award",
      "tuition_waiver",
      "program_seat",
      "other_benefits",
    ],
  },
];

function meaningfulFacts(card: OpportunityCard, fieldIds: FieldId[], assessedFieldIds?: ReadonlySet<FieldId>) {
  const includedFieldIds = assessedFieldIds
    ? fieldIds.filter((id) => assessedFieldIds.has(id))
    : fieldIds;
  const facts = includedFieldIds.map((id) => ({ id, fact: card.facts[id] }));
  const disclosed = facts.filter(
    ({ fact }) => fact.status === "disclosed" || fact.status === "conflicting",
  );
  return disclosed.length ? disclosed : facts.slice(0, 1);
}

function FactValue({ fact }: { fact: Fact }) {
  if (fact.status === "conflicting") {
    return (
      <>
        {fact.conflictingValues.map((value) => value.displayValue).join(" / ")}
      </>
    );
  }
  const fallback =
    fact.status === "not_found"
      ? "Not found in checked sources"
      : fact.status === "unclear"
        ? "The source wording is unclear"
        : fact.status === "not_applicable"
          ? "Does not apply"
          : "No supported value";
  return <>{fact.displayValue ?? fact.note ?? fallback}</>;
}

export function OpportunityOverview({
  card,
  embedded = false,
  attentionItems,
  attentionLimit = 5,
  fullEvidenceAvailable = true,
  assessedFieldIds,
  resultActions,
}: {
  card: OpportunityCard;
  embedded?: boolean;
  attentionItems?: readonly AttentionItem[];
  attentionLimit?: number;
  fullEvidenceAvailable?: boolean;
  assessedFieldIds?: readonly FieldId[];
  resultActions?: ReactNode;
}) {
  const name = card.facts.opportunity_name.displayValue ?? card.slug;
  const cycle =
    card.cycle.status === "modeled" ? card.cycle.value.label.value : null;
  const attention = (
    attentionItems ?? groundAttentionCandidates(card, [])
  ).slice(0, attentionLimit);
  const HeroHeading = embedded ? "h3" : "h1";
  const SectionHeading = embedded ? "h4" : "h2";
  const stagePreview = `${card.stages.records.length} stage${card.stages.records.length === 1 ? "" : "s"} / ${card.pathways.records.length} path${card.pathways.records.length === 1 ? "" : "s"}`;
  const costPreview = `${card.costItems.records.length} cost item${card.costItems.records.length === 1 ? "" : "s"}${card.costItems.status === "modeled" ? ` / ${card.costItems.completeness} inventory` : ""}`;
  const outcomePreview = `${card.outcomes.records.length} distinct outcome${card.outcomes.records.length === 1 ? "" : "s"}`;
  const organizationPreview = `${card.organizations.records.length} organization${card.organizations.records.length === 1 ? "" : "s"} / ${card.institutionRelationships.records.length} institution relationship${card.institutionRelationships.records.length === 1 ? "" : "s"}`;
  const variantPreview = card.variants.records.length
    ? `${card.variants.records.length} program or cohort variant${card.variants.records.length === 1 ? "" : "s"}`
    : "No separate program variants modeled";
  const hasProcessDetails = card.stages.records.length > 0 || card.pathways.records.length > 0;
  const hasCostDetails = card.costItems.records.length > 0;
  const hasOutcomeDetails = card.outcomes.records.length > 0;
  const hasRelationshipDetails = card.organizations.records.length > 0 || card.institutionRelationships.records.length > 0;
  const hasVariantDetails = card.variants.records.length > 0;
  const hasRichDetails = hasProcessDetails || hasCostDetails || hasOutcomeDetails || hasRelationshipDetails || hasVariantDetails;
  const assessedFieldSet = assessedFieldIds ? new Set(assessedFieldIds) : undefined;
  const visibleOverviewItems = assessedFieldSet
    ? overviewItems.filter((item) => item.fieldIds.some((id) => assessedFieldSet.has(id)))
    : overviewItems;

  return (
    <article
      className={`opportunity-overview ${embedded ? "opportunity-overview-embedded" : ""}`}
    >
      <header className="overview-hero">
        <div className="overview-hero-copy">
          <div className="overview-meta">
            {cycle ? <span className="cycle-label">{cycle}</span> : null}
            {!embedded ? <ReviewBadge state={card.reviewState} /> : null}
          </div>
          <HeroHeading>{name}</HeroHeading>
          {!embedded ? <p className="overview-summary">{card.summary}</p> : null}
        </div>
        <div className="overview-actions">
          {embedded ? (
            <PdfDownloadActions card={card} attentionItems={attention} fullEvidenceAvailable={fullEvidenceAvailable} assessedFieldIds={assessedFieldIds} />
          ) : (
            <CardActions
              card={card}
              compact
              secondaryActions={<PdfDownloadActions card={card} attentionItems={attention} fullEvidenceAvailable={fullEvidenceAvailable} assessedFieldIds={assessedFieldIds} />}
            />
          )}
          {!embedded ? (
            <Link
              className="record-link"
              href={`/opportunities/${card.slug}/record`}
            >
              Full Record <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </header>

      <section
        className="overview-section"
        aria-labelledby={`${card.slug}-glance`}
      >
        <div className="overview-section-heading">
          <SectionHeading id={`${card.slug}-glance`}>At a glance</SectionHeading>
        </div>
        <dl className="glance-grid">
          {visibleOverviewItems.map((item) => {
            const facts = meaningfulFacts(card, item.fieldIds, assessedFieldSet);
            return (
              <div className="glance-fact" key={item.label}>
                <dt>{item.label}</dt>
                <dd>
                  {facts.map(({ id, fact }, index) => (
                    <div className="glance-value" key={id}>
                      {facts.length > 1 ? (
                        <span className="glance-sub-label">
                          {FIELD_REGISTRY_BY_ID[id].label}
                        </span>
                      ) : null}
                      <strong>
                        <FactValue fact={fact} />
                      </strong>
                      {fact.status === "disclosed" ? null : <StatusBadge status={fact.status} />}
                      <EvidenceList
                        sources={fact.sources}
                        label="Check source"
                      />
                      {index < facts.length - 1 ? (
                        <span className="sr-only">; </span>
                      ) : null}
                    </div>
                  ))}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {attention.length ? (
        <section
          className="attention-panel"
          aria-labelledby={`${card.slug}-attention`}
        >
          <div className="overview-section-heading">
            <SectionHeading id={`${card.slug}-attention`}>
              Needs attention <span className="attention-count" aria-hidden="true">{attention.length}</span>
            </SectionHeading>
          </div>
          <div className="attention-list">
            {attention.map((item) => (
              <details key={item.id} className="attention-item">
                <summary>
                  <span>{item.title}</span>
                  <span
                    className={`attention-priority attention-${item.priority}`}
                  >
                    {item.priority === "high" ? "Important" : item.priority}
                  </span>
                </summary>
                <div>
                  <p>{item.explanation}</p>
                  {item.suggestedNextStep ? (
                    <p>
                      <strong>Verify next:</strong> {item.suggestedNextStep}
                    </p>
                  ) : null}
                  <EvidenceList
                    sources={evidenceForAttentionItem(card, item)}
                    label="Review related evidence"
                  />
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {resultActions ? <div className="overview-result-actions no-print">{resultActions}</div> : null}

      {hasRichDetails ? <section className="overview-rich-sections" aria-label="Program details">
        {hasProcessDetails ? <details className="overview-rich-disclosure">
          <summary>
            <span>
              <strong>Timeline and selection process</strong>
              <small>{stagePreview}</small>
            </span>
            <span>View details</span>
          </summary>
          <StagePathwayPanel card={card} />
        </details> : null}
        {hasCostDetails ? <details className="overview-rich-disclosure">
          <summary>
            <span>
              <strong>Cost breakdown and aid</strong>
              <small>{costPreview}</small>
            </span>
            <span>View details</span>
          </summary>
          <CostPanel card={card} />
        </details> : null}
        {hasOutcomeDetails ? <details className="overview-rich-disclosure">
          <summary>
            <span>
              <strong>Outcomes and prizes</strong>
              <small>{outcomePreview}</small>
            </span>
            <span>View details</span>
          </summary>
          <OutcomePanel card={card} />
        </details> : null}
        {hasRelationshipDetails ? <details className="overview-rich-disclosure">
          <summary>
            <span>
              <strong>Who runs it and institution relationships</strong>
              <small>{organizationPreview}</small>
            </span>
            <span>View details</span>
          </summary>
          <OrganizationRelationshipPanel card={card} />
        </details> : null}
        {hasVariantDetails ? <details className="overview-rich-disclosure">
          <summary>
            <span>
              <strong>Programs and cohorts</strong>
              <small>{variantPreview}</small>
            </span>
            <span>View details</span>
          </summary>
          <VariantPanel card={card} />
        </details> : null}
      </section> : null}

      {!embedded ? <section className="overview-next-step">
        <div>
          <SectionHeading>Full research record</SectionHeading>
          <p>Inspect every retained fact, source, and evidence attachment.</p>
        </div>
        <Link
          className="button-secondary"
          href={`/opportunities/${card.slug}/record`}
        >
          Open Full Record
        </Link>
      </section> : null}
    </article>
  );
}
