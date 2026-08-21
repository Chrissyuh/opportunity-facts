import { SampleLauncher } from "@/components/sample-launcher";
import { UrlQuickstart } from "@/components/url-quickstart";

export default function HomePage() {
  return (
    <main id="main-content" className="page-main home-page">
      <section className="home-primary">
        <div className="shell home-primary-copy">
          <h1>Know what you&apos;re applying to.</h1>
          <UrlQuickstart />
          <SampleLauncher />
          <p className="home-quiet-line">Source-backed facts from the public pages that matter.</p>
        </div>
      </section>
    </main>
  );
}
