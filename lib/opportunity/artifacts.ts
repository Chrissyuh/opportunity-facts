import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  SCHEMA_VERSION,
  opportunityCardSchema,
  type OpportunityCard,
} from "./schema";

async function jsonCardFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directory, entry.name));
}

async function readCardDirectory(
  directory: string,
  acceptsState: (state: OpportunityCard["reviewState"]) => boolean,
  stateMessage: string,
): Promise<OpportunityCard[]> {
  const files = (await jsonCardFiles(directory)).sort();
  const cards = await Promise.all(
    files.map(async (filePath) => {
      const input = JSON.parse(await readFile(filePath, "utf8")) as unknown;
      const card = opportunityCardSchema.parse(input);
      if (path.basename(filePath) !== `${card.slug}.json`) {
        throw new Error(`${filePath} must be named ${card.slug}.json.`);
      }
      if (!acceptsState(card.reviewState)) {
        throw new Error(`${filePath} ${stateMessage}`);
      }
      return card;
    }),
  );
  return cards;
}

function requireUniqueSlugs(cards: readonly OpportunityCard[], label: string): void {
  const uniqueSlugs = new Set(cards.map((card) => card.slug));
  if (uniqueSlugs.size !== cards.length) throw new Error(`${label} contain duplicate slugs.`);
}

function requireUniqueOpportunityCycles(
  cards: readonly OpportunityCard[],
  label: string,
): void {
  const seen = new Set<string>();
  for (const card of cards) {
    if (card.opportunityId === null || card.cycle.status !== "modeled") continue;
    const key = `${card.opportunityId}\u0000${card.cycle.value.id}`;
    if (seen.has(key)) {
      throw new Error(
        `${label} contain duplicate opportunity/cycle identity ${card.opportunityId} / ${card.cycle.value.id}.`,
      );
    }
    seen.add(key);
  }
}

export async function readRepositoryCards(root = process.cwd()): Promise<OpportunityCard[]> {
  const [demoCards, reviewedCards] = await Promise.all([
    readCardDirectory(
      path.join(root, "data", "demo"),
      (state) => state === "demo",
      "must use reviewState demo because it is in data/demo.",
    ),
    readCardDirectory(
      path.join(root, "data", "opportunities"),
      (state) => state === "human_reviewed" || state === "organizer_confirmed",
      "must be human_reviewed or organizer_confirmed before publication.",
    ),
  ]);
  const cards = [...demoCards, ...reviewedCards];
  requireUniqueSlugs(cards, "Public repository cards");
  requireUniqueOpportunityCycles(cards, "Public repository cards");
  return cards.sort((left, right) => left.slug.localeCompare(right.slug));
}

export async function readRepositoryDrafts(root = process.cwd()): Promise<OpportunityCard[]> {
  const cards = await readCardDirectory(
    path.join(root, "data", "drafts"),
    (state) => state === "draft",
    "must use reviewState draft; move reviewed cards to data/opportunities before publication.",
  );
  requireUniqueSlugs(cards, "Repository drafts");
  requireUniqueOpportunityCycles(cards, "Repository drafts");
  return cards.sort((left, right) => left.slug.localeCompare(right.slug));
}

function reproducibleGeneratedAt(cards: readonly OpportunityCard[]): string {
  const timestamps = cards.flatMap((card) => [
    ...(card.reviewedAt === null ? [] : [card.reviewedAt]),
    ...card.sourcePagesChecked.map((source) => source.accessedAt),
  ]);
  return timestamps.sort().at(-1) ?? "1970-01-01T00:00:00Z";
}

export function createPublicDataset(cards: readonly OpportunityCard[]) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: reproducibleGeneratedAt(cards),
    cards,
  };
}

const publicDatasetSchema = z
  .strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    generatedAt: z.string().datetime({ offset: true }),
    cards: z.array(opportunityCardSchema),
  })
  .superRefine((dataset, context) => {
    const slugs = new Set<string>();
    const opportunityCycles = new Set<string>();
    dataset.cards.forEach((card, index) => {
      if (
        card.reviewState !== "demo" &&
        card.reviewState !== "human_reviewed" &&
        card.reviewState !== "organizer_confirmed"
      ) {
        context.addIssue({
          code: "custom",
          path: ["cards", index, "reviewState"],
          message: "A public dataset cannot contain draft cards.",
        });
      }
      if (slugs.has(card.slug)) {
        context.addIssue({
          code: "custom",
          path: ["cards", index, "slug"],
          message: "A public dataset cannot contain duplicate slugs.",
        });
      }
      slugs.add(card.slug);
      if (card.opportunityId !== null && card.cycle.status === "modeled") {
        const key = `${card.opportunityId}\u0000${card.cycle.value.id}`;
        if (opportunityCycles.has(key)) {
          context.addIssue({
            code: "custom",
            path: ["cards", index, "cycle"],
            message: "A public dataset cannot contain a duplicate opportunity/cycle identity.",
          });
        }
        opportunityCycles.add(key);
      }
    });
  });

export function parsePublicDataset(input: unknown) {
  return publicDatasetSchema.parse(input);
}

export function createPublicJsonSchema() {
  const jsonSchema = z.toJSONSchema(opportunityCardSchema, {
    target: "draft-2020-12",
    reused: "ref",
  });
  return {
    ...jsonSchema,
    $id: "https://opportunityfacts.example/schema/opportunity-card.schema.json",
    title: "Opportunity Facts card",
    description:
      "Machine-readable shape for an Opportunity Facts schema v2 card. Cross-field evidence, structured-reference, migration, and deterministic-projection invariants are additionally enforced by the authoritative Zod schema.",
  };
}

export async function exportPublicArtifacts(root = process.cwd()): Promise<number> {
  const cards = await readRepositoryCards(root);
  const dataDirectory = path.join(root, "public", "data");
  const schemaDirectory = path.join(root, "public", "schema");
  await Promise.all([
    mkdir(dataDirectory, { recursive: true }),
    mkdir(schemaDirectory, { recursive: true }),
  ]);

  await writeFile(
    path.join(dataDirectory, "opportunities.json"),
    `${JSON.stringify(createPublicDataset(cards), null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(schemaDirectory, "opportunity-card.schema.json"),
    `${JSON.stringify(createPublicJsonSchema(), null, 2)}\n`,
    "utf8",
  );

  return cards.length;
}
