import Link from "next/link";
import type { OpportunityCard } from "@/lib/opportunity/schema";
import { FactsCard } from "./facts-card";
import { FullRecordControls } from "./full-record-controls";
import { PdfDownloadActions } from "./pdf/pdf-download-actions";

const sections = [
  ["identity", "Identity"], ["eligibility", "Eligibility"], ["commitment", "Schedule"],
  ["money", "Costs"], ["selection", "Selection"], ["outcomes", "Outcomes"], ["terms", "Terms"], ["sources", "Sources"],
] as const;

export function FullRecordWorkspace({ card }: { card: OpportunityCard }) {
  return (
    <div className="full-record-workspace">
      <header className="record-header shell">
        <div>
          <Link className="back-link" href={`/opportunities/${card.slug}`}>← Back to Overview</Link>
          <p className="eyebrow">Full research record</p>
          <p>All projected facts, rich structures, evidence, source inventory, and record metadata.</p>
          <PdfDownloadActions card={card} />
        </div>
      </header>
      <div className="record-layout shell-wide">
        <nav className="record-nav no-print" aria-label="Full record sections">
          <strong>Jump to</strong>
          {sections.map(([id, label]) => <a key={id} href={`#${card.slug}-${id}`}>{label}</a>)}
          <Link href={`/opportunities/${card.slug}`}>Overview</Link>
        </nav>
        <div className="record-content"><FullRecordControls><FactsCard card={card} /></FullRecordControls></div>
      </div>
    </div>
  );
}
