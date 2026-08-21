export const SAMPLE_ANALYSIS_CATALOG = [
  {
    id: "horizon-academic-essay-prize",
    label: "Horizon Academic Essay Prize",
    category: "International academic essay competition",
  },
  {
    id: "youngarts-national-arts-competition",
    label: "YoungArts National Arts Competition",
    category: "National multidisciplinary arts competition",
  },
  {
    id: "american-rocketry-challenge",
    label: "American Rocketry Challenge",
    category: "Team engineering competition",
  },
  {
    id: "ocean-awareness-contest",
    label: "Ocean Awareness Contest",
    category: "International environmental arts contest",
  },
  {
    id: "flmd-2026-high-school-essay-contest",
    label: "2026 High School Essay Contest - Jacksonville",
    category: "Federal court civic essay competition",
  },
] as const;

export type SampleAnalysisId = (typeof SAMPLE_ANALYSIS_CATALOG)[number]["id"];

const sampleIds = new Set<string>(SAMPLE_ANALYSIS_CATALOG.map((sample) => sample.id));

export function isSampleAnalysisId(value: string): value is SampleAnalysisId {
  return sampleIds.has(value);
}

export function sampleCatalogEntry(id: SampleAnalysisId) {
  return SAMPLE_ANALYSIS_CATALOG.find((sample) => sample.id === id)!;
}
