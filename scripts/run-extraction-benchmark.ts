import "server-only";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadEnvConfig } from "@next/env";

import {
  buildBoundedSourcePayload,
  createOpenAIExtractor,
  DEFAULT_OPENAI_MODEL,
  MAX_MODEL_OUTPUT_TOKENS,
  MODEL_STAGE_OUTPUT_TOKENS,
  MODEL_MAX_RETRIES,
  MODEL_REASONING_EFFORT,
  MODEL_REQUEST_TIMEOUT_MS,
  type AnalysisSourceContext,
  type ModelExtraction,
  type ModelExtractor,
  type ModelResponseTelemetry,
} from "@/lib/analysis/model-extraction";
import { analyzePublicUrl } from "@/lib/analysis/pipeline";
import { SCHEMA_VERSION } from "@/lib/opportunity/schema";

const BENCHMARKS = {
  "nasa-techrise-2026-2027": {
    label: "NASA TechRise Student Challenge — 2026–2027",
    url: "https://www.futureengineers.org/nasatechrise",
  },
  "lumiere-fall-2026": {
    label: "Lumiere Research Scholar Program — Fall 2026",
    url: "https://www.lumiere-education.com/lumiere-programs",
  },
  "diamond-challenge-2027": {
    label: "Diamond Challenge — 2027",
    url: "https://diamondchallenge.org/competition/",
  },
  "congressional-app-challenge-2026": {
    label: "Congressional App Challenge — 2026",
    url: "https://www.congressionalappchallenge.us/students/rules/",
  },
  "coca-cola-scholars-program-2027": {
    label: "Coca-Cola Scholars Program — 2027",
    url: "https://www.coca-colascholarsfoundation.org/apply/",
  },
  "yale-young-global-scholars-summer-2027": {
    label: "Yale Young Global Scholars — Summer 2027",
    url: "https://globalscholars.yale.edu/",
  },
  "polygence-core-program-fall-2026": {
    label: "Polygence Core Program — Fall 2026 entry",
    url: "https://www.polygence.org/core-program",
  },
  "mites-summer-2027": {
    label: "MITES Summer — 2027",
    url: "https://mites.mit.edu/discover-mites/mites-summer/",
  },
  "breakthrough-junior-challenge-2026": {
    label: "Breakthrough Junior Challenge — 2026",
    url: "https://breakthroughjuniorchallenge.org/",
  },
  "questbridge-national-college-match-2026": {
    label: "QuestBridge National College Match — 2026 / Fall 2027",
    url: "https://www.questbridge.org/apply-to-college/programs/national-college-match",
  },
} as const;

type BenchmarkSlug = keyof typeof BENCHMARKS;
type BenchmarkStage = "baseline" | "post-fix" | "evaluation";

const EVALUATION_SLUGS = new Set<BenchmarkSlug>([
  "congressional-app-challenge-2026",
  "coca-cola-scholars-program-2027",
  "yale-young-global-scholars-summer-2027",
  "polygence-core-program-fall-2026",
  "mites-summer-2027",
  "breakthrough-junior-challenge-2026",
  "questbridge-national-college-match-2026",
]);

const SENSITIVE_VALUE_PATTERN = /sk-[A-Za-z0-9_-]+/gu;

function safeMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.replace(SENSITIVE_VALUE_PATTERN, "[REDACTED_API_KEY]");
}

function serializeError(error: unknown) {
  const primary = error as {
    name?: unknown;
    message?: unknown;
    cause?: unknown;
    code?: unknown;
    status?: unknown;
    type?: unknown;
  };
  const cause = primary?.cause as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    type?: unknown;
  } | undefined;
  return {
    name: typeof primary?.name === "string" ? primary.name : "Error",
    message: safeMessage(primary?.message) ?? "Unknown benchmark failure.",
    code: typeof primary?.code === "string" ? primary.code : null,
    status: typeof primary?.status === "number" ? primary.status : null,
    type: typeof primary?.type === "string" ? primary.type : null,
    cause: cause
      ? {
          name: typeof cause.name === "string" ? cause.name : null,
          message: safeMessage(cause.message),
          code: typeof cause.code === "string" ? cause.code : null,
          status: typeof cause.status === "number" ? cause.status : null,
          type: typeof cause.type === "string" ? cause.type : null,
        }
      : null,
  };
}

function repositoryCodeHash() {
  const paths = [
    "lib/analysis",
    "lib/opportunity/structured-schema.ts",
    "lib/opportunity/schema-v2.ts",
    "lib/opportunity/projection.ts",
  ];
  const files = execFileSync("git", ["ls-files", "--", ...paths], {
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return { algorithm: "sha256", value: hash.digest("hex"), files };
}

function parseArguments() {
  const [stageInput, slugInput, runInput = "1"] = process.argv.slice(2);
  if (stageInput !== "baseline" && stageInput !== "post-fix" && stageInput !== "evaluation") {
    throw new Error("Stage must be baseline, post-fix, or evaluation.");
  }
  if (!(slugInput in BENCHMARKS)) {
    throw new Error(`Unknown benchmark slug: ${slugInput ?? "(missing)"}.`);
  }
  const run = Number(runInput);
  if (!Number.isInteger(run) || run < 1 || run > 3) {
    throw new Error("Run number must be an integer from 1 through 3.");
  }
  if (stageInput === "evaluation" && run !== 1) {
    throw new Error("The frozen out-of-sample evaluation permits exactly run 1.");
  }
  if (stageInput === "evaluation" && !EVALUATION_SLUGS.has(slugInput as BenchmarkSlug)) {
    throw new Error("Development-set programs cannot be run as out-of-sample evaluation cases.");
  }
  return {
    stage: stageInput as BenchmarkStage,
    slug: slugInput as BenchmarkSlug,
    run,
  };
}

function loadServerEnvironment() {
  const inheritedKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (inheritedKey && !/^sk-(?:proj-)?/u.test(inheritedKey)) {
    delete process.env.OPENAI_API_KEY;
  }
  const originalLog = console.log;
  console.log = () => {};
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  console.log = originalLog;
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is unavailable to the server runtime.");
  }
}

function writeArtifact(path: string, value: unknown) {
  if (existsSync(path)) throw new Error(`Refusing to overwrite benchmark artifact ${path}.`);
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
}

async function main() {
  const { stage, slug, run } = parseArguments();
  loadServerEnvironment();

  const benchmark = BENCHMARKS[slug];
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const outputPath = stage === "evaluation"
    ? join(
        "research",
        "extraction-evaluation",
        "first-pass",
        `${slug}-run-${String(run).padStart(2, "0")}.json`,
      )
    : join(
        "research",
        "extraction-benchmark",
        stage,
        `${slug}-run-${String(run).padStart(2, "0")}.json`,
      );
  const startedAt = new Date();
  const capture: {
    modelStartedAt: Date | null;
    modelFinishedAt: Date | null;
    sources: readonly AnalysisSourceContext[];
    rawCandidate: ModelExtraction | null;
    telemetry: ModelResponseTelemetry | null;
  } = {
    modelStartedAt: null,
    modelFinishedAt: null,
    sources: [],
    rawCandidate: null,
    telemetry: null,
  };

  const liveExtractor = createOpenAIExtractor({
    onResponse(value) {
      capture.telemetry = value;
    },
    onRawCandidate(value) {
      capture.rawCandidate = value as ModelExtraction;
    },
  });
  const recordingExtractor: ModelExtractor = async (contexts, options) => {
    capture.sources = contexts;
    capture.modelStartedAt = new Date();
    try {
      capture.rawCandidate = await liveExtractor(contexts, options);
      return capture.rawCandidate;
    } finally {
      capture.modelFinishedAt = new Date();
    }
  };

  let result: Awaited<ReturnType<typeof analyzePublicUrl>> | null = null;
  let failure: ReturnType<typeof serializeError> | null = null;
  try {
    result = await analyzePublicUrl(benchmark.url, { extractor: recordingExtractor });
  } catch (error) {
    failure = serializeError(error);
  }
  const finishedAt = new Date();
  const boundedById = new Map(
    buildBoundedSourcePayload(capture.sources).map((source) => [source.id, source]),
  );

  const artifact = {
  artifactVersion: 1,
  benchmarkStage: stage,
  developmentSet: stage !== "evaluation",
  run,
  program: { slug, label: benchmark.label },
  repository: {
    gitCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    workingTreeDirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
    extractionCodeHash: repositoryCodeHash(),
  },
  schemaVersion: SCHEMA_VERSION,
  provider: {
    name: "openai",
    endpoint: "responses",
    model,
    settings: {
      store: false,
      reasoningEffort: MODEL_REASONING_EFFORT,
      maxOutputTokens: MAX_MODEL_OUTPUT_TOKENS,
      maxOutputTokensByFamily: MODEL_STAGE_OUTPUT_TOKENS,
      requestTimeoutMs: MODEL_REQUEST_TIMEOUT_MS,
      maximumRetries: MODEL_MAX_RETRIES,
    },
    telemetry: capture.telemetry,
  },
  input: { mode: "url", startingUrl: benchmark.url },
  timing: {
    startedAt: startedAt.toISOString(),
    modelStartedAt: capture.modelStartedAt?.toISOString() ?? null,
    modelFinishedAt: capture.modelFinishedAt?.toISOString() ?? null,
    finishedAt: finishedAt.toISOString(),
    totalRuntimeMs: finishedAt.getTime() - startedAt.getTime(),
    acquisitionRuntimeMs: capture.modelStartedAt
      ? capture.modelStartedAt.getTime() - startedAt.getTime()
      : null,
    modelRuntimeMs:
      capture.modelStartedAt && capture.modelFinishedAt
        ? capture.modelFinishedAt.getTime() - capture.modelStartedAt.getTime()
        : null,
  },
  acquisition: {
    submittedUrl: benchmark.url,
    successfullyAcquired: capture.sources.map(({ page, accessedAt }, index) => {
      const bounded = boundedById.get(page.id);
      return {
        role: index === 0 ? "submitted" : "discovered",
        id: page.id,
        url: page.url,
        title: page.title,
        pageType: page.pageType,
        accessedAt,
        extractedCharacters: page.text.length,
        truncatedDuringExtraction: page.truncated,
        modelCharacters: bounded?.text.length ?? 0,
        truncatedForModel: bounded?.truncatedForModel ?? false,
      };
    }),
    failures: result?.pageWarnings ?? [],
  },
  modelOutput: {
    rawStructuredCandidate: capture.rawCandidate,
  },
  deterministicValidation: {
    completed: result !== null,
    evidenceWarnings: result?.evidenceWarnings ?? [],
  },
  result: {
    draftCard: result?.card ?? null,
    reviewedPages: result?.reviewedPages ?? [],
  },
  failure,
  secretsRetained: false,
  };

  writeArtifact(outputPath, artifact);
  console.log(
    JSON.stringify({
      outputPath,
      ok: result !== null,
      acquiredPages: capture.sources.length,
      acquisitionFailures: result?.pageWarnings.length ?? 0,
      evidenceWarnings: result?.evidenceWarnings.length ?? 0,
      usage: capture.telemetry?.usage ?? null,
      runtimeMs: artifact.timing.totalRuntimeMs,
      failure,
    }),
  );

  if (!result) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(JSON.stringify({ ok: false, failure: serializeError(error) }));
  process.exitCode = 1;
});
