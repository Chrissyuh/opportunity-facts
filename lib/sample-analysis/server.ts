import "server-only";

import { type SampleAnalysisId } from "./catalog";
import { sampleAnalysisSchema, type SampleAnalysis } from "./schema";

const sampleLoaders: Record<SampleAnalysisId, () => Promise<unknown>> = {
  "mites-summer": () => import("@/data/sample-analyses/mites-summer.json").then((module) => module.default),
  "diamond-challenge": () => import("@/data/sample-analyses/diamond-challenge.json").then((module) => module.default),
  "questbridge-national-college-match": () => import("@/data/sample-analyses/questbridge-national-college-match.json").then((module) => module.default),
  "yale-young-global-scholars": () => import("@/data/sample-analyses/yale-young-global-scholars.json").then((module) => module.default),
  "breakthrough-junior-challenge": () => import("@/data/sample-analyses/breakthrough-junior-challenge.json").then((module) => module.default),
};

export async function getSampleAnalysis(id: SampleAnalysisId): Promise<SampleAnalysis> {
  return sampleAnalysisSchema.parse(await sampleLoaders[id]());
}
