import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ANALYZER_VERSION } from "../lib/analysis/analyzer-version";
import type { AnalysisProgressEvent } from "../lib/analysis/progress";
import { FIELD_IDS, type FieldId } from "../lib/opportunity/fields";
import { SAMPLE_ANALYSIS_CATALOG, type SampleAnalysisId } from "../lib/sample-analysis/catalog";
import { sampleAnalysisSchema, type SampleAnalysis } from "../lib/sample-analysis/schema";

type JsonRecord = Record<string, unknown>;

const captureDirectory = path.join(process.cwd(), ".codex-runtime", "sample-captures-current");
const outputDirectory = path.join(process.cwd(), "data", "sample-analyses");
const stagingDirectory = path.join(process.cwd(), ".codex-runtime", `sample-stage-${process.pid}`);

function record(value: unknown, message: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as JsonRecord;
}

function scheduleReplay(events: readonly AnalysisProgressEvent[]) {
  return events.map((event, index) => ({
    replayAtMs: Math.max(index * 25, Math.round(event.elapsedMs)),
    event,
  })).sort((left, right) => left.replayAtMs - right.replayAtMs || left.event.sequence - right.event.sequence);
}

function assertCapturedProgress(events: readonly AnalysisProgressEvent[], durationMs: number) {
  if (events.length < 6) throw new Error("A sample capture must contain the complete progress stream.");
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (event.sequence !== index + 1) throw new Error("Sample progress sequence is not contiguous.");
    if (index > 0 && event.elapsedMs < events[index - 1]!.elapsedMs) {
      throw new Error("Sample progress elapsed time is not monotonic.");
    }
    if (event.elapsedMs > durationMs) throw new Error("Sample progress exceeds recorded duration.");
  }
  if (events.at(-1)?.type !== "quality_complete") {
    throw new Error("A sample capture must end with a real quality-complete event.");
  }
}

function assertPreviewIntegrity(events: readonly AnalysisProgressEvent[], result: JsonRecord) {
  const card = record(result.card, "Captured result is missing its card.");
  const facts = record(card.facts, "Captured card is missing facts.");
  for (const event of events) {
    if (event.type !== "validated_fact") continue;
    const fact = record(facts[event.fieldId], `Preview references missing fact ${event.fieldId}.`);
    if (fact.status !== "disclosed" || fact.displayValue !== event.displayValue) {
      throw new Error(`Preview ${event.fieldId} does not match the retained fact.`);
    }
  }
}

async function buildSample(id: SampleAnalysisId): Promise<SampleAnalysis> {
  const artifactPath = path.join(captureDirectory, `${id}.json`);
  const rawText = await readFile(artifactPath, "utf8");
  const captureDigest = createHash("sha256").update(rawText).digest("hex");
  const artifact = record(JSON.parse(rawText) as unknown, `Invalid capture ${artifactPath}.`);
  if (artifact.artifactVersion !== "current-compact-v2" || artifact.analyzerVersion !== ANALYZER_VERSION) {
    throw new Error(`${id} was not captured with the current compact analyzer.`);
  }
  if (artifact.id !== id || artifact.secretsRetained !== false) throw new Error(`${id} capture identity is invalid.`);
  const result = record(artifact.result, `${id} has no result.`);
  if (result.kind !== "card") throw new Error(`${id} did not produce a publishable card result.`);
  const quality = record(result.quality, `${id} has no quality result.`);
  if (quality.outcome !== "good" && quality.outcome !== "usable_with_caveats") {
    throw new Error(`${id} did not pass the normal quality gate.`);
  }
  const progress = (artifact.progress as unknown[])
    .map((event) => record(event, "Invalid progress event.") as unknown as AnalysisProgressEvent)
    .filter((event) => event.type !== "heartbeat");
  const durationMs = Math.round(Number(artifact.runtimeMs));
  assertCapturedProgress(progress, durationMs);
  assertPreviewIntegrity(progress, result);
  const terminal = progress.at(-1);
  if (terminal?.type !== "quality_complete" || terminal.outcome !== quality.outcome) {
    throw new Error(`${id} quality metadata disagrees with its captured stream.`);
  }
  const research = record(result.research, `${id} has no research metadata.`);
  const catalog = SAMPLE_ANALYSIS_CATALOG.find((entry) => entry.id === id)!;
  return sampleAnalysisSchema.parse({
    artifactVersion: "2.0.0",
    analyzerVersion: ANALYZER_VERSION,
    captureDigest,
    id,
    label: catalog.label,
    category: catalog.category,
    submittedUrl: artifact.submittedUrl,
    recordedAt: artifact.startedAt,
    recordedDurationMs: durationMs,
    captureKind: "compact_production",
    progressProvenance: "captured_stream",
    sourceArtifact: path.relative(process.cwd(), artifactPath).replaceAll("\\", "/"),
    progress: scheduleReplay(progress),
    result: {
      card: result.card,
      reviewedPages: result.reviewedPages,
      pageWarnings: result.pageWarnings ?? [],
      evidenceWarnings: result.evidenceWarnings ?? [],
      attentionItems: (result.attentionItems as unknown[]).slice(0, 3),
      qualityOutcome: quality.outcome,
      assessedFieldIds: research.assessedFieldIds ?? (FIELD_IDS as readonly FieldId[]),
    },
  });
}

async function main() {
await rm(stagingDirectory, { recursive: true, force: true });
await mkdir(stagingDirectory, { recursive: true });
try {
  const samples = await Promise.all(SAMPLE_ANALYSIS_CATALOG.map((entry) => buildSample(entry.id)));
  for (const sample of samples) {
    await writeFile(path.join(stagingDirectory, `${sample.id}.json`), `${JSON.stringify(sample, null, 2)}\n`, "utf8");
  }
  for (const sample of samples) {
    sampleAnalysisSchema.parse(JSON.parse(await readFile(path.join(stagingDirectory, `${sample.id}.json`), "utf8")) as unknown);
  }
  await mkdir(outputDirectory, { recursive: true });
  const retainedFiles = new Set(samples.map((sample) => `${sample.id}.json`));
  for (const filename of await readdir(outputDirectory)) {
    if (filename.endsWith(".json") && !retainedFiles.has(filename)) {
      await rm(path.join(outputDirectory, filename), { force: true });
    }
  }
  for (const sample of samples) {
    await rename(path.join(stagingDirectory, `${sample.id}.json`), path.join(outputDirectory, `${sample.id}.json`));
  }
  console.log(`Generated ${samples.length} validated current-pipeline sample analyses.`);
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
}
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Sample generation failed.");
  process.exitCode = 1;
});
