"use client";

import { useState } from "react";
import type { OpportunityCard } from "@/lib/opportunity/schema";
import { parseOpportunityCard } from "@/lib/opportunity/serialization";

const compareStorageKey = "opportunity-facts:comparison:v1";

function cardName(card: OpportunityCard) {
  return typeof card.facts.opportunity_name.value === "string"
    ? card.facts.opportunity_name.value
    : card.slug;
}

function downloadCard(card: OpportunityCard) {
  const blob = new Blob([`${JSON.stringify(card, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${card.slug}.opportunity-facts.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readComparison(): OpportunityCard[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(compareStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      try {
        return [parseOpportunityCard(item)];
      } catch {
        return [];
      }
    }).slice(0, 3);
  } catch {
    return [];
  }
}

export function CardActions({ card }: { card: OpportunityCard }) {
  const [message, setMessage] = useState("");

  function addToComparison() {
    const existing = readComparison();
    if (existing.some((item) => item.slug === card.slug)) {
      setMessage(`${cardName(card)} is already in the comparison.`);
      return;
    }
    if (existing.length >= 3) {
      setMessage("A comparison can contain at most three cards. Remove one before adding another.");
      return;
    }
    const next = [...existing, card];
    try {
      localStorage.setItem(compareStorageKey, JSON.stringify(next));
      window.dispatchEvent(new Event("opportunity-facts:comparison-change"));
    } catch {
      setMessage("This browser could not save the comparison selection.");
      return;
    }
    setMessage(`${cardName(card)} added to comparison.`);
  }

  return (
    <>
      <div className="button-row card-action-row no-print">
        <button className="button" type="button" onClick={addToComparison}>
          Add to comparison
        </button>
        <button className="button-secondary" type="button" onClick={() => downloadCard(card)}>
          Export JSON
        </button>
        <button className="button-quiet" type="button" onClick={() => window.print()}>
          Print card
        </button>
      </div>
      <p className="action-message no-print" role="status" aria-live="polite">
        {message}
      </p>
    </>
  );
}
