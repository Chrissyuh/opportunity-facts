import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ runExtendedResearch: vi.fn() }));
vi.mock("@/lib/analysis/extended-research", () => ({
  ResearchSessionUnavailableError: class ResearchSessionUnavailableError extends Error {},
  runExtendedResearch: mocks.runExtendedResearch,
}));

import { MAX_EXTENDED_BODY_READ_MS, POST } from "@/app/api/analyze/extended/route";
import { tryAcquireAnalysisSlot } from "@/lib/analysis/admission-control";
import { ResearchSessionUnavailableError } from "@/lib/analysis/extended-research";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";
const previous = {
  enabled: process.env.ANALYSIS_ENABLED,
  key: process.env.OPENAI_API_KEY,
  concurrency: process.env.ANALYSIS_MAX_CONCURRENCY,
};

function request(
  body: unknown = { sessionId: SESSION_ID },
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/analyze/extended", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.ANALYSIS_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-only";
  process.env.ANALYSIS_MAX_CONCURRENCY = "2";
  mocks.runExtendedResearch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  if (previous.enabled === undefined) delete process.env.ANALYSIS_ENABLED; else process.env.ANALYSIS_ENABLED = previous.enabled;
  if (previous.key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous.key;
  if (previous.concurrency === undefined) delete process.env.ANALYSIS_MAX_CONCURRENCY; else process.env.ANALYSIS_MAX_CONCURRENCY = previous.concurrency;
});

describe("Extended Research route boundary", () => {
  it("requires same-origin JSON and accepts only an opaque session id", async () => {
    expect((await POST(new Request("http://localhost/api/analyze/extended", { method: "POST", body: "x" }))).status).toBe(415);
    expect((await POST(request(undefined, { Origin: "https://attacker.example" }))).status).toBe(403);
    expect((await POST(request({ sessionId: SESSION_ID, card: { injected: true } }))).status).toBe(400);
  });

  it("enforces declared and streamed body limits", async () => {
    const declared = await POST(request({ sessionId: SESSION_ID }, { "Content-Length": "-1" }));
    expect(declared.status).toBe(413);
    const huge = await POST(request({ sessionId: "x".repeat(3_000) }));
    expect(huge.status).toBe(413);
  });

  it("times out a stalled body and releases its admission slot", async () => {
    vi.useFakeTimers();
    process.env.ANALYSIS_MAX_CONCURRENCY = "1";
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
    const stalled = POST(new Request("http://localhost/api/analyze/extended", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" }));
    expect((await POST(request())).status).toBe(429);
    await vi.advanceTimersByTimeAsync(MAX_EXTENDED_BODY_READ_MS);
    const response = await stalled;
    expect(response.status).toBe(408);
    expect(cancelled).toBe(true);
    const release = tryAcquireAnalysisSlot();
    expect(release).toBeTypeOf("function");
    release?.();
  });

  it("streams honest continuation progress and completion", async () => {
    mocks.runExtendedResearch.mockImplementation(async (_id, options) => {
      options.onProgress?.({ type: "extended_started" });
      options.onProgress?.({ type: "extended_section_completed", section: "details" });
      return { kind: "card", research: { depth: "extended" } };
    });
    const response = await POST(request(undefined, { Accept: "application/x-ndjson" }));
    expect(response.status).toBe(200);
    const messages = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "progress", event: expect.objectContaining({ type: "extended_started" }) }),
      expect.objectContaining({ type: "progress", event: expect.objectContaining({ type: "extended_section_completed", section: "details" }) }),
      expect.objectContaining({ type: "complete", result: expect.objectContaining({ kind: "card" }) }),
    ]));
  });

  it("returns a non-destructive error for provider failure and expired sessions", async () => {
    mocks.runExtendedResearch.mockRejectedValueOnce(new Error("provider down"));
    const failed = await POST(request());
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toMatchObject({
      code: "EXTENDED_RESEARCH_FAILED",
      message: expect.stringMatching(/original result remains available/i),
    });
    mocks.runExtendedResearch.mockRejectedValueOnce(new ResearchSessionUnavailableError());
    const expired = await POST(request());
    expect(expired.status).toBe(410);
  });

  it("propagates streamed cancellation to the continuation signal", async () => {
    let aborted = false;
    mocks.runExtendedResearch.mockImplementation(async (_id, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("cancelled", "AbortError"));
      }, { once: true });
    }));
    const response = await POST(request(undefined, { Accept: "application/x-ndjson" }));
    await response.body?.cancel("user cancelled");
    await vi.waitFor(() => expect(aborted).toBe(true));
  });
});
