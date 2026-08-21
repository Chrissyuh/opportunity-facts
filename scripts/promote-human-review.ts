import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { opportunityCardSchema } from "../lib/opportunity/schema";
import {
  HUMAN_REVIEW_CONFIRMATION,
  createHumanReviewAttestation,
  promoteCardWithHumanReview,
  validateHumanReviewPacket,
} from "../lib/review/human-review";

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function main(): Promise<void> {
  const packetArgument = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!packetArgument || packetArgument.startsWith("--")) {
    throw new Error("Usage: npm run review:promote -- <downloaded-review-packet.json> [--dry-run]");
  }

  const root = process.cwd();
  const packetPath = path.resolve(root, packetArgument);
  const packetInput = JSON.parse(await readFile(packetPath, "utf8")) as unknown;
  const packetSlug = typeof packetInput === "object" && packetInput !== null &&
    "slug" in packetInput && typeof packetInput.slug === "string"
    ? packetInput.slug
    : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(packetSlug)) {
    throw new Error("The review packet does not contain a safe card slug.");
  }
  const cardPath = path.join(root, "data", "opportunities", `${packetSlug}.json`);
  const card = opportunityCardSchema.parse(
    JSON.parse(await readFile(cardPath, "utf8")) as unknown,
  );
  const packet = validateHumanReviewPacket(card, packetInput);

  if (dryRun) {
    process.stdout.write(
      `Review packet is complete and current for ${packet.slug}; no files were changed.\n`,
    );
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Human review promotion must run in an interactive terminal; automated and redirected execution is refused.",
    );
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let typedConfirmation = "";
  try {
    process.stdout.write(
      `\nThis changes ${packet.slug} from AI-audited to Human reviewed.\n` +
      "It means you personally checked the source-to-card alignment; it does not certify the organizer or opportunity.\n\n" +
      `Type this exact sentence to continue:\n${HUMAN_REVIEW_CONFIRMATION}\n\n`,
    );
    typedConfirmation = await prompt.question("> ");
  } finally {
    prompt.close();
  }

  const reviewedAt = new Date().toISOString();
  const attestation = createHumanReviewAttestation(card, packet, {
    isInteractiveHuman: true,
    confirmationText: typedConfirmation.trim(),
    reviewedAt,
  });
  const promoted = opportunityCardSchema.parse(
    promoteCardWithHumanReview(card, attestation),
  );
  const reviewDirectory = path.join(root, "data", "reviews");
  const attestationPath = path.join(
    reviewDirectory,
    `${card.slug}.human-review.json`,
  );
  await mkdir(reviewDirectory, { recursive: true });
  await writeJsonAtomically(attestationPath, attestation);
  await writeJsonAtomically(cardPath, promoted);

  process.stdout.write(
    `Promoted ${card.slug} to Human reviewed at card revision ${promoted.cardVersion}.\n` +
    "Run npm run export:data and npm run validate:data before committing.\n",
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
