import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HumanReviewWorkspace } from "@/components/human-review-workspace";
import {
  buildHumanReviewManifest,
  isHumanReviewWorkspaceEnabled,
} from "@/lib/review/human-review";
import { readReviewableRepositoryCard } from "@/lib/review/human-review-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review source-to-card alignment",
  robots: { index: false, follow: false },
};

export default async function HumanReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isHumanReviewWorkspaceEnabled(process.env)) notFound();
  const { slug } = await params;
  const card = await readReviewableRepositoryCard(slug);
  if (card === null) notFound();
  const manifest = buildHumanReviewManifest(card);
  return <HumanReviewWorkspace manifest={manifest} />;
}
