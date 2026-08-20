import type { Metadata } from "next";
import Link from "next/link";
import { BatchAnalysisWorkbench } from "@/components/batch-analysis-workbench";
import { isAnalysisEnabled } from "@/lib/analysis/admission-control";

export const metadata: Metadata = {
  title: "Batch analyze opportunities",
  description: "Analyze up to five public student-opportunity URLs.",
};

export default function BatchAnalyzePage() {
  const configured =
    isAnalysisEnabled() && Boolean(process.env.OPENAI_API_KEY?.trim());
  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Batch analyze · preview limit</p>
            <h1>Research several opportunities.</h1>
          </div>
          <div>
            <p className="lede">
              Queue up to five public URLs. Two analyses run at a time, and each
              finished draft appears independently.
            </p>
            <p>
              <strong>Demo limit: up to 5 opportunities per batch.</strong>
            </p>
            <Link href="/analyze">Analyze one opportunity instead</Link>
          </div>
        </div>
      </header>
      <div className="shell section">
        <BatchAnalysisWorkbench configured={configured} />
      </div>
    </main>
  );
}
