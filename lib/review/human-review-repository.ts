import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { opportunityCardSchema, type OpportunityCard } from "@/lib/opportunity/schema";

export async function readReviewableRepositoryCard(
  slug: string,
  root = process.cwd(),
): Promise<OpportunityCard | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) return null;
  try {
    const raw = await readFile(
      path.join(root, "data", "opportunities", `${slug}.json`),
      "utf8",
    );
    const card = opportunityCardSchema.parse(JSON.parse(raw) as unknown);
    return card.reviewState === "ai_audited" ? card : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
