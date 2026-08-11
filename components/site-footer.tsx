import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-title">Opportunity Facts</p>
          <p className="footer-copy">
            Source-backed disclosure cards for student opportunities. Facts are
            reported, uncertainty is preserved, and no verdict is assigned.
          </p>
        </div>
        <nav className="footer-links" aria-label="Product links">
          <span className="footer-label">Product</span>
          <Link href="/opportunities">Browse the library</Link>
          <Link href="/compare">Compare cards</Link>
          <Link href="/build">Publish a clear card</Link>
          <Link href="/analyze">Analyze sources</Link>
        </nav>
        <nav className="footer-links" aria-label="Project links">
          <span className="footer-label">Accountability</span>
          <Link href="/methodology">Methodology & limitations</Link>
          <Link href="/data">Schema & data</Link>
          <Link href="/research">Research</Link>
          <Link href="/methodology#corrections">Correction policy</Link>
        </nav>
      </div>
    </footer>
  );
}
