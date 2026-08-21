import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AnalysisWorkbench } from "@/components/analysis-workbench";
import { SampleAnalysisReplay } from "@/components/sample-analysis-replay";
import { SampleAnalysisResolver } from "@/components/sample-analysis-resolver";
import { isAnalysisEnabled } from "@/lib/analysis/admission-control";
import { isSampleAnalysisId } from "@/lib/sample-analysis/catalog";
import { getSampleAnalysis } from "@/lib/sample-analysis/server";

export const metadata: Metadata = {
  title: "Analyze an opportunity",
  description: "Research a public opportunity page into a source-backed draft.",
};

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ sample?: string | string[]; start?: string | string[] }> }) {
  const query = await searchParams;
  const requestedSample = typeof query.sample === "string" ? query.sample : null;
  const validSampleRequested = requestedSample !== null && isSampleAnalysisId(requestedSample);
  const nextSampleRequested = requestedSample === "next";
  const startRequested = query.start === "1";
  if (!validSampleRequested && !nextSampleRequested && !startRequested) redirect("/");
  const sample = validSampleRequested ? await getSampleAnalysis(requestedSample) : null;
  return (
    <main id="main-content" className="page-main analyze-page">
      <div className="shell section">
        {requestedSample === "next" ? (
          <SampleAnalysisResolver />
        ) : requestedSample && isSampleAnalysisId(requestedSample) ? (
          <SampleAnalysisReplay sample={sample!} />
        ) : (
          <AnalysisWorkbench configured={isAnalysisEnabled() && Boolean(process.env.OPENAI_API_KEY?.trim())} />
        )}
      </div>
    </main>
  );
}
