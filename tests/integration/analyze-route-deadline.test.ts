import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const pipelineMocks = vi.hoisted(() => ({
  analyzeRequest: vi.fn(),
}));

vi.mock("@/lib/analysis/pipeline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analysis/pipeline")>(
    "@/lib/analysis/pipeline",
  );
  return { ...actual, analyzeRequest: pipelineMocks.analyzeRequest };
});

import {
  MAX_ANALYSIS_REQUEST_MS,
  POST,
  maxDuration,
} from "@/app/api/analyze/route";
import { tryAcquireAnalysisSlot } from "@/lib/analysis/admission-control";

const previousApiKey = process.env.OPENAI_API_KEY;
const previousAnalysisEnabled = process.env.ANALYSIS_ENABLED;
const previousMaxConcurrency = process.env.ANALYSIS_MAX_CONCURRENCY;

function request(signal?: AbortSignal): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "url", url: "https://program.example/" }),
    signal,
  });
}

afterEach(() => {
  vi.useRealTimers();
  pipelineMocks.analyzeRequest.mockReset();
  if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousApiKey;
  if (previousAnalysisEnabled === undefined) delete process.env.ANALYSIS_ENABLED;
  else process.env.ANALYSIS_ENABLED = previousAnalysisEnabled;
  if (previousMaxConcurrency === undefined) delete process.env.ANALYSIS_MAX_CONCURRENCY;
  else process.env.ANALYSIS_MAX_CONCURRENCY = previousMaxConcurrency;
});

beforeEach(() => {
  process.env.ANALYSIS_ENABLED = "true";
});

describe("analysis route total deadline", () => {
  it("stays below the explicit platform duration and aborts downstream work", async () => {
    expect(MAX_ANALYSIS_REQUEST_MS).toBeLessThan(maxDuration * 1_000);
    vi.useFakeTimers();
    process.env.OPENAI_API_KEY = "unused-test-key";
    process.env.ANALYSIS_MAX_CONCURRENCY = "1";
    let downstreamSignal: AbortSignal | undefined;
    pipelineMocks.analyzeRequest.mockImplementation(
      (_input: unknown, options: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          downstreamSignal = options.signal;
          options.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
            once: true,
          });
        }),
    );

    const pendingResponse = POST(request());
    await vi.advanceTimersByTimeAsync(MAX_ANALYSIS_REQUEST_MS);
    const response = await pendingResponse;

    expect(downstreamSignal?.aborted).toBe(true);
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({ code: "ANALYSIS_TIMEOUT" });
    const releaseAfterTimeout = tryAcquireAnalysisSlot();
    expect(releaseAfterTimeout).toBeTypeOf("function");
    releaseAfterTimeout?.();
  });

  it("propagates a client disconnect into analysis and releases admission", async () => {
    process.env.OPENAI_API_KEY = "unused-test-key";
    process.env.ANALYSIS_MAX_CONCURRENCY = "1";
    const client = new AbortController();
    let downstreamSignal: AbortSignal | undefined;
    let markAnalysisStarted: (() => void) | undefined;
    const analysisStarted = new Promise<void>((resolve) => {
      markAnalysisStarted = resolve;
    });
    pipelineMocks.analyzeRequest.mockImplementation(
      (_input: unknown, options: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          downstreamSignal = options.signal;
          markAnalysisStarted?.();
          options.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
            once: true,
          });
        }),
    );

    const pendingResponse = POST(request(client.signal));
    await analysisStarted;
    client.abort();
    const response = await pendingResponse;

    expect(downstreamSignal?.aborted).toBe(true);
    expect(response.status).toBe(408);
    await expect(response.json()).resolves.toMatchObject({ code: "ANALYSIS_ABORTED" });
    const releaseAfterAbort = tryAcquireAnalysisSlot();
    expect(releaseAfterAbort).toBeTypeOf("function");
    releaseAfterAbort?.();
  });
});
