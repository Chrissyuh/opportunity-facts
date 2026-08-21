import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SAMPLE_ANALYSIS_CATALOG } from "@/lib/sample-analysis/catalog";
import { ANALYZER_VERSION } from "@/lib/analysis/analyzer-version";
import { sampleAnalysisSchema } from "@/lib/sample-analysis/schema";
import {
  chooseNextSample,
  parseSampleRotationState,
  rememberSample,
} from "@/lib/sample-analysis/selection";

const samples = SAMPLE_ANALYSIS_CATALOG.map((entry) => sampleAnalysisSchema.parse(JSON.parse(readFileSync(
  path.join("data", "sample-analyses", `${entry.id}.json`),
  "utf8",
)) as unknown));

describe("prerecorded sample analyses", () => {
  it("uses only compact current-pipeline captures and excludes the private acceptance case", () => {
    expect(samples).toHaveLength(5);
    for (const sample of samples) {
      expect(sample.captureKind).toBe("compact_production");
      expect(sample.analyzerVersion).toBe(ANALYZER_VERSION);
      expect(sample.captureDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(sample.progressProvenance).toBe("captured_stream");
      expect(sample.result.card.schemaVersion).toBe("2.2.0");
      expect(sample.result.card.reviewState).toBe("automated_draft");
      expect(JSON.stringify(sample).toLowerCase()).not.toContain("lumos");
      expect(sample.submittedUrl).toMatch(/^https:\/\//u);
      expect(sample.result.card.facts.opportunity_name.status).toBe("disclosed");
    }
  });

  it("retains recorded timings, monotonically scheduled replay events, evidence, and attention", () => {
    for (const sample of samples) {
      expect(sample.recordedDurationMs).toBeGreaterThan(15_000);
      expect(sample.progress.length).toBeGreaterThan(5);
      expect(sample.progress.map((entry) => entry.replayAtMs)).toEqual(
        [...sample.progress.map((entry) => entry.replayAtMs)].sort((left, right) => left - right),
      );
      expect(sample.progress.at(-1)?.replayAtMs).toBeGreaterThan(sample.recordedDurationMs - 1_000);
      expect(sample.progress.at(-1)?.event.elapsedMs).toBeLessThanOrEqual(sample.recordedDurationMs);
      expect(sample.result.attentionItems.length).toBeLessThanOrEqual(3);
      expect(sample.result.attentionItems.some((item) => item.priority === "high")).toBe(false);
      const disclosedFacts = Object.values(sample.result.card.facts).filter((fact) => fact.status === "disclosed");
      expect(disclosedFacts.some((fact) => fact.sources.some((source) => source.excerpt.length > 0))).toBe(true);
    }
  });

  it("rotates through every unseen sample before resetting and avoids an immediate repeat", () => {
    let state = parseSampleRotationState(null);
    const visited: string[] = [];
    for (let index = 0; index < SAMPLE_ANALYSIS_CATALOG.length; index += 1) {
      const next = chooseNextSample(state, () => 0);
      visited.push(next.id);
      state = next.state;
      expect(next.reset).toBe(false);
    }
    expect(new Set(visited)).toEqual(new Set(SAMPLE_ANALYSIS_CATALOG.map((sample) => sample.id)));
    const nextCycle = chooseNextSample(state, () => 0);
    expect(nextCycle.reset).toBe(true);
    expect(nextCycle.id).not.toBe(visited.at(-1));
  });

  it("recovers from corrupt storage and remembers direct sample links", () => {
    expect(parseSampleRotationState("not-json")).toEqual({ seen: [], last: null });
    const sampleId = SAMPLE_ANALYSIS_CATALOG[0].id;
    const remembered = rememberSample({ seen: [], last: null }, sampleId);
    expect(remembered).toEqual({ seen: [sampleId], last: sampleId });
    expect(rememberSample(remembered, sampleId)).toEqual(remembered);
  });
});
