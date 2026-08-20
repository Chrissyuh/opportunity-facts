import type { Metadata } from "next";
import { ComparisonWorkbench } from "@/components/comparison-workbench";
import { getAllCards } from "@/lib/opportunity/data";

export const metadata: Metadata = {
  title: "Compare facts cards",
  description: "Compare two or three student opportunity facts cards without rankings.",
};

export default function ComparePage() {
  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Compare · Two or three records</p>
            <h1>Find the differences that matter.</h1>
          </div>
          <p className="lede">
            Start with eligibility, dates, cost, format, and outcomes. Open the
            complete record only when you need it. No ranking or winner is calculated.
          </p>
        </div>
      </header>
      <div className="shell section">
        <ComparisonWorkbench publicCards={getAllCards()} />
      </div>
    </main>
  );
}
