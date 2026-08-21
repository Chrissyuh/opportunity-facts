import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isHumanReviewWorkspaceEnabled } from "@/lib/review/human-review";
import { readReviewableRepositoryCard } from "@/lib/review/human-review-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Local human review workspace",
  robots: { index: false, follow: false },
};

const candidateSlugs = [
  "mites-summer-2027",
  "lumiere-research-scholar-program-fall-2026",
  "diamond-challenge-2027",
] as const;

export default async function HumanReviewIndexPage() {
  if (!isHumanReviewWorkspaceEnabled(process.env)) notFound();
  const cards = (await Promise.all(
    candidateSlugs.map((slug) => readReviewableRepositoryCard(slug)),
  )).filter((card) => card !== null);

  return (
    <main id="main-content" className="page-main">
      <header className="page-header">
        <div className="narrow-shell stack">
          <p className="eyebrow">Local-only workspace</p>
          <h1>Human review</h1>
          <p className="lede">
            Review source-to-card alignment without editing raw JSON. This route is
            unavailable in production and cannot publish a review state by itself.
          </p>
        </div>
      </header>
      <section className="narrow-shell section stack" aria-labelledby="review-candidates-title">
        <div>
          <p className="eyebrow">Recommended demonstration set</p>
          <h2 id="review-candidates-title">Three different structures</h2>
          <p>
            MITES covers a free institution-operated selective program; Lumiere covers
            paid private research with aid and affiliations; Diamond covers a team
            competition with pathways and a multi-prize outcome matrix.
          </p>
        </div>
        <div className="human-review-candidates">
          {cards.map((card) => (
            <article key={card.slug}>
              <p className="eyebrow">AI-audited - revision {card.cardVersion}</p>
              <h3>{card.facts.opportunity_name.displayValue ?? card.slug}</h3>
              <p>{card.summary}</p>
              <Link className="button-secondary" href={`/review/${card.slug}`}>Begin human review</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
