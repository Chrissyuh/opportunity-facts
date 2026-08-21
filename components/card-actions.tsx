"use client";

import type { ReactNode } from "react";
import type { OpportunityCard } from "@/lib/opportunity/schema";

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

export function CardActions({ card, compact = false, secondaryActions }: { card: OpportunityCard; compact?: boolean; secondaryActions?: ReactNode }) {
  return (
    <div className="button-row card-action-row no-print">
      {compact ? (
        <details className="save-export-menu">
          <summary>Save or export</summary>
          <div><button className="button-secondary" type="button" onClick={() => downloadCard(card)}>Export JSON</button><button className="button-quiet" type="button" onClick={() => window.print()}>Print card</button><div className="card-secondary-actions">{secondaryActions}</div></div>
        </details>
      ) : (
        <div className="card-secondary-actions"><button className="button-secondary" type="button" onClick={() => downloadCard(card)}>Export JSON</button><button className="button-quiet" type="button" onClick={() => window.print()}>Print card</button>{secondaryActions}</div>
      )}
    </div>
  );
}
