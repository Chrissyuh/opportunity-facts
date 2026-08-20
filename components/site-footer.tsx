import Link from "next/link";

export function SiteFooter({
  batchAnalysisEnabled,
}: {
  batchAnalysisEnabled: boolean;
}) {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-title">Opportunity Facts</p>
          <p className="footer-copy">
            AI-assisted research for student opportunities. Supported answers keep
            their source evidence, and uncertainty stays visible.
          </p>
        </div>
        <nav className="footer-links" aria-label="Product links">
          <span className="footer-label">Product</span>
          <Link href="/analyze">Analyze an opportunity</Link>
          {batchAnalysisEnabled ? <Link href="/analyze/batch">Batch analyze</Link> : null}
          <Link href="/compare">Compare opportunities</Link>
          <Link href="/opportunities">Reviewed examples</Link>
        </nav>
        <nav className="footer-links" aria-label="Project links">
          <span className="footer-label">Learn</span>
          <Link href="/methodology">How it works & limitations</Link>
          <Link href="/build">Manual card builder</Link>
          <Link href="/data">Schema & data</Link>
          <Link href="/research">Research</Link>
          <Link href="/methodology#corrections">Correction policy</Link>
        </nav>
      </div>
    </footer>
  );
}
