import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createPublicDataset,
  exportPublicArtifacts,
  readRepositoryCards,
  readRepositoryDrafts,
} from "../../lib/opportunity/artifacts";
import { createEmptyCard } from "../../lib/opportunity/schema";

const temporaryRoots: string[] = [];

async function makeRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "opportunity-facts-artifacts-"));
  temporaryRoots.push(root);
  await Promise.all(
    ["data/demo", "data/opportunities", "data/drafts", "public/data", "public/schema"].map(
      (directory) => mkdir(path.join(root, directory), { recursive: true }),
    ),
  );
  await cp(
    path.join(process.cwd(), "data", "demo", "lantern-bay-robotics-field-lab.json"),
    path.join(root, "data", "demo", "lantern-bay-robotics-field-lab.json"),
  );
  return root;
}

async function writeCard(
  root: string,
  directory: string,
  slug: string,
  reviewState: "draft" | "automated_draft" = "draft",
): Promise<void> {
  await writeFile(
    path.join(root, "data", directory, `${slug}.json`),
    `${JSON.stringify(createEmptyCard({ slug, reviewState }), null, 2)}\n`,
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("public artifact boundary", () => {
  it("fails closed when an unreviewed draft is placed in data/opportunities", async () => {
    const root = await makeRepository();
    await writeCard(root, "opportunities", "unreviewed-draft");

    await expect(readRepositoryCards(root)).rejects.toThrow(/ai_audited, human_reviewed, or organizer_confirmed/i);
  });

  it("fails closed when an automated draft is placed in data/opportunities", async () => {
    const root = await makeRepository();
    await writeCard(root, "opportunities", "automated-draft", "automated_draft");

    await expect(readRepositoryCards(root)).rejects.toThrow(/before publication/i);
  });

  it("fails closed when a non-demo card is placed in data/demo", async () => {
    const root = await makeRepository();
    await writeCard(root, "demo", "not-a-demo");

    await expect(readRepositoryCards(root)).rejects.toThrow(/reviewState demo/i);
  });

  it("keeps drafts out of deterministic public exports", async () => {
    const root = await makeRepository();
    await writeCard(root, "drafts", "private-work-in-progress");

    const cards = await readRepositoryCards(root);
    const drafts = await readRepositoryDrafts(root);
    expect(cards.map((card) => card.slug)).not.toContain("private-work-in-progress");
    expect(drafts.map((card) => card.slug)).toEqual(["private-work-in-progress"]);

    await expect(exportPublicArtifacts(root)).resolves.toBe(1);
    const exported = JSON.parse(
      await readFile(path.join(root, "public", "data", "opportunities.json"), "utf8"),
    ) as ReturnType<typeof createPublicDataset>;
    expect(exported).toEqual(createPublicDataset(cards));
    expect(exported.cards.map((card) => card.slug)).toEqual(["lantern-bay-robotics-field-lab"]);
  });
});
