import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Opportunity Facts turns public student-opportunity pages into a practical, source-backed research draft.",
};

const steps = [
  {
    title: "Paste an official opportunity page",
    text: "Start with the public page a student would normally use to learn about or apply to the opportunity.",
  },
  {
    title: "Relevant public pages are reviewed",
    text: "Opportunity Facts looks for useful pages on the same site, such as eligibility, schedule, costs, aid, rules, terms, and privacy.",
  },
  {
    title: "AI extracts practical claims",
    text: "The analyzer focuses on what a student needs to decide and plan: who can apply, when it happens, what it costs, who runs it, how selection works, and what participants receive.",
  },
  {
    title: "Evidence and scope are checked",
    text: "Before a supported claim appears, automatic checks match its excerpt to acquired source text and reject common subject, cycle, relationship, cost, and recipient mix-ups.",
  },
  {
    title: "You get an inspectable draft",
    text: "The Overview leads with useful answers. Needs Attention surfaces important gaps or conflicts. Evidence stays beside each supported fact, with optional Extended Research for more detail.",
  },
] as const;

const distinctions = [
  {
    title: "One page vs. a source set",
    text: "A single page rarely contains the complete cost, schedule, selection process, terms, and privacy information. Opportunity Facts records which relevant pages it actually checked.",
  },
  {
    title: "A citation vs. supported evidence",
    text: "A source link alone is not enough. Retained excerpts must exist in the acquired page text and remain attached to the claim they support.",
  },
  {
    title: "Missing information vs. a confident guess",
    text: "Not found, unclear, and conflicting information stays visible instead of being smoothed into a complete-looking summary.",
  },
  {
    title: "Related words vs. the right meaning",
    text: "The checks keep mentor affiliation separate from institutional partnership, project funding separate from personal cash, and historical statistics separate from the current cycle.",
  },
  {
    title: "A draft vs. a verdict",
    text: "Opportunity Facts helps inspect disclosures. It does not score legitimacy, prestige, value, safety, or whether a student should apply.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <main id="main-content" className="page-main how-page">
      <header className="how-hero">
        <div className="shell how-hero-grid">
          <div>
            <p className="eyebrow">How Opportunity Facts works</p>
            <h1>From one link to answers you can inspect.</h1>
          </div>
          <div className="how-hero-summary">
            <p className="lede">
              AI researches the public pages. Automatic checks keep supported
              claims tied to evidence and leave uncertainty visible.
            </p>
            <Link className="button" href="/analyze">
              Analyze an opportunity
            </Link>
          </div>
        </div>
      </header>

      <section className="section how-process" aria-labelledby="research-process-title">
        <div className="shell">
          <div className="section-heading how-section-heading">
            <div>
              <p className="eyebrow">The research path</p>
              <h2 id="research-process-title">Five steps, one practical result.</h2>
            </div>
            <p>
              The standard Analyze path is designed to feel complete. Extended
              Research is optional when more detailed terms or structure matter.
            </p>
          </div>
          <ol className="how-process-list">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="how-step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section how-why" aria-labelledby="why-title">
        <div className="shell">
          <div className="section-heading how-section-heading">
            <div>
              <p className="eyebrow">More than a summary</p>
              <h2 id="why-title">Why not just ask an AI to summarize the website?</h2>
            </div>
            <p>
              A fluent summary can still blur sources, subjects, years, and
              recipients. Opportunity Facts is built around those failure modes.
            </p>
          </div>
          <div className="how-distinction-grid">
            {distinctions.map((distinction, index) => (
              <article key={distinction.title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3>{distinction.title}</h3>
                <p>{distinction.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section how-underhood" aria-labelledby="underhood-title">
        <div className="shell how-underhood-grid">
          <div>
            <p className="eyebrow">Under the hood</p>
            <h2 id="underhood-title">Engineering depth without an engineering interface.</h2>
            <p>
              The model generates semantic claims. Application code validates,
              scopes, structures, and presents them. Unsupported output is withheld
              rather than polished into certainty.
            </p>
            <Link className="text-link" href="/methodology">
              Read the full methodology and limitations <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ol className="how-pipeline" aria-label="Opportunity Facts processing pipeline">
            <li><span>AI extraction</span></li>
            <li><span>Evidence validation</span></li>
            <li><span>Semantic scope checks</span></li>
            <li><span>Structured opportunity model</span></li>
            <li><span>Student-facing result</span></li>
          </ol>
        </div>
      </section>

      <section className="section how-cta">
        <div className="shell how-cta-inner">
          <div>
            <p className="eyebrow">Bring your own link</p>
            <h2>Research the opportunity you are considering.</h2>
            <p>
              Start with a public official page. You can inspect every retained
              source before relying on the result.
            </p>
          </div>
          <div className="section-action">
            <Link className="button" href="/analyze">Analyze an opportunity</Link>
            <Link className="button-secondary" href="/opportunities">View reference examples</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
