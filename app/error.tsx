"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="page-main">
      <div className="narrow-shell section stack">
        <p className="eyebrow">Application error</p>
        <h1>This record could not be opened.</h1>
        <p className="lede">
          No submitted source data was saved. Try the request again or return to
          the library.
        </p>
        <div className="button-row">
          <button className="button" type="button" onClick={reset}>
            Try again
          </button>
          <Link className="button-secondary" href="/opportunities">
            Browse opportunities
          </Link>
        </div>
      </div>
    </main>
  );
}
