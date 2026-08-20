"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getDisclosureCount } from "@/lib/opportunity/registry";
import { currentUtcDate, opportunityDeadlineState } from "@/lib/opportunity/library";
import type { OpportunityCard } from "@/lib/opportunity/schema";
import { ReviewBadge, StatusBadge } from "./status-badge";

type DisclosureFilter = "all" | "disclosed" | "unresolved" | "not_applicable";
type FactStatus = OpportunityCard["facts"][keyof OpportunityCard["facts"]]["status"];

function textValue(card: OpportunityCard, field: keyof OpportunityCard["facts"]) {
  const value = card.facts[field].displayValue;
  return value ?? "";
}

function matchesDisclosure(status: FactStatus, filter: DisclosureFilter) {
  if (filter === "all") return true;
  if (filter === "disclosed") return status === "disclosed";
  if (filter === "not_applicable") return status === "not_applicable";
  return status === "not_found" || status === "unclear" || status === "conflicting";
}

function formatFamily(card: OpportunityCard) {
  const normalized = card.facts.participation_format.normalizedValue;
  if (!normalized || normalized.kind !== "participation_format") return "missing";
  return normalized.value === "online" ? "online" : "in_person";
}

export function OpportunityLibrary({ cards }: { cards: OpportunityCard[] }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [review, setReview] = useState("all");
  const [cost, setCost] = useState<DisclosureFilter>("all");
  const [refund, setRefund] = useState<DisclosureFilter>("all");
  const [selection, setSelection] = useState<DisclosureFilter>("all");
  const [format, setFormat] = useState("all");
  const [deadline, setDeadline] = useState("all");
  const today = currentUtcDate();
  const allDemo = cards.length > 0 && cards.every((card) => card.reviewState === "demo");
  const activeFilterCount = [
    query.trim(),
    category !== "all",
    review !== "all",
    cost !== "all",
    refund !== "all",
    selection !== "all",
    format !== "all",
    deadline !== "all",
  ].filter(Boolean).length;

  const categories = useMemo(
    () =>
      Array.from(
        new Set(cards.map((card) => textValue(card, "opportunity_category")).filter(Boolean)),
      ).sort(),
    [cards],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return cards.filter((card) => {
      const searchable = [
        textValue(card, "opportunity_name"),
        textValue(card, "operating_organization"),
        textValue(card, "named_institution"),
        textValue(card, "location"),
        card.summary,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!search || searchable.includes(search)) &&
        (category === "all" || textValue(card, "opportunity_category") === category) &&
        (review === "all" || card.reviewState === review) &&
        matchesDisclosure(card.facts.estimated_total_mandatory_cost.status, cost) &&
        matchesDisclosure(card.facts.refund_policy.status, refund) &&
        matchesDisclosure(card.facts.selection_evidence.status, selection) &&
        (format === "all" || formatFamily(card) === format) &&
        (deadline === "all" || opportunityDeadlineState(card, today) === deadline)
      );
    });
  }, [cards, category, cost, deadline, format, query, refund, review, selection, today]);

  const groupedCards = useMemo(() => ({
    reviewed: filtered.filter((card) => card.reviewState !== "demo"),
    demos: filtered.filter((card) => card.reviewState === "demo"),
  }), [filtered]);

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setReview("all");
    setCost("all");
    setRefund("all");
    setSelection("all");
    setFormat("all");
    setDeadline("all");
    setFiltersOpen(false);
  }

  return (
    <div className="library-layout">
      <aside className="filter-panel" aria-labelledby="filter-title">
        <div className="filter-heading">
          <h2 id="filter-title">Filter the record set</h2>
          <div className="filter-actions">
            <button
              className="filter-toggle button-quiet"
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="library-filter-controls"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? "Hide filters" : `Show filters${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
            </button>
            <button className="text-button" type="button" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        </div>
        <div id="library-filter-controls" className="filter-controls" data-open={filtersOpen ? "true" : "false"}>
        <div className="field">
          <label htmlFor="library-search">Search</label>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, operator, location…"
          />
        </div>
        <div className="field">
          <label htmlFor="library-category">Category</label>
          <select id="library-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="library-review">Review state</label>
          <select id="library-review" value={review} onChange={(event) => setReview(event.target.value)}>
            <option value="all">All review states</option>
            <option value="demo">Demo data</option>
            <option value="draft">Draft</option>
            <option value="human_reviewed">Human reviewed</option>
            <option value="organizer_confirmed">Organizer confirmed</option>
          </select>
        </div>
        <DisclosureSelect id="library-cost" label="Total cost" value={cost} onChange={setCost} />
        <DisclosureSelect id="library-refund" label="Refund policy" value={refund} onChange={setRefund} />
        <DisclosureSelect id="library-selection" label="Selection evidence" value={selection} onChange={setSelection} />
        <div className="field">
          <label htmlFor="library-format">Participation format</label>
          <select id="library-format" value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="all">All formats</option>
            <option value="online">Online</option>
            <option value="in_person">In-person / hybrid / residential</option>
            <option value="missing">Not disclosed / no dated deadline</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="library-deadline">Deadline status</label>
          <select id="library-deadline" value={deadline} onChange={(event) => setDeadline(event.target.value)}>
            <option value="all">All deadlines</option>
            <option value="upcoming">Upcoming or open</option>
            <option value="past">Past</option>
            <option value="missing">Not disclosed</option>
          </select>
        </div>
        </div>
      </aside>

      <section aria-labelledby="library-results-title">
        <div className="library-result-heading">
          <div>
            <p className="eyebrow">{allDemo ? "Fictional demonstration library" : "Opportunity card library"}</p>
            <h2 id="library-results-title" aria-live="polite" aria-atomic="true">
              {filtered.length} {filtered.length === 1 ? "card" : "cards"}
            </h2>
          </div>
          <p>{allDemo ? "All current records are visibly labeled demo data." : "Each record shows its own review state."}</p>
        </div>

        {filtered.length ? (
          <div className="library-groups">
            {groupedCards.reviewed.length ? (
              <LibraryGroup
                title="Reviewed opportunities"
                description="Real opportunity records. Each card states its exact review level."
                cards={groupedCards.reviewed}
              />
            ) : null}
            {groupedCards.demos.length ? (
              <LibraryGroup
                title="Fictional examples"
                description="Sample records for exploring the interface, never real opportunities."
                cards={groupedCards.demos}
                demo
              />
            ) : null}
          </div>
        ) : (
          <div className="empty-state">
            <p className="eyebrow">No matching records</p>
            <h3>Those filters remove every current card.</h3>
            <p>Clear one or more filters. Missing information is searchable; it has not been hidden.</p>
            <button className="button-secondary" type="button" onClick={clearFilters}>Clear all filters</button>
          </div>
        )}
      </section>
    </div>
  );
}

function LibraryGroup({
  title,
  description,
  cards,
  demo = false,
}: {
  title: string;
  description: string;
  cards: OpportunityCard[];
  demo?: boolean;
}) {
  const headingId = `library-group-${demo ? "demo" : "reviewed"}`;
  return (
    <section className="library-group" data-demo={demo ? "true" : "false"} aria-labelledby={headingId}>
      <div className="library-group-heading">
        <div>
          <h3 id={headingId}>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{cards.length} {cards.length === 1 ? "card" : "cards"}</span>
      </div>
      <div className="library-cards">
        {cards.map((card) => <OpportunityLibraryCard key={card.slug} card={card} />)}
      </div>
    </section>
  );
}

function DisclosureSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: DisclosureFilter;
  onChange: (value: DisclosureFilter) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as DisclosureFilter)}>
        <option value="all">All assessment states</option>
        <option value="disclosed">Disclosed</option>
        <option value="unresolved">Not found / unclear / conflicting</option>
        <option value="not_applicable">Not applicable</option>
      </select>
    </div>
  );
}

function OpportunityLibraryCard({ card }: { card: OpportunityCard }) {
  const name = textValue(card, "opportunity_name") || card.slug;
  const operator = textValue(card, "operating_organization") || "Operator not found";
  const count = getDisclosureCount(card);
  const cost = card.facts.estimated_total_mandatory_cost;
  const format = card.facts.participation_format;

  return (
    <article className="library-card">
      <div className="library-card-topline">
        <ReviewBadge state={card.reviewState} />
      </div>
      <div>
        <p className="library-card-category">{textValue(card, "opportunity_category")}</p>
        <h4><Link href={`/opportunities/${card.slug}`}>{name}</Link></h4>
        <p className="library-card-summary">{card.summary}</p>
      </div>
      <dl className="library-card-facts">
        <div><dt>Operator</dt><dd>{operator}</dd></div>
        <div>
          <dt>Total mandatory cost</dt>
          <dd>{cost.displayValue ?? <StatusBadge status={cost.status} />}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{format.displayValue ?? <StatusBadge status={format.status} />}</dd>
        </div>
      </dl>
      <div className="library-card-footer">
        <span>{count.label}</span>
        <Link href={`/opportunities/${card.slug}`}>Open facts card <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
