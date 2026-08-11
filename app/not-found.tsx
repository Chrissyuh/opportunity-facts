import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="page-main">
      <div className="narrow-shell section stack">
        <p className="eyebrow">404 · Record not found</p>
        <h1>This page is not in the file.</h1>
        <p className="lede">
          The address may be wrong, or this Opportunity Facts card may have
          moved.
        </p>
        <div className="button-row">
          <Link className="button" href="/opportunities">
            Browse opportunities
          </Link>
          <Link className="button-secondary" href="/">
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
