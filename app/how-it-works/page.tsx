import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Opportunity Facts researches public student-opportunity pages and returns source-backed answers.",
};

const steps = [
  ["Paste", "Start with an official opportunity page."],
  ["Find", "Review useful pages on the same public site."],
  ["Extract", "Identify the practical claims a student needs."],
  ["Check", "Validate evidence, scope, cycle, and recipient."],
  ["Review", "See answers, gaps, sources, and optional Extended Research."],
] as const;

const comparisonRows = [
  ["Page coverage", "Usually the page provided", "The page plus relevant official sources"],
  ["Evidence", "Links or citations", "Exact retained excerpts beside supported claims"],
  ["Uncertainty", "Often smoothed over", "Not found, unclear, and conflicting stay visible"],
  ["Meaning", "Plausible wording", "Scope, cycle, relationship, and recipient checks"],
] as const;

export default function HowItWorksPage() {
  return (
    <main id="main-content" className="page-main how-compact-page">
      <header className="how-compact-hero">
        <div className="shell how-compact-hero-grid">
          <div>
            <p className="eyebrow">How it works</p>
            <h1>From one link to answers you can inspect.</h1>
          </div>
          <div>
            <p>
              AI researches the public pages. Deterministic checks keep supported
              claims tied to evidence and leave uncertainty visible.
            </p>
            <Link className="button" href="/">
              Analyze an opportunity
            </Link>
          </div>
        </div>
      </header>

      <section className="how-compact-process" aria-labelledby="process-title">
        <div className="shell">
          <div className="how-compact-section-heading">
            <p className="eyebrow">The research path</p>
            <h2 id="process-title">Five steps. One practical result.</h2>
          </div>
          <ol className="how-compact-steps">
            {steps.map(([title, text], index) => (
              <li key={title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="how-compact-comparison" aria-labelledby="comparison-title">
        <div className="shell how-compact-comparison-grid">
          <div className="how-compact-comparison-intro">
            <p className="eyebrow">More than a summary</p>
            <h2 id="comparison-title">Why not just summarize the website?</h2>
            <p>
              A fluent summary can still blur sources, subjects, years, and
              recipients. Opportunity Facts is built around those failure modes.
            </p>
          </div>
          <div
            className="how-comparison-table-wrap"
            role="region"
            aria-label="Comparison of a typical summary and Opportunity Facts"
            tabIndex={0}
          >
            <table className="how-comparison-table">
              <thead>
                <tr>
                  <th scope="col">Check</th>
                  <th scope="col">Typical summary</th>
                  <th scope="col">Opportunity Facts</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([check, summary, facts]) => (
                  <tr key={check}>
                    <th scope="row">{check}</th>
                    <td>{summary}</td>
                    <td>{facts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="how-compact-underhood" aria-labelledby="underhood-title">
        <div className="shell how-compact-underhood-inner">
          <div>
            <p className="eyebrow">Under the hood</p>
            <h2 id="underhood-title">Engineering depth, kept out of your way.</h2>
          </div>
          <p className="how-compact-pipeline">
            <span>AI extraction</span>
            <span aria-hidden="true">→</span>
            <span>Evidence validation</span>
            <span aria-hidden="true">→</span>
            <span>Semantic scope checks</span>
            <span aria-hidden="true">→</span>
            <span>Student-facing result</span>
          </p>
          <Link className="text-link" href="/methodology">
            Read the methodology <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
