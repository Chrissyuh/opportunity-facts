import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Schema & data",
  description:
    "Download the Opportunity Facts schema and public reviewed/demo dataset.",
};

export default function DataPage() {
  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Open format · Versioned records</p>
            <h1>The card is portable by design.</h1>
          </div>
          <p className="lede">
            Schema 2.0 drives the card renderer, builder, comparison, validation,
            import/export, and structured evidence contract.
          </p>
        </div>
      </header>

      <div className="shell section data-grid">
        <section className="panel panel-pad stack" aria-labelledby="downloads-title">
          <div>
            <p className="eyebrow">Downloads</p>
            <h2 id="downloads-title">Use the same records we do.</h2>
          </div>
          <p>
            The current public dataset contains ten human-reviewed real cards and
            seven fictional demonstration cards. Each `.example` record remains
            visibly labeled and exists to exercise the product—not to describe a real
            organization.
          </p>
          <div className="button-row">
            <a className="button" href="/api/dataset" download>
              Download dataset JSON
            </a>
            <a className="button-secondary" href="/api/schema" download>
              Download JSON Schema
            </a>
          </div>
        </section>

        <section className="panel panel-pad stack" aria-labelledby="contribute-title">
          <div>
            <p className="eyebrow">Contribute</p>
            <h2 id="contribute-title">Add a reviewed card.</h2>
          </div>
          <ol className="compact-steps">
            <li>Collect official URLs and preserve exact supporting excerpts.</li>
            <li>Create a JSON draft using the shared builder or repository script.</li>
            <li>Run schema and dataset validation locally.</li>
            <li>Complete the source/review checklist and record the review date.</li>
            <li>Submit the record for independent review before publication.</li>
          </ol>
          <p className="fine-print">
            Do not mark a card human reviewed until every displayed value and excerpt
            has actually been checked against its cited page.
          </p>
        </section>
      </div>

      <section className="section">
        <div className="narrow-shell prose">
          <h2>Record semantics</h2>
          <p>
            Each card stores cycle-independent identity, a modeled cycle, atomic
            structured claims, and a 59-field summary map keyed by the central
            registry. Structured records preserve organization roles, variants,
            stages/pathways, scoped costs, and outcomes; mapped summary facts record
            the exact claim references used to generate them. Cost ledgers separately
            state whether the reviewed inventory is complete. A source records its
            URL, title, excerpt, provenance category, and access date.
          </p>
          <p>
            Imports are validated before they reach rendering or browser storage.
            Valid schema 1.0 cards migrate only to unassessed draft schema 2.0
            revisions; unknown or malformed structures return a readable error
            rather than being partially accepted.
          </p>
          <h2>Public data boundary</h2>
          <p>
            Repository JSON under `data/demo` is fictional. Human-reviewed records
            belong under `data/opportunities`. Browser-created drafts are not added
            to the public dataset automatically, and the server does not provide a
            hidden permanent store.
          </p>
          <p>
            Three reviewed cards formed the extraction development set. Seven more
            were selected before inference and evaluated once as a preregistered
            out-of-sample set. Their reviewed cards are public records; the automated
            outputs remain separate evaluation artifacts and never replace them.
          </p>
          <div className="button-row no-print">
            <Link className="button" href="/build">
              Create a local card
            </Link>
            <Link className="button-secondary" href="/methodology">
              Read the methodology
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
