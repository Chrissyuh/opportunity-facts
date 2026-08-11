import Link from "next/link";
import { UrlQuickstart } from "@/components/url-quickstart";

const sampleSlug = "lantern-bay-robotics-field-lab";

export default function HomePage() {
  return (
    <main id="main-content" className="page-main">
      <section className="home-hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Source-backed student opportunity disclosures</p>
            <h1>Know what you’re applying to.</h1>
            <p className="lede">
              Turn a student opportunity into a clear, source-backed facts card.
            </p>
            <UrlQuickstart />
            <div className="button-row hero-actions">
              <Link className="button-secondary" href={`/opportunities/${sampleSlug}`}>
                Try a sample
              </Link>
              <Link className="button-quiet" href="/build">
                Create one manually
              </Link>
            </div>
            <div className="rule-box hero-clarification">
              <p>
                Opportunity Facts reports what reviewed sources disclose. It does
                not rate legitimacy, quality, prestige, or value.
              </p>
            </div>
          </div>

          <Link
            className="sample-sheet"
            href={`/opportunities/${sampleSlug}`}
            aria-label="Open the Lantern Bay Robotics Field Lab sample facts card"
          >
            <div className="sample-sheet-top">
              <span className="demo-ribbon">Demo data</span>
              <span className="sample-file-number">OF · SAMPLE 01</span>
            </div>
            <div className="sample-title-row">
              <div>
                <span className="sample-kicker">Summer program · Residential</span>
                <h2>Lantern Bay Robotics Field Lab</h2>
              </div>
              <span className="sample-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
            <dl className="sample-facts">
              <div>
                <dt>Operated by</dt>
                <dd>
                  <span>Lantern Bay Learning Cooperative</span>
                  <span className="status-badge status-disclosed">Disclosed</span>
                </dd>
              </div>
              <div>
                <dt>Institution relationship</dt>
                <dd>
                  <span>Hosted at — not institution-operated</span>
                  <span className="status-badge status-disclosed">Disclosed</span>
                </dd>
              </div>
              <div>
                <dt>Refund policy</dt>
                <dd>
                  <span>Two official pages give different deadlines</span>
                  <span className="status-badge status-conflicting">Conflicting</span>
                </dd>
              </div>
              <div>
                <dt>College credit</dt>
                <dd>
                  <span>Not found in the pages checked</span>
                  <span className="status-badge status-not_found">Not found</span>
                </dd>
              </div>
            </dl>
            <div className="sample-sheet-footer">
              <span>Open the complete card</span>
              <span>Evidence attached to each fact</span>
            </div>
          </Link>
        </div>
      </section>

      <section className="home-proof">
        <div className="shell proof-row" aria-label="Opportunity Facts principles">
          <div>
            <span className="proof-label">One shared format</span>
            <strong>Identity · cost · dates · selection · outcomes · terms</strong>
          </div>
          <div>
            <span className="proof-label">Every disclosed value</span>
            <strong>Source URL + exact excerpt + access date</strong>
          </div>
          <div>
            <span className="proof-label">No verdict layer</span>
            <strong>Compare facts without declaring a winner</strong>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A disclosure workflow</p>
              <h2>From scattered pages to one inspectable record.</h2>
            </div>
            <p>
              The system keeps the source trail visible. Automation can organize
              evidence, but it cannot turn ambiguity into certainty.
            </p>
          </div>
          <ol className="home-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Add the source</h3>
                <p>
                  Paste a public URL, add source text for a blocked page, or build a
                  card manually.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Inspect the evidence</h3>
                <p>
                  Review the operator, real cost, schedule, selection evidence,
                  outcomes, and material terms with excerpts attached.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Correct or compare</h3>
                <p>
                  Edit a draft, export the record, prepare a correction packet, or
                  line up two or three cards without a winner label.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="section uncertainty-section">
        <div className="shell uncertainty-grid">
          <div>
            <p className="eyebrow">Make uncertainty visible</p>
            <h2>Missing is a finding. Conflict is a finding.</h2>
            <p className="lede">
              A blank field hides what happened. A status explains what the reviewed
              sources did—or did not—support.
            </p>
            <div className="button-row uncertainty-actions">
              <Link className="button" href="/opportunities">
                Browse demo cards
              </Link>
              <Link className="button-secondary" href="/methodology#language">
                Read status definitions
              </Link>
            </div>
          </div>
          <dl className="status-ledger">
            <div>
              <dt><span className="status-badge status-disclosed">Disclosed</span></dt>
              <dd>An identified source states the information.</dd>
            </div>
            <div>
              <dt><span className="status-badge status-not_found">Not found</span></dt>
              <dd>It was not located in the identified pages reviewed.</dd>
            </div>
            <div>
              <dt><span className="status-badge status-unclear">Unclear</span></dt>
              <dd>Relevant wording does not support one precise value.</dd>
            </div>
            <div>
              <dt><span className="status-badge status-conflicting">Conflicting</span></dt>
              <dd>Reviewed sources support different current values.</dd>
            </div>
            <div>
              <dt><span className="status-badge status-not_applicable">Not applicable</span></dt>
              <dd>The fact does not apply to this opportunity.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="section home-final">
        <div className="shell home-final-inner">
          <div>
            <p className="eyebrow">Bring your own evidence</p>
            <h2>Publish a clear Opportunity Facts card.</h2>
            <p>
              The builder uses the same schema as the public library. Save locally,
              import or export JSON, and never claim human review without checking
              the cited sources.
            </p>
          </div>
          <Link className="button" href="/build">
            Open the card builder
          </Link>
        </div>
      </section>
    </main>
  );
}
