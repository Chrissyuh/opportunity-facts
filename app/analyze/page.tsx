import type { Metadata } from "next";
import { AnalysisWorkbench } from "@/components/analysis-workbench";

export const metadata: Metadata = {
  title: "Analyze sources",
  description: "Create a draft Opportunity Facts card from a public URL or pasted source text.",
};

export default function AnalyzePage() {
  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Analyze · Draft, then review</p>
            <h1>Turn source pages into an inspectable card.</h1>
          </div>
          <p className="lede">Automatic extraction organizes evidence. It does not decide whether an opportunity is trustworthy or worthwhile.</p>
        </div>
      </header>
      <div className="shell section">
        <AnalysisWorkbench configured={Boolean(process.env.OPENAI_API_KEY?.trim())} />
      </div>
    </main>
  );
}
