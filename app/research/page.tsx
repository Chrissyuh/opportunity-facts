import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Transparent protocols for testing Opportunity Facts comprehension and extraction quality.",
};

export default function ResearchPage() {
  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Research · No invented results</p>
            <h1>Measure whether the card helps.</h1>
          </div>
          <p className="lede">
            The repository includes reproducible protocols for comprehension,
            extraction accuracy, and disclosure audits. Results appear only after a
            real study is completed and published.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="shell research-status panel panel-pad">
          <div>
            <p className="eyebrow">Current evidence status</p>
            <h2>Study not yet published</h2>
          </div>
          <p>
            There are no placeholder participants, accuracy claims, or effect sizes.
            The protocols and blank templates are public so the eventual evidence can
            be checked against a plan written before results exist.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Three questions</p>
              <h2>What should be tested</h2>
            </div>
          </div>
          <div className="research-grid">
            <article>
              <span className="research-number">01</span>
              <h3>Comprehension</h3>
              <p>
                Can students and parents correctly identify operator, cost, dates,
                outcomes, and missing terms faster with a facts card than with source
                pages alone?
              </p>
            </article>
            <article>
              <span className="research-number">02</span>
              <h3>Extraction fidelity</h3>
              <p>
                Does every structured value match the gold-label source evidence, and
                are unsupported citations rejected deterministically?
              </p>
            </article>
            <article>
              <span className="research-number">03</span>
              <h3>Disclosure patterns</h3>
              <p>
                Which information is commonly disclosed, unclear, conflicting, or
                absent across a defined sample—without turning gaps into accusations?
              </p>
            </article>
          </div>
          <div className="button-row research-actions">
            <a className="button" href="/research/comprehension-study-protocol.md">
              Study protocol
            </a>
            <a className="button-secondary" href="/research/extraction-benchmark-protocol.md">
              Benchmark protocol
            </a>
            <a className="button-quiet" href="/research/results-template.csv" download>
              Results CSV template
            </a>
            <a className="button-quiet" href="/research/benchmark-template.json" download>
              Benchmark JSON template
            </a>
            <a className="button-quiet" href="/research/disclosure-audit-guide.md">
              Disclosure audit guide
            </a>
            <a className="button-quiet" href="/research/consent-and-privacy-notes.md">
              Consent & privacy notes
            </a>
            <a className="button-quiet" href="/research/README.md">
              Research kit README
            </a>
          </div>
          <p className="fine-print">
            Repository source copies are available in the `research/` directory.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="narrow-shell rule-box">
          <p>
            <strong>Privacy boundary:</strong> planned studies use random participant
            IDs, collect no names in the product, minimize demographics, avoid source
            text containing personal information, and export locally. Review the
            consent and privacy notes before recruiting anyone—especially minors.
          </p>
        </div>
        <div className="narrow-shell button-row research-actions no-print">
          <Link className="button-secondary" href="/methodology">
            Read product methodology
          </Link>
          <Link className="button-quiet" href="/data">
            Inspect schema & data
          </Link>
        </div>
      </section>
    </main>
  );
}
