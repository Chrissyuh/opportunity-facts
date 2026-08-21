import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Opportunity Facts finds, labels, validates, and updates source-backed facts.",
};

const statuses = [
  ["Disclosed", "An identified source states the information."],
  ["Not found", "The fact was not located in the identified pages reviewed."],
  ["Unclear", "Relevant wording exists, but it does not support one precise value."],
  ["Conflicting", "Two or more reviewed sources support different current values."],
  ["Not applicable", "The fact does not apply to this opportunity."],
] as const;

export default function MethodologyPage() {
  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="shell page-header-grid">
          <div>
            <p className="eyebrow">Methodology · Schema 2.2.0</p>
            <h1>Facts, with their uncertainty attached.</h1>
          </div>
          <p className="lede">
            Opportunity Facts standardizes disclosures. It does not independently
            audit organizations or turn missing information into a verdict.
          </p>
        </div>
      </header>

      <div className="narrow-shell section prose">
        <div className="rule-box">
          <p>
            <strong>The short version:</strong> review identified sources, extract
            only supported claims, match every excerpt back to its page, normalize
            without replacing the original wording, and show gaps or conflicts.
          </p>
        </div>

        <h2 id="language">What the labels mean</h2>
        <p>
          “Disclosed” means an identified source states a fact. It does not mean
          Opportunity Facts independently proved the statement true. “Automated
          draft” is normal analyzer output after deterministic retention checks.
          “AI-audited” means a separate AI-assisted pass checked source, value,
          excerpt, scope, and projection alignment; no person completed the full
          review. “Human reviewed” is reserved for a person’s independent
          source-by-source check. “Organizer confirmed” records organizer
          involvement and is not independent verification.
        </p>
        <dl className="definition-list">
          {statuses.map(([term, description]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>

        <h2 id="process">The review process</h2>
        <ol className="method-steps">
          <li>
            <strong>Separate organizations and roles.</strong> Record each named
            organization, who operates, manages, or administers the opportunity,
            and each institution relationship separately. Location, alumni
            involvement, or branding alone never proves operation or endorsement.
          </li>
          <li>
            <strong>Review a bounded source set.</strong> Start with the submitted
            page and relevant same-origin FAQ, cost, aid, eligibility,
            rules, terms, privacy, refund, award, and schedule pages. Record every
            page checked. Automated analysis labels these pages user supplied; URL
            shape and same-origin discovery do not prove official provenance.
          </li>
          <li>
            <strong>Attach evidence to atomic values.</strong> Every displayed
            factual value—including a role, tier scope, stage date, price,
            condition, recipient, or distribution—needs a URL, page title, source
            type, excerpt, and access date. Unclear claims cite the ambiguous text;
            not-found and not-applicable claims show reasons instead of hidden values.
          </li>
          <li>
            <strong>Validate excerpts deterministically.</strong> Machine-assisted
            citations are shown only when normalized excerpt text can be found in
            the normalized source. A mismatch removes support and is reported as a
            validation warning.
          </li>
          <li>
            <strong>Normalize and scope carefully.</strong> Dates, money, duration,
            hours, counts, formats, and relationship categories receive comparable
          representations while the source wording remains available. Variant,
            stage, and pathway references preserve where each value applies. A
            modeled cost ledger is separately marked complete or incomplete; only
            a complete, compatible ledger can produce a calculated total.
          </li>
          <li>
            <strong>Preserve disagreement.</strong> Supported conflicts stay on the
            card. Calculated acceptance rates show their published numerator and
            denominator and require a human to confirm both counts describe the same
            population and cycle; organizer-stated rates remain labeled as such.
          </li>
          <li>
            <strong>Project, do not flatten.</strong> The stable 59-field summary is
            generated from structured records where they apply. Multiple legitimate
            tier, track, stage, or pathway values stay visible as a matrix/list with
            no invented universal scalar.
          </li>
        </ol>

        <h2 id="core-facts">The 13 core assessment areas</h2>
        <p>
          The meter leads with “X of Y applicable core facts disclosed” so the
          useful disclosure result is not hidden behind assessment coverage. Its
          detail begins “X of 13 core areas assessed,” then lists nonzero
          not-found, unclear, conflicting, not-applicable, and draft-unassessed
          counts in that order. It is not a trust, quality, or value score. Not applicable is excluded
          from the applicable denominator; a conflict remains visible but is not
          clean disclosure. The exact dimensions and all supported fields are
          published in the{" "}
          <Link href="/data">schema and data documentation</Link>.
        </p>

        <h2 id="automation">Where automation stops</h2>
        <p>
          Automated extraction uses bounded summary and structured sections over fetched or
          pasted source text. Source pages are treated as hostile data: instructions
          inside them cannot change the extraction job. No model decides whether an
          opportunity is legitimate, prestigious, worthwhile, safe, or likely to
          affect admission. Automatic drafts do not derive an acceptance rate because
          count population and cycle compatibility need human review.
        </p>
        <p>
          The shared model-input budget is distributed across every reviewed page.
          When any page is shortened for that budget, the analysis record says so.
          Model requests use a fixed timeout and no automatic retries.
        </p>
        <p>
          URL fetching uses public HTTP(S) only, validates DNS and every redirect,
          limits time and bytes, avoids cookies and authentication, and never runs
          page scripts. Bounded allowlisted Schema.org course and FAQ metadata in a
          static response is treated as untrusted publisher text. JavaScript-only,
          blocked, or inaccessible sites can instead be reviewed through pasted source text.
        </p>
        <p>
          Automated results are drafts. Sources were collected automatically,
          inaccessible or missed pages can create omissions, and every excerpt still
          needs human checking. A draft cannot establish truth, legitimacy, quality,
          prestige, or value. AI-audited and human-reviewed are separate labels:
          only the latter states that a person completed the source-by-source review.
        </p>

        <h2 id="evaluation">Development and out-of-sample evaluation</h2>
        <p>
          TechRise, Lumiere, and Diamond Challenge formed a three-card development
          set used to diagnose and repair extraction failures. A separate set of
          seven opportunities was then selected and preregistered before inference;
          its reviewed cards were frozen before one production extraction run per
          opportunity. The extractor was not tuned on those seven before their
          reported results were frozen.
        </p>
        <p>
          On that small preregistered set, evidence attachments were usually
          semantically relevant, but claim agreement and structured recall were much
          weaker and four materially misleading claims survived. These results do
          not establish population-level accuracy. They support only the narrower
          conclusion that automation can prepare a partial draft for mandatory human
          review. Full denominators, failures, and limitations are published in the
          repository evaluation report.
        </p>
        <p>
          The frozen development and out-of-sample reports retain the review-state
          terminology used when they were written. Current reference cards without
          a documented person-led review are labeled AI-audited because their source
          audit was completed by AI/Codex. That provenance correction did not alter
          their evidence or any historical benchmark result.
        </p>

        <h2 id="structured-model">Why the card has structured detail</h2>
        <p>
          A single row cannot truthfully represent four tuition tiers, two selection
          routes, several organizations, or a prize matrix. Schema 2.2.0 keeps the 59
          summary fields for scanning and adds source-backed cycle, organization,
          program/cohort, stage/pathway, cost, and outcome records. Cards and
          comparison reveal those details progressively; summary projections are
          recomputed and rejected if they drift from their contributing claims.
        </p>
        <p>
          Legacy schema 1.0 files can be imported only as new draft revisions. The
          migration preserves their facts and evidence but clears review status and
          leaves all new structured sections unassessed. A reviewer must supply—not
          infer—the cycle, roles, scopes, pathways, recipients, and funding types
          before publication.
        </p>

        <h2 id="limitations">Limitations</h2>
        <ul>
          <li>Official pages can be incomplete, outdated, changed, or inaccurate.</li>
          <li>A “not found” result covers only the pages listed on that card.</li>
          <li>Normalization cannot resolve ambiguous legal or financial language.</li>
          <li>A matrix/list may be the truthful comparison result when no universal scalar exists.</li>
          <li>Automated link discovery is deliberately narrow and may miss a page.</li>
          <li>Automated analysis does not verify that a submitted or discovered page is official.</li>
          <li>Access dates do not create a permanent archive of source content.</li>
          <li>Review states describe process, not the underlying organization.</li>
          <li>This product is informational and is not legal or financial advice.</li>
        </ul>

        <h2 id="corrections">Correction policy</h2>
        <p>
          Anyone can generate a correction packet from a facts card without an
          account. A useful correction identifies the field, proposed replacement,
          source URL, exact excerpt, and reason. Packets can be downloaded as JSON
          and Markdown or copied for another channel. When a repository address is
          configured, the app can also prepare a GitHub issue; GitHub is optional.
        </p>
        <p>
          Corrections do not silently overwrite public cards. A reviewer checks the
          cited evidence, records the review date, updates conflicts if needed, and
          increments the card version when the public facts change.
        </p>

        <h2 id="versioning">Versioning and retention</h2>
        <p>
          Schema changes increment the schema version. Cycle identity remains
          separate from card revision. Material public-card changes increment the
          card version and reviewed date. Public demo/reviewed cards
          live in repository JSON; user-created drafts and comparison choices stay
          in that browser. Submitted page text is processed for the response and is
          not intentionally stored by Opportunity Facts.
        </p>
      </div>
    </main>
  );
}
