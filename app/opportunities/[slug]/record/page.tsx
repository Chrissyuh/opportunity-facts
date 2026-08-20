import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FullRecordWorkspace } from "@/components/full-record-workspace";
import { getAllCards, loadCardBySlug } from "@/lib/opportunity/data";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllCards().map((card) => ({ slug: card.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const card = loadCardBySlug((await params).slug);
  return { title: card ? `${card.facts.opportunity_name.displayValue ?? card.slug} — Full record` : "Record not found" };
}

export default async function RecordPage({ params }: PageProps) {
  const card = loadCardBySlug((await params).slug);
  if (!card) notFound();
  return <main id="main-content" className="page-main record-page"><FullRecordWorkspace card={card} /></main>;
}
