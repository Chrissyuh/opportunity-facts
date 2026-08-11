import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createEmptyCard } from "../lib/opportunity/schema";
import { exportOpportunityCardJson } from "../lib/opportunity/serialization";

async function main(): Promise<void> {
  const slug = process.argv[2]?.trim();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Usage: npm run create:card -- <lowercase-kebab-case-slug>");
  }

  const directory = path.join(process.cwd(), "data", "drafts");
  const filePath = path.join(directory, `${slug}.json`);
  await mkdir(directory, { recursive: true });
  try {
    await access(filePath);
    throw new Error(`Refusing to overwrite existing card: ${filePath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
  }

  const card = createEmptyCard({ slug });
  await writeFile(filePath, exportOpportunityCardJson(card), { encoding: "utf8", flag: "wx" });
  process.stdout.write(`Created ${filePath}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
