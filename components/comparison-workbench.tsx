"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  SECTIONS,
  type FieldId,
  type OpportunitySection,
} from "@/lib/opportunity/fields";
import { compareOpportunityCards, getCalculationContext } from "@/lib/opportunity/registry";
import type { Fact, OpportunityCard } from "@/lib/opportunity/schema";
import {
  importOpportunityCardJson,
  invalidatePortableReviewAttestation,
  parseOpportunityCard,
} from "@/lib/opportunity/serialization";
import { EvidenceList } from "./evidence-list";
import { StatusBadge } from "./status-badge";
import { StructuredComparison } from "./structured-opportunity-details";

const storageKey = "opportunity-facts:comparison:v1";
const storageEvent = "opportunity-facts:comparison-change";
const MAX_IMPORT_BYTES = 1_000_000;

const sectionLabels: Record<OpportunitySection, string> = {
  identity: "Identity",
  eligibility: "Eligibility",
  commitment: "Commitment",
  money: "Money",
  selection: "Selection",
  outcomes: "Outcomes",
  terms: "Terms",
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(storageEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(storageEvent, callback);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(storageKey) ?? "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot() {
  return "[]";
}

function parseCards(serialized: string) {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) return [];
    const parsed = value.flatMap((card) => {
      try {
        return [parseOpportunityCard(card)];
      } catch {
        return [];
      }
    }).slice(0, 3);
    return parsed.filter(
      (card, index) => parsed.findIndex((candidate) => candidate.slug === card.slug) === index,
    );
  } catch {
    return [];
  }
}

function writeCards(cards: OpportunityCard[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cards.slice(0, 3)));
    window.dispatchEvent(new Event(storageEvent));
    return true;
  } catch {
    return false;
  }
}

function cardName(card: OpportunityCard) {
  return card.facts.opportunity_name.displayValue ?? card.slug;
}

function repositoryCardMatches(
  card: OpportunityCard,
  publicCards: readonly OpportunityCard[],
): boolean {
  const repositoryCard = publicCards.find((candidate) => candidate.slug === card.slug);
  return repositoryCard !== undefined && JSON.stringify(repositoryCard) === JSON.stringify(card);
}

function ComparisonFact({
  fact,
  fieldId,
  unassessed,
}: {
  fact: Fact;
  fieldId: FieldId;
  unassessed: boolean;
}) {
  return (
    <div className="comparison-fact">
      {unassessed ? (
        <>
          <span className="status-badge status-unassessed">Draft field</span>
          <p>Not assessed in this draft</p>
        </>
      ) : (
        <StatusBadge status={fact.status} />
      )}
      {!unassessed && fact.status === "conflicting" ? (
        <ul>
          {fact.conflictingValues.map((value, index) => (
            <li key={`${value.displayValue}-${index}`}>
              <strong>{value.displayValue}</strong>
              <EvidenceList sources={value.sources} label={`Evidence for value ${index + 1}`} />
            </li>
          ))}
        </ul>
      ) : !unassessed ? (
        <>
          <p>{fact.displayValue ?? fact.note ?? statusFallback(fact.status)}</p>
          <EvidenceList sources={fact.sources} />
        </>
      ) : null}
      {!unassessed && fact.claimKind === "calculated" ? (
        <span className="comparison-claim-note">
          {getCalculationContext(fieldId)} {fact.calculation?.explanation}
        </span>
      ) : null}
      {!unassessed && fact.claimKind === "organizer_stated" ? (
        <span className="comparison-claim-note">Organizer-stated claim.</span>
      ) : null}
    </div>
  );
}

function statusFallback(status: Fact["status"]) {
  if (status === "not_found") return "Not found in reviewed sources";
  if (status === "not_applicable") return "Does not apply";
  if (status === "unclear") return "Source wording is unclear";
  return "No displayed value";
}

export function ComparisonWorkbench({ publicCards }: { publicCards: OpportunityCard[] }) {
  const serialized = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const selected = parseCards(serialized).map((card) =>
    repositoryCardMatches(card, publicCards)
      ? card
      : invalidatePortableReviewAttestation(card),
  );
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const comparisonScrollRef = useRef<HTMLDivElement>(null);

  const available = publicCards.filter(
    (card) => !selected.some((selectedCard) => selectedCard.slug === card.slug),
  );
  const comparisonRows = selected.length >= 2 ? compareOpportunityCards(selected) : [];

  function isRepositoryCard(card: OpportunityCard) {
    return repositoryCardMatches(card, publicCards);
  }

  function addCard(card: OpportunityCard) {
    if (selected.some((selectedCard) => selectedCard.slug === card.slug)) {
      setMessage(`${cardName(card)} is already in this comparison.`);
      return;
    }
    if (selected.length >= 3) {
      setMessage("A comparison can contain at most three cards. Remove one first.");
      return;
    }
    setMessage(
      writeCards([...selected, card])
        ? `${cardName(card)} added.`
        : "This browser could not save the comparison selection.",
    );
  }

  function removeCard(slug: string) {
    setMessage(
      writeCards(selected.filter((card) => card.slug !== slug))
        ? "Card removed from comparison."
        : "This browser could not update the comparison selection.",
    );
  }

  async function importCard(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage("Import rejected: card JSON must be 1 MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      addCard(importOpportunityCardJson(await file.text()));
    } catch (error) {
      setMessage(`Import rejected: ${error instanceof Error ? error.message : "invalid card JSON"}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function moveComparison(direction: -1 | 1) {
    const scroller = comparisonScrollRef.current;
    if (!scroller) return;
    const factColumn = scroller.querySelector("thead th:first-child");
    const factColumnWidth = factColumn instanceof HTMLElement ? factColumn.offsetWidth : 0;
    const cardColumnWidth = (scroller.scrollWidth - factColumnWidth) / selected.length;
    scroller.scrollBy({
      left: direction * Math.max(240, cardColumnWidth),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  return (
    <div className="stack comparison-workbench">
      <section className="comparison-picker no-print" aria-labelledby="comparison-picker-title">
        <div>
          <p className="eyebrow">Comparison set</p>
          <h2 id="comparison-picker-title">Choose two or three cards.</h2>
          <p>
            Differences are marked for attention. No card is ranked or declared a winner.
          </p>
        </div>
        <div className="comparison-selected">
          {selected.map((card) => (
            <div key={card.slug}>
              <span>{cardName(card)}</span>
              <button type="button" onClick={() => removeCard(card.slug)} aria-label={`Remove ${cardName(card)}`}>
                Remove
              </button>
            </div>
          ))}
          {selected.length < 2 ? <p>Select {2 - selected.length} more card{2 - selected.length === 1 ? "" : "s"} to begin.</p> : null}
        </div>
        <div className="button-row">
          <input
            className="sr-only"
            ref={fileRef}
            id="comparison-import"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCard(file);
            }}
          />
          <label className="button-secondary" htmlFor="comparison-import">Import local card JSON</label>
          {selected.length ? (
            <button className="button-quiet" type="button" onClick={() => setMessage(writeCards([]) ? "Comparison cleared." : "This browser could not clear the comparison.")}>Clear comparison</button>
          ) : null}
          {selected.length >= 2 ? (
            <button className="button-quiet" type="button" onClick={() => window.print()}>Print comparison</button>
          ) : null}
        </div>
        <p className="action-message" role="status" aria-live="polite">{message}</p>
        {selected.length < 3 && available.length ? (
          <div className="available-card-list" role="group" aria-label="Available cards">
            {available.map((card) => (
              <button key={card.slug} type="button" onClick={() => addCard(card)}>
                <span>{cardName(card)}</span>
                <small>
                  {card.facts.opportunity_category.displayValue} · {card.reviewState === "demo" ? "Demo data" : card.reviewState.replaceAll("_", " ")}
                </small>
                <strong>Add</strong>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {selected.length >= 2 ? (
        <>
          <StructuredComparison cards={selected} />
          <section aria-labelledby="comparison-table-title">
          <div className="comparison-table-heading">
            <div>
              <p className="eyebrow">Aligned facts</p>
              <h2 id="comparison-table-title">Side-by-side disclosure record</h2>
            </div>
            <p>Cells marked “Different across cards” identify a variation, not an advantage.</p>
          </div>
          <div className="comparison-scroll-shell">
            <div className="comparison-scroll-cue" id="comparison-scroll-help">
              <p><strong>Swipe across to compare all {selected.length} cards.</strong> Fact names stay pinned.</p>
              <div aria-label="Move across comparison columns">
                <button type="button" aria-label="Show previous comparison card" aria-controls="comparison-table-scroll" onClick={() => moveComparison(-1)}>←</button>
                <button type="button" aria-label="Show next comparison card" aria-controls="comparison-table-scroll" onClick={() => moveComparison(1)}>→</button>
              </div>
            </div>
            <div
              ref={comparisonScrollRef}
              id="comparison-table-scroll"
              className="comparison-scroll"
              tabIndex={0}
              aria-label={`Scrollable comparison table for ${selected.map(cardName).join(", ")}`}
              aria-describedby="comparison-scroll-help"
            >
            <table className="comparison-table">
              <caption className="sr-only">Comparison of {selected.map(cardName).join(", ")}</caption>
              <thead>
                <tr>
                  <th scope="col">Fact</th>
                  {selected.map((card) => (
                    <th scope="col" key={card.slug}>
                      {isRepositoryCard(card) ? (
                        <Link href={`/opportunities/${card.slug}`}>{cardName(card)}</Link>
                      ) : (
                        <strong>{cardName(card)}</strong>
                      )}
                      <span>{card.reviewState.replaceAll("_", " ")}</span>
                      {!isRepositoryCard(card) ? <span>Local card</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              {SECTIONS.map((section) => (
                <tbody key={section}>
                  <tr className="comparison-section-row">
                    <th colSpan={selected.length + 1} scope="rowgroup">{sectionLabels[section]}</th>
                  </tr>
                  {comparisonRows.filter((row) => row.field.section === section).map((row) => {
                    const field = row.field;
                    return (
                      <tr key={field.id}>
                        <th scope="row">
                          {field.label}
                          {field.core ? <span>Core fact</span> : null}
                        </th>
                        {row.cells.map((cell) => (
                          <td key={cell.slug} data-different={row.differs}>
                            {row.differs ? <span className="difference-label">Different across cards</span> : null}
                            <ComparisonFact
                              fact={cell.fact}
                              fieldId={field.id}
                              unassessed={
                                cell.fact.status === "not_found" &&
                                selected.some(
                                  (card) =>
                                    card.slug === cell.slug &&
                                    card.reviewState === "draft" &&
                                    card.sourcePagesChecked.length === 0,
                                )
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
            </div>
          </div>
          <div className="card-disclaimer comparison-disclaimer">
            <strong>No winner is calculated.</strong> Cash awards, stipends, tuition waivers,
            program seats, and in-kind values remain separate rows. Missing or conflicting
            information stays visible.
          </div>
          </section>
        </>
      ) : (
        <section className="comparison-empty" aria-labelledby="comparison-empty-title">
          <span aria-hidden="true">02–03</span>
          <div>
            <h2 id="comparison-empty-title">The comparison is waiting for cards.</h2>
            <p>Add two public cards above, import local JSON, or add cards from their facts pages.</p>
          </div>
        </section>
      )}
    </div>
  );
}
