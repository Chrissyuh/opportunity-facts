export const SAMPLE_ANALYSIS_CATALOG = [
  {
    id: "mites-summer",
    label: "MITES Summer",
    category: "Free residential STEM program",
  },
  {
    id: "diamond-challenge",
    label: "Diamond Challenge",
    category: "Team entrepreneurship competition",
  },
  {
    id: "questbridge-national-college-match",
    label: "QuestBridge National College Match",
    category: "Multi-stage college scholarship program",
  },
  {
    id: "yale-young-global-scholars",
    label: "Yale Young Global Scholars",
    category: "International residential academic program",
  },
  {
    id: "breakthrough-junior-challenge",
    label: "Breakthrough Junior Challenge",
    category: "Global science-video competition",
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
