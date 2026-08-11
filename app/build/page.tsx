import type { Metadata } from "next";
import { CardBuilder } from "@/components/card-builder";

export const metadata: Metadata = {
  title: "Publish a clear card",
  description: "Build, validate, preview, import, and export an Opportunity Facts card locally.",
};

export default function BuildPage() {
  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Manual & organizer builder</p>
            <h1>Publish a clear Opportunity Facts card.</h1>
          </div>
          <div className="stack">
            <p className="lede">
              Enter facts section by section, attach exact evidence, validate the shared schema,
              and export a portable record.
            </p>
            <div className="rule-box"><p>Your draft autosaves only in this browser. It is not submitted or published automatically.</p></div>
          </div>
        </div>
      </header>
      <div className="shell section"><CardBuilder /></div>
    </main>
  );
}
