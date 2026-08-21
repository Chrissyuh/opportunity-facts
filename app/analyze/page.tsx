import type { Metadata } from "next";
import { AnalysisWorkbench } from "@/components/analysis-workbench";
import { SampleAnalysisReplay } from "@/components/sample-analysis-replay";
import { SampleAnalysisResolver } from "@/components/sample-analysis-resolver";
import Link from "next/link";
import { isAnalysisEnabled } from "@/lib/analysis/admission-control";
import { isBatchAnalysisEnabled } from "@/lib/product-features";
import { isSampleAnalysisId } from "@/lib/sample-analysis/catalog";
import { getSampleAnalysis } from "@/lib/sample-analysis/server";

export const metadata: Metadata = {
  title: "Analyze an opportunity",
  description: "Research a public opportunity page into a source-backed draft.",
};

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedSample = typeof query.sample === "string" ? query.sample : null;
  const batchAnalysisEnabled = isBatchAnalysisEnabled();
  const sample = requestedSample && isSampleAnalysisId(requestedSample)
    ? await getSampleAnalysis(requestedSample)
    : null;
  return (
    <main id="main-content" className="page-main analyze-page">
      <header className="page-header analyze-page-header">
        <div className="shell page-header-grid">
          <h1>Analyze an opportunity</h1>
          <div><p>Paste a public page. Opportunity Facts will research the related pages and check the evidence.</p>{batchAnalysisEnabled ? <Link className="batch-link" href="/analyze/batch">Need to check several? Batch analyze up to 5 →</Link> : null}</div>
        </div>
      </header>
      <div className="shell section">
        {requestedSample === "next" ? (
          <SampleAnalysisResolver />
        ) : requestedSample && isSampleAnalysisId(requestedSample) ? (
          <SampleAnalysisReplay sample={sample!} />
        ) : (
          <AnalysisWorkbench
            configured={isAnalysisEnabled() && Boolean(process.env.OPENAI_API_KEY?.trim())}
          />
        )}
      </div>
    </main>
  );
}
