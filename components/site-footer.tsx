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
            Source-backed research for student opportunities. Supported answers
            keep their evidence, and uncertainty stays visible.
          </p>
        </div>
        <nav className="footer-links" aria-label="Product links">
          <span className="footer-label">Product</span>
          <Link href="/">Analyze</Link>
          {batchAnalysisEnabled ? <Link href="/analyze/batch">Batch analyze</Link> : null}
          <Link href="/how-it-works">How it works</Link>
        </nav>
        <nav className="footer-links" aria-label="Project links">
          <span className="footer-label">Project</span>
          <Link href="/methodology">Methodology</Link>
          <Link href="/data">Data</Link>
          <Link href="/research">Research</Link>
        </nav>
      </div>
    </footer>
  );
}
