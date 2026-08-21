import "server-only";

import { type SampleAnalysisId } from "./catalog";
import { sampleAnalysisSchema, type SampleAnalysis } from "./schema";

const sampleLoaders: Record<SampleAnalysisId, () => Promise<unknown>> = {
  "horizon-academic-essay-prize": () => import("@/data/sample-analyses/horizon-academic-essay-prize.json").then((module) => module.default),
  "youngarts-national-arts-competition": () => import("@/data/sample-analyses/youngarts-national-arts-competition.json").then((module) => module.default),
  "american-rocketry-challenge": () => import("@/data/sample-analyses/american-rocketry-challenge.json").then((module) => module.default),
  "ocean-awareness-contest": () => import("@/data/sample-analyses/ocean-awareness-contest.json").then((module) => module.default),
  "flmd-2026-high-school-essay-contest": () => import("@/data/sample-analyses/flmd-2026-high-school-essay-contest.json").then((module) => module.default),
};

export async function getSampleAnalysis(id: SampleAnalysisId): Promise<SampleAnalysis> {
  return sampleAnalysisSchema.parse(await sampleLoaders[id]());
}
