import Link from "next/link";
import { UrlQuickstart } from "@/components/url-quickstart";
import { ReviewBadge } from "@/components/status-badge";
import { getAllCards } from "@/lib/opportunity/data";
import type { OpportunityCard } from "@/lib/opportunity/schema";

function value(card: OpportunityCard, field: keyof OpportunityCard["facts"]) {
  return card.facts[field].displayValue;
}

function ExampleCard({ card }: { card: OpportunityCard }) {
  const cost =
    value(card, "estimated_total_mandatory_cost") ??
    value(card, "tuition") ??
    "Not established";
  return (
    <article className="home-example-card">
      <div className="home-example-meta">
        <span>{value(card, "opportunity_category")}</span>
        <ReviewBadge state={card.reviewState} />
      </div>
      <h3>
        <Link href={`/opportunities/${card.slug}`}>
          {value(card, "opportunity_name") ?? card.slug}
        </Link>
      </h3>
      <dl>
        <div>
          <dt>Deadline</dt>
          <dd>{value(card, "application_deadline") ?? "Not established"}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{cost}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{value(card, "participation_format") ?? "Not established"}</dd>
        </div>
      </dl>
      <p>
        {value(card, "operating_organization") ?? "Operator not established"}
      </p>
    </article>
  );
}

export default function HomePage() {
  const realCards = getAllCards().filter((card) => card.reviewState !== "demo");
  const examples = realCards.slice(0, 3);
  return (
    <main id="main-content" className="page-main">
      <section className="home-hero home-hero-product">
        <div className="shell product-hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              AI-assisted research · source-backed results
            </p>
            <h1>Know what you’re applying to.</h1>
            <p className="lede">
              See who runs it, what it costs, what you actually get, and what
              the official pages leave unclear.
            </p>
            <UrlQuickstart />
            <div className="hero-reassurance">
              <span>AI checks related public pages</span>
              <span>Evidence stays attached</span>
              <span>Gaps stay visible</span>
            </div>
            {examples[0] ? (
              <Link
                className="sample-text-link"
                href={`/opportunities/${examples[0].slug}`}
              >
                See an analyzed example <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
          <aside
            className="hero-research-note"
            aria-label="What the analysis checks"
          >
            <p className="eyebrow">One link, practical answers</p>
            <h2>What you need before you apply.</h2>
            <ul>
              <li>Eligibility and deadlines</li>
              <li>True cost and financial aid</li>
              <li>Dates, format, and location</li>
              <li>Operator and institution relationships</li>
              <li>Selection process and outcomes</li>
              <li>Missing or conflicting information</li>
            </ul>
          </aside>
        </div>
      </section>
      <section className="home-proof">
        <div
          className="shell proof-row"
          aria-label="Opportunity Facts principles"
        >
          <div>
            <span className="proof-number">{realCards.length}</span>
            <span>
              <strong>Real reference opportunities</strong>
              <small>See what a finished record can contain</small>
            </span>
          </div>
          <div>
            <span className="proof-icon" aria-hidden="true">
              ↗
            </span>
            <span>
              <strong>Evidence beside supported claims</strong>
              <small>Official wording remains inspectable</small>
            </span>
          </div>
          <div>
            <span className="proof-icon" aria-hidden="true">
              ?
            </span>
            <span>
              <strong>Uncertainty stays visible</strong>
              <small>Missing and conflicting facts are not smoothed away</small>
            </span>
          </div>
        </div>
      </section>
      <section className="section home-examples-section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reference examples</p>
              <h2>See the research, then bring your own link.</h2>
            </div>
            <p>
              These real reference records show the output without using an
              analysis call.
            </p>
          </div>
          <div className="home-example-grid">
            {examples.map((card) => (
              <ExampleCard key={card.slug} card={card} />
            ))}
          </div>
          <div className="section-action">
            <Link className="button-secondary" href="/opportunities">
              Explore all examples
            </Link>
            <Link className="button-quiet" href="/compare">
              Compare opportunities
            </Link>
          </div>
        </div>
      </section>
      <section className="section home-how">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">How it works</p>
              <h2>Public pages become an inspectable draft.</h2>
            </div>
            <p>
              AI organizes the research. Deterministic checks withhold
              unsupported excerpts. You decide what the evidence means for you.
            </p>
          </div>
          <ol className="home-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Paste the official page</h3>
                <p>
                  Opportunity Facts finds related public program, cost, rules,
                  terms, and privacy pages.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Review supported answers</h3>
                <p>
                  Claims appear with their source excerpts. Missing access and
                  unresolved facts stay visible.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Compare or inspect deeply</h3>
                <p>
                  Use the practical Overview first, then open the Full Record
                  when every detail matters.
                </p>
              </div>
            </li>
          </ol>
          <div className="section-action">
            <Link className="button-secondary" href="/how-it-works">
              See how Opportunity Facts works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
