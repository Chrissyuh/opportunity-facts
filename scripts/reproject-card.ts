import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import {
  applyOpportunityProjections,
  opportunityCardProjectionInputSchema,
  opportunityCardSchema,
} from "../lib/opportunity";

const requestedPath = process.argv[2];
if (!requestedPath) {
  throw new Error("Usage: npm run reproject:card -- <repository-card.json>");
}

const repositoryRoot = process.cwd();
const requestedCardPath = isAbsolute(requestedPath) ? requestedPath : resolve(repositoryRoot, requestedPath);
const cardPath = realpathSync(requestedCardPath);
const allowedRoots = ["demo", "drafts", "opportunities"].map((directory) =>
  realpathSync(resolve(repositoryRoot, "data", directory)),
);
const allowedRoot = allowedRoots.find((root) => {
  const candidate = relative(root, cardPath);
  return candidate !== "" && !candidate.startsWith("..") && !isAbsolute(candidate);
});
const relativePath = relative(repositoryRoot, cardPath);
if (
  allowedRoot === undefined ||
  isAbsolute(relativePath) ||
  !relativePath.toLowerCase().endsWith(".json")
) {
  throw new Error("The card must be an existing JSON file under data/demo, data/drafts, or data/opportunities.");
}

const structuralCard = opportunityCardProjectionInputSchema.parse(
  JSON.parse(readFileSync(cardPath, "utf8")),
);
const projectedCard = opportunityCardSchema.parse(
  applyOpportunityProjections(structuralCard),
);
writeFileSync(cardPath, `${JSON.stringify(projectedCard, null, 2)}\n`, "utf8");
process.stdout.write(`Reprojected ${relativePath}.\n`);
