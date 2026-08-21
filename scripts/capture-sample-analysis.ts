import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { ANALYZER_VERSION } from "../lib/analysis/analyzer-version";
import { NoopAnalysisFailureCache } from "../lib/analysis/failure-cache";
import { createSequencedProgressSink, type AnalysisProgressEvent } from "../lib/analysis/progress";
import { runProductAnalysis } from "../lib/analysis/product-run";
import { InMemoryResearchSessionStore } from "../lib/analysis/research-session";
import type { AnalysisTiming } from "../lib/analysis/telemetry";

const [id, submittedUrl] = process.argv.slice(2);
if (!id || !/^[a-z0-9-]+$/u.test(id) || !submittedUrl) {
  throw new Error("Usage: npm run sample:capture -- <sample-id> <public-url>");
}

const quietLogger = { info() {}, error() {} };
loadEnvConfig(process.cwd(), false, quietLogger);
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is unavailable.");

async function main() {
  const progress: AnalysisProgressEvent[] = [];
  const telemetry: AnalysisTiming[] = [];
  const onProgress = createSequencedProgressSink((event) => progress.push(event));
  const startedAt = new Date();
  const started = performance.now();
  const result = await runProductAnalysis(
    { mode: "url", url: submittedUrl },
    {
      failureCache: new NoopAnalysisFailureCache(),
      researchSessionStore: new InMemoryResearchSessionStore(),
      onProgress,
      onTelemetry: (timing) => telemetry.push(timing),
    },
  );
  const finishedAt = new Date();
  const artifact = {
    artifactVersion: "current-compact-v2",
    analyzerVersion: ANALYZER_VERSION,
    id,
    submittedUrl,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    runtimeMs: Math.round(performance.now() - started),
    progress,
    telemetry,
    result,
    secretsRetained: false,
  };
  const directory = path.join(process.cwd(), ".codex-runtime", "sample-captures-current");
  await mkdir(directory, { recursive: true });
  const outputPath = path.join(directory, `${id}.json`);
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      ok: true,
      outputPath,
      runtimeMs: artifact.runtimeMs,
      kind: result.kind,
      quality: result.kind === "card" ? result.quality.outcome : result.quality.classification,
      usage: telemetry.findLast((entry) => entry.usage)?.usage ?? null,
    }),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Sample capture failed.");
  process.exitCode = 1;
});
