import type { Metadata } from "next";
import { AnalysisWorkbench } from "@/components/analysis-workbench";
import Link from "next/link";
import { isAnalysisEnabled } from "@/lib/analysis/admission-control";
import { isBatchAnalysisEnabled } from "@/lib/product-features";

export const metadata: Metadata = {
  title: "Analyze an opportunity",
  description: "Create a draft Opportunity Facts card from a public URL or pasted source text.",
};

export default function AnalyzePage() {
  const batchAnalysisEnabled = isBatchAnalysisEnabled();
  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Analyze · Draft, then review</p>
            <h1>Paste an opportunity.</h1>
          </div>
          <div><p className="lede">We’ll review its public pages and build a source-backed draft.</p>{batchAnalysisEnabled ? <Link className="batch-link" href="/analyze/batch">Need to check several? Batch analyze up to 5 →</Link> : null}</div>
        </div>
      </header>
      <div className="shell section">
        <AnalysisWorkbench
          configured={isAnalysisEnabled() && Boolean(process.env.OPENAI_API_KEY?.trim())}
        />
      </div>
    </main>
  );
}
