import Link from "next/link";
import { SampleLauncher } from "@/components/sample-launcher";
import { UrlQuickstart } from "@/components/url-quickstart";

const resultQuestions = [
  ["Who can apply?", "Eligibility"],
  ["What does it cost?", "Cost + aid"],
  ["When and where?", "Dates + format"],
  ["Who runs it?", "Operator + relationships"],
  ["What do you get?", "Outcomes"],
  ["What is unclear?", "Needs Attention"],
] as const;

export default function HomePage() {
  return (
    <main id="main-content" className="page-main home-page">
      <section className="home-primary">
        <div className="shell home-primary-grid">
          <div className="home-primary-copy">
            <p className="eyebrow">Research the opportunity, not just the page</p>
            <h1>Know what you&apos;re applying to.</h1>
            <p className="lede">
              Paste a student opportunity. Get the practical facts, source
              evidence, and important gaps before you apply.
            </p>
            <UrlQuickstart />
            <SampleLauncher />
            <ul className="home-assurances" aria-label="What analysis provides">
              <li>Related public pages</li>
              <li>Evidence for supported claims</li>
              <li>Missing information kept visible</li>
            </ul>
          </div>

          <aside className="home-result-preview" aria-labelledby="result-preview-title">
            <div className="home-result-preview-heading">
              <p className="eyebrow">One analysis</p>
              <h2 id="result-preview-title">The answers that matter.</h2>
            </div>
            <dl>
              {resultQuestions.map(([question, answer]) => (
                <div key={question}>
                  <dt>{question}</dt>
                  <dd>{answer}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <section className="home-research" aria-labelledby="research-title">
        <div className="shell home-research-grid">
          <div className="home-research-intro">
            <p className="eyebrow">Beyond a one-page summary</p>
            <h2 id="research-title">Research across the pages that matter.</h2>
            <Link className="text-link" href="/how-it-works">
              See how the checks work <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ol className="home-research-points">
            <li>
              <span>01</span>
              <div>
                <h3>Finds relevant pages</h3>
                <p>Program details, costs, rules, terms, and other official sources.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Checks every claim</h3>
                <p>Retained facts stay tied to exact evidence you can inspect.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Shows the gaps</h3>
                <p>Missing, unclear, and conflicting information remains visible.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
