import type { Metadata } from "next";
import { OpportunityLibrary } from "@/components/opportunity-library";
import { getAllCards } from "@/lib/opportunity/data";

export const metadata: Metadata = {
  title: "Opportunity examples",
  description: "Search and filter source-backed student opportunity facts cards.",
};

export default function OpportunitiesPage() {
  const cards = getAllCards();
  const allDemo = cards.length > 0 && cards.every((card) => card.reviewState === "demo");

  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Browse · Compare disclosures, not verdicts</p>
            <h1>Opportunity examples</h1>
          </div>
          <div className="stack">
            <p className="lede">
              Explore what Opportunity Facts can produce, check reviewed evidence,
              or choose records to compare. The analyzer remains the main product.
            </p>
            {allDemo ? <span className="demo-ribbon">Current dataset: fictional demo cards</span> : null}
          </div>
        </div>
      </header>
      <div className="shell section">
        <OpportunityLibrary cards={cards} />
      </div>
    </main>
  );
}
