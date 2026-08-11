import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createPublicDataset,
  createPublicJsonSchema,
  readRepositoryCards,
  readRepositoryDrafts,
} from "../lib/opportunity/artifacts";

async function main(): Promise<void> {
  const root = process.cwd();
  const [cards, drafts] = await Promise.all([
    readRepositoryCards(root),
    readRepositoryDrafts(root),
  ]);
  const publicSlugs = new Set(cards.map((card) => card.slug));
  const duplicateDraft = drafts.find((card) => publicSlugs.has(card.slug));
  if (duplicateDraft) {
    throw new Error(`Draft ${duplicateDraft.slug} duplicates a public repository card.`);
  }

  const demoCards = cards.filter((card) => card.reviewState === "demo");
  if (demoCards.length < 6) throw new Error(`At least six demo cards are required; found ${demoCards.length}.`);
  for (const card of demoCards) {
    if (!card.sourcePagesChecked.every((source) => new URL(source.url).hostname.endsWith(".example"))) {
      throw new Error(`Demo card ${card.slug} contains a non-.example source URL.`);
    }
  }

  const exportedPath = path.join(root, "public", "data", "opportunities.json");
  const schemaPath = path.join(root, "public", "schema", "opportunity-card.schema.json");
  const expectedDataset = `${JSON.stringify(createPublicDataset(cards), null, 2)}\n`;
  const expectedSchema = `${JSON.stringify(createPublicJsonSchema(), null, 2)}\n`;
  const [actualDataset, actualSchema] = await Promise.all([
    readFile(exportedPath, "utf8"),
    readFile(schemaPath, "utf8"),
  ]);
  if (actualDataset !== expectedDataset) {
    throw new Error("public/data/opportunities.json is stale or non-deterministic; run npm run export:data.");
  }
  if (actualSchema !== expectedSchema) {
    throw new Error("public/schema/opportunity-card.schema.json is stale or tampered; run npm run export:data.");
  }

  process.stdout.write(
    `Validated ${cards.length} public cards (${demoCards.length} demo), ${drafts.length} drafts, and both public artifacts.\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
