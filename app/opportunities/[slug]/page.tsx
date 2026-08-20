import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityOverview } from "@/components/opportunity-overview";
import { getAllCards, loadCardBySlug } from "@/lib/opportunity/data";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllCards().map((card) => ({ slug: card.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const card = loadCardBySlug(slug);
  if (!card) return { title: "Facts card not found" };
  return {
    title: card.facts.opportunity_name.displayValue ?? "Opportunity facts card",
    description: card.summary,
  };
}

export default async function OpportunityPage({ params }: PageProps) {
  const { slug } = await params;
  const card = loadCardBySlug(slug);
  if (!card) notFound();

  return (
    <main id="main-content" className="page-main">
      <OpportunityOverview card={card} />
    </main>
  );
}
