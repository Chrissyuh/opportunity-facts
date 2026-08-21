import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AnalysisProgressEvent, AnalysisProgressInput } from "../lib/analysis/progress";
import { FIELD_DEFINITIONS, FIELD_IDS, type FieldId } from "../lib/opportunity/fields";
import { opportunityCardSchema, type OpportunityCard } from "../lib/opportunity/schema";
import { SAMPLE_ANALYSIS_CATALOG } from "../lib/sample-analysis/catalog";
import { sampleAnalysisSchema, type SampleAnalysis } from "../lib/sample-analysis/schema";

type JsonRecord = Record<string, unknown>;
type SourceReference = OpportunityCard["facts"]["opportunity_name"]["sources"][number];

type NdjsonSampleId = "mites-summer" | "diamond-challenge";
type JsonSampleId = "yale-young-global-scholars" | "breakthrough-junior-challenge";

const compactCaptures: Readonly<Record<NdjsonSampleId, {
  artifactPath: string;
  submittedUrl: string;
  qualityOutcome: "good" | "usable_with_caveats";
}>> = {
  "mites-summer": {
    artifactPath: ".codex-runtime/production-mites-normal.ndjson",
    submittedUrl: "https://mites.mit.edu/discover-mites/mites-summer/",
    qualityOutcome: "good",
  },
  "diamond-challenge": {
    artifactPath: ".codex-runtime/production-diamond-normal.ndjson",
    submittedUrl: "https://diamondchallenge.org/competition/",
    qualityOutcome: "usable_with_caveats",
  },
};

const jsonCaptures: Readonly<Record<JsonSampleId, { artifactPath: string }>> = {
  "yale-young-global-scholars": {
    artifactPath: ".codex-runtime/sample-captures/yale-young-global-scholars.json",
  },
  "breakthrough-junior-challenge": {
    artifactPath: ".codex-runtime/sample-captures/breakthrough-junior-challenge.json",
  },
};

const questbridgeCapture = {
  artifactPath: ".codex-runtime/two-stage-live/questbridge-ncm-2026-08-20T21-23-18.356Z.json",
  submittedUrl: "https://www.questbridge.org/high-school-students/national-college-match",
  qualityOutcome: "usable_with_caveats" as const,
};

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object in a captured compact-analysis artifact.");
  }
  return value as JsonRecord;
}

function scheduleReplay(events: readonly AnalysisProgressEvent[]) {
  return events.map((event, index) => ({
    replayAtMs: Math.max(index * 25, event.elapsedMs),
    event,
  })).sort((left, right) => left.replayAtMs - right.replayAtMs || left.event.sequence - right.event.sequence);
}

function labelFor(fieldId: FieldId) {
  return FIELD_DEFINITIONS.find((field) => field.id === fieldId)?.label ?? fieldId;
}

function importantPreviews(card: OpportunityCard): FieldId[] {
  const preferred: readonly FieldId[] = [
    "opportunity_name",
    "application_deadline",
    "participation_format",
    "tuition",
    "financial_aid",
    "selection_process",
    "other_benefits",
  ];
  return preferred.filter((fieldId) => card.facts[fieldId].status === "disclosed").slice(0, 4);
}

function reviewedPagesFromCard(card: OpportunityCard) {
  const sources = new Map<string, SourceReference>();
  for (const fact of Object.values(card.facts)) {
    for (const source of fact.sources) sources.set(source.id, source);
    if (fact.status === "conflicting") {
      for (const claim of fact.conflictingValues) {
        for (const source of claim.sources) sources.set(source.id, source);
      }
    }
  }
  return [...sources.values()].map((source) => ({
    id: source.id,
    url: source.url,
    title: source.title,
    pageType: source.pageType,
    accessedAt: source.accessedAt,
    truncated: false,
    truncatedForModel: false,
    contentUnavailable: false,
  }));
}

function telemetryProgress(
  card: OpportunityCard,
  reviewedPages: ReturnType<typeof reviewedPagesFromCard>,
  runtimeMs: number,
  attentionCount: number,
  startedAt: string,
  telemetry: readonly JsonRecord[],
): AnalysisProgressEvent[] {
  let sequence = 0;
  let elapsedMs = 0;
  const events: AnalysisProgressEvent[] = [];
  const add = (event: AnalysisProgressInput, at: number) => {
    events.push({ ...event, sequence: ++sequence, elapsedMs: Math.round(at) } as AnalysisProgressEvent);
  };
  add({ type: "accepted" }, 0);
  add({ type: "cache_checked", state: "miss" }, 2);
  for (const page of reviewedPages) {
    const accessed = Date.parse(page.accessedAt) - Date.parse(startedAt);
    elapsedMs = Math.max(elapsedMs + 300, Number.isFinite(accessed) ? accessed : elapsedMs + 300);
    add({ type: "source_acquired", sourceId: page.id, title: page.title, url: page.url }, elapsedMs);
  }
  let cumulativeMs = 0;
  const stageTimes = new Map<string, { start: number; end: number }>();
  for (const stage of telemetry) {
    const duration = Number(stage.durationMs);
    const start = cumulativeMs;
    cumulativeMs += Number.isFinite(duration) ? duration : 0;
    stageTimes.set(String(stage.stage), { start, end: cumulativeMs });
  }
  const acquisitionFinished = stageTimes.get("cycle_resolution")?.start ?? elapsedMs;
  add({ type: "source_set_complete", acquired: reviewedPages.length, failed: 0 }, acquisitionFinished);
  add({
    type: "cycle_resolved",
    status: card.cycle.status === "modeled" ? "resolved" : "ambiguous",
    ...(card.cycle.status === "modeled"
      ? { label: card.cycle.value.label.displayValue ?? card.cycle.value.label.value }
      : {}),
  }, stageTimes.get("cycle_resolution")?.end ?? acquisitionFinished);
  add({ type: "normal_model_started" }, stageTimes.get("normal_model")?.start ?? acquisitionFinished);
  add({ type: "normal_model_completed" }, stageTimes.get("normal_model")?.end ?? runtimeMs - 72);
  const retained = FIELD_IDS.filter((fieldId) => card.facts[fieldId].status === "disclosed").length;
  const validationFinished = stageTimes.get("deterministic_validation")?.end ?? runtimeMs - 7;
  add({ type: "validation_complete", retained, withheld: 0 }, validationFinished);
  add({ type: "attention_ready", count: attentionCount }, validationFinished);
  for (const fieldId of importantPreviews(card)) {
    const fact = card.facts[fieldId];
    add({
      type: "validated_fact",
      fieldId,
      label: labelFor(fieldId),
      displayValue: fact.displayValue!,
      evidenceCount: fact.sources.length,
    }, validationFinished);
  }
  add({ type: "quality_complete", outcome: "usable_with_caveats" }, stageTimes.get("quality_gate")?.end ?? runtimeMs);
  return events;
}

async function compactSample(id: NdjsonSampleId): Promise<SampleAnalysis> {
  const definition = compactCaptures[id];
  const lines = (await readFile(definition.artifactPath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => record(JSON.parse(line) as unknown));
  const progress = lines
    .filter((message) => message.type === "progress" && record(message.event).type !== "heartbeat")
    .map((message) => record(message.event) as unknown as AnalysisProgressEvent);
  const complete = lines.find((message) => message.type === "complete");
  if (!complete) throw new Error(`No complete result in ${definition.artifactPath}.`);
  const result = record(complete.result);
  const card = opportunityCardSchema.parse(result.card);
  const research = record(result.research);
  const reviewedPages = result.reviewedPages as JsonRecord[];
  const catalog = SAMPLE_ANALYSIS_CATALOG.find((sample) => sample.id === id)!;
  return sampleAnalysisSchema.parse({
    artifactVersion: "1.0.0",
    id,
    label: catalog.label,
    category: catalog.category,
    submittedUrl: definition.submittedUrl,
    recordedAt: reviewedPages[0]?.accessedAt,
    recordedDurationMs: Math.max(...progress.map((event) => event.elapsedMs)),
    captureKind: "compact_production",
    progressProvenance: "captured_stream",
    sourceArtifact: definition.artifactPath,
    progress: scheduleReplay(progress),
    result: {
      card,
      reviewedPages,
      pageWarnings: result.pageWarnings ?? [],
      evidenceWarnings: result.evidenceWarnings ?? [],
      attentionItems: (result.attentionItems as unknown[]).slice(0, 3),
      qualityOutcome: definition.qualityOutcome,
      assessedFieldIds: research.assessedFieldIds ?? FIELD_IDS,
    },
  });
}

async function capturedJsonSample(id: JsonSampleId): Promise<SampleAnalysis> {
  const definition = jsonCaptures[id];
  const artifact = record(JSON.parse(await readFile(definition.artifactPath, "utf8")) as unknown);
  const result = record(artifact.result);
  if (result.kind !== "card") throw new Error(`${definition.artifactPath} is not a completed card result.`);
  const quality = record(result.quality);
  const research = record(result.research);
  const catalog = SAMPLE_ANALYSIS_CATALOG.find((sample) => sample.id === id)!;
  const progress = (artifact.progress as unknown[]).map((event) => record(event) as unknown as AnalysisProgressEvent);
  return sampleAnalysisSchema.parse({
    artifactVersion: "1.0.0",
    id,
    label: catalog.label,
    category: catalog.category,
    submittedUrl: artifact.submittedUrl,
    recordedAt: artifact.startedAt,
    recordedDurationMs: artifact.runtimeMs,
    captureKind: "compact_production",
    progressProvenance: "captured_stream",
    sourceArtifact: definition.artifactPath,
    progress: scheduleReplay(progress.filter((event) => event.type !== "heartbeat")),
    result: {
      card: result.card,
      reviewedPages: result.reviewedPages,
      pageWarnings: result.pageWarnings ?? [],
      evidenceWarnings: result.evidenceWarnings ?? [],
      attentionItems: (result.attentionItems as unknown[]).slice(0, 3),
      qualityOutcome: quality.outcome,
      assessedFieldIds: research.assessedFieldIds ?? FIELD_IDS,
    },
  });
}

async function questbridgeSample(): Promise<SampleAnalysis> {
  const artifact = record(JSON.parse(await readFile(questbridgeCapture.artifactPath, "utf8")) as unknown);
  const normal = record(artifact.normal);
  const result = record(normal.detail);
  const card = opportunityCardSchema.parse(result.card);
  const reviewedPages = reviewedPagesFromCard(card);
  const attentionItems = result.attentionItems as unknown[];
  const runtimeMs = Math.round(Number(normal.runtimeMs));
  const telemetry = (normal.telemetry as unknown[]).map(record);
  const catalog = SAMPLE_ANALYSIS_CATALOG.find((sample) => sample.id === "questbridge-national-college-match")!;
  return sampleAnalysisSchema.parse({
    artifactVersion: "1.0.0",
    id: "questbridge-national-college-match",
    label: catalog.label,
    category: catalog.category,
    submittedUrl: questbridgeCapture.submittedUrl,
    recordedAt: artifact.startedAt,
    recordedDurationMs: runtimeMs,
    captureKind: "compact_production",
    progressProvenance: "recorded_stage_telemetry",
    sourceArtifact: questbridgeCapture.artifactPath,
    progress: scheduleReplay(telemetryProgress(card, reviewedPages, runtimeMs, attentionItems.length, String(artifact.startedAt), telemetry)),
    result: {
      card,
      reviewedPages,
      pageWarnings: result.pageWarnings ?? [],
      evidenceWarnings: result.evidenceWarnings ?? [],
      attentionItems: attentionItems.slice(0, 3),
      qualityOutcome: questbridgeCapture.qualityOutcome,
      assessedFieldIds: FIELD_IDS,
    },
  });
}

async function main() {
  const outputDirectory = path.join(process.cwd(), "data", "sample-analyses");
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const samples = [
    await compactSample("mites-summer"),
    await compactSample("diamond-challenge"),
    await questbridgeSample(),
    await capturedJsonSample("yale-young-global-scholars"),
    await capturedJsonSample("breakthrough-junior-challenge"),
  ];
  for (const sample of samples) {
    await writeFile(
      path.join(outputDirectory, `${sample.id}.json`),
      `${JSON.stringify(sample, null, 2)}\n`,
      "utf8",
    );
  }
  process.stdout.write(`Generated ${samples.length} prerecorded compact-analysis samples.\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
