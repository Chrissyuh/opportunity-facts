import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GET,
  MAX_REQUEST_BODY_BYTES,
  MAX_REQUEST_BODY_READ_MS,
  POST,
} from "@/app/api/analyze/route";
import { tryAcquireAnalysisSlot } from "@/lib/analysis/admission-control";

const previousApiKey = process.env.OPENAI_API_KEY;
const previousAnalysisEnabled = process.env.ANALYSIS_ENABLED;
const previousAnalysisMaxConcurrency = process.env.ANALYSIS_MAX_CONCURRENCY;
const previousBypassHosts = process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS;

afterEach(() => {
  vi.useRealTimers();
  if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousApiKey;
  if (previousAnalysisEnabled === undefined) delete process.env.ANALYSIS_ENABLED;
  else process.env.ANALYSIS_ENABLED = previousAnalysisEnabled;
  if (previousAnalysisMaxConcurrency === undefined) delete process.env.ANALYSIS_MAX_CONCURRENCY;
  else process.env.ANALYSIS_MAX_CONCURRENCY = previousAnalysisMaxConcurrency;
  if (previousBypassHosts === undefined) delete process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS;
  else process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS = previousBypassHosts;
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.ANALYSIS_ENABLED = "true";
});

describe("analysis route boundary", () => {
  it("reports no-key configuration without allowing response caching", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({
      configured: false,
      analyzerVersion: "student-research-v2-fast-extended",
      model: null,
    });
  });

  it("honors the server-side analysis kill switch", async () => {
    process.env.OPENAI_API_KEY = "unused-test-key";
    process.env.ANALYSIS_ENABLED = "false";

    const configuration = await GET();
    await expect(configuration.json()).resolves.toEqual({
      configured: false,
      analyzerVersion: "student-research-v2-fast-extended",
      model: null,
    });

    const response = await POST(jsonRequest({ mode: "url", url: "https://program.example/" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "ANALYSIS_DISABLED" });
  });

  it("returns an authoritative failure-suppression decision without exposing the host list", async () => {
    process.env.ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS = "program.example";
    const response = await GET(new Request("http://localhost/api/analyze?suppressionUrl=https%3A%2F%2Fprogram.example%2Fapply"));
    const payload = await response.json();
    expect(payload.failureSuppression).toEqual({ bypass: true, allowLocalSuppression: false });
    expect(JSON.stringify(payload)).not.toContain("failureCacheBypassHosts");
  });

  it("requires JSON and rejects browser requests from another origin", async () => {
    delete process.env.OPENAI_API_KEY;
    const wrongType = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ mode: "url", url: "https://program.example/" }),
      }),
    );
    expect(wrongType.status).toBe(415);
    await expect(wrongType.json()).resolves.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

    const crossOrigin = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Origin: "https://attacker.example",
        },
        body: JSON.stringify({ mode: "url", url: "https://program.example/" }),
      }),
    );
    expect(crossOrigin.status).toBe(403);
    await expect(crossOrigin.json()).resolves.toMatchObject({ code: "CROSS_ORIGIN_REQUEST" });

    const sameOrigin = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Origin: "http://localhost",
        },
        body: JSON.stringify({ mode: "url", url: "https://program.example/" }),
      }),
    );
    expect(sameOrigin.status).toBe(503);
    await expect(sameOrigin.json()).resolves.toMatchObject({ code: "MODEL_NOT_CONFIGURED" });
  });

  it("rejects excess concurrent work before starting analysis", async () => {
    process.env.OPENAI_API_KEY = "unused-test-key";
    process.env.ANALYSIS_MAX_CONCURRENCY = "1";
    const release = tryAcquireAnalysisSlot();
    expect(release).toBeTypeOf("function");
    try {
      const response = await POST(jsonRequest({ mode: "url", url: "https://program.example/" }));
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("10");
      await expect(response.json()).resolves.toMatchObject({ code: "ANALYSIS_BUSY" });
    } finally {
      release?.();
    }
  });

  it("rejects an oversized declared body before reading it", async () => {
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(MAX_REQUEST_BODY_BYTES + 1),
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toMatchObject({ code: "REQUEST_TOO_LARGE" });
  });

  it("stops and cancels a chunked body as soon as the byte limit is crossed", async () => {
    let sent = false;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent) return;
        sent = true;
        controller.enqueue(new Uint8Array(MAX_REQUEST_BODY_BYTES + 1));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
  });

  it("bounds stalled body reads, counts them against concurrency, and releases the slot", async () => {
    vi.useFakeTimers();
    process.env.OPENAI_API_KEY = "unused-test-key";
    process.env.ANALYSIS_MAX_CONCURRENCY = "1";
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const stalledResponse = POST(request);
    const busyResponse = await POST(
      jsonRequest({ mode: "url", url: "https://program.example/" }),
    );
    expect(busyResponse.status).toBe(429);

    await vi.advanceTimersByTimeAsync(MAX_REQUEST_BODY_READ_MS);
    const response = await stalledResponse;
    expect(response.status).toBe(408);
    await expect(response.json()).resolves.toMatchObject({ code: "REQUEST_TIMEOUT" });
    expect(cancelled).toBe(true);

    const releaseAfterTimeout = tryAcquireAnalysisSlot();
    expect(releaseAfterTimeout).toBeTypeOf("function");
    releaseAfterTimeout?.();
  });

  it("stops an in-progress body read when the client aborts", async () => {
    process.env.OPENAI_API_KEY = "unused-test-key";
    const abortController = new AbortController();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      signal: abortController.signal,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const pendingResponse = POST(request);
    abortController.abort();
    const response = await pendingResponse;

    expect(response.status).toBe(408);
    await expect(response.json()).resolves.toMatchObject({ code: "REQUEST_ABORTED" });
    expect(cancelled).toBe(true);
  });

  it("rejects duplicate and aggregate-over-limit pasted sources before model configuration", async () => {
    delete process.env.OPENAI_API_KEY;
    const duplicate = {
      title: "Program",
      url: "https://program.example/details",
      pageType: "user_supplied",
      text: "Visible program source text.",
    };
    const duplicateResponse = await POST(
      jsonRequest({ mode: "text", sources: [duplicate, { ...duplicate }] }),
    );
    expect(duplicateResponse.status).toBe(400);
    await expect(duplicateResponse.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });

    const canonicalDuplicateResponse = await POST(
      jsonRequest({
        mode: "text",
        sources: [
          duplicate,
          { ...duplicate, title: "Same page with fragment", url: "https://program.example/details#fees" },
        ],
      }),
    );
    expect(canonicalDuplicateResponse.status).toBe(400);
    await expect(canonicalDuplicateResponse.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });

    const trackingDuplicateResponse = await POST(
      jsonRequest({
        mode: "text",
        sources: [
          duplicate,
          {
            ...duplicate,
            title: "Same page with a marketing identifier",
            url: "https://program.example/details?utm_source=newsletter",
          },
        ],
      }),
    );
    expect(trackingDuplicateResponse.status).toBe(400);
    await expect(trackingDuplicateResponse.json()).resolves.toMatchObject({
      code: "INVALID_INPUT",
    });

    const sources = Array.from({ length: 6 }, (_, index) => ({
      title: `Program page ${index + 1}`,
      url: `https://program.example/page-${index + 1}`,
      pageType: "user_supplied",
      text: "x".repeat(70_000),
    }));
    const aggregateResponse = await POST(jsonRequest({ mode: "text", sources }));
    expect(aggregateResponse.status).toBe(400);
    await expect(aggregateResponse.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects sensitive and private source URLs before model configuration", async () => {
    delete process.env.OPENAI_API_KEY;
    for (const url of [
      "https://program.example/page?token=secret",
      "https://program.example/page?apikey=secret",
      "https://program.example/page?sessionid=secret",
      "https://program.example/page?code=summer-2027",
      "http://[::ffff:7f00:1]/page",
      "http://168.63.129.16/machine?comp=goalstate",
      "https://program.example/callback#access_token=secret",
    ]) {
      const response = await POST(jsonRequest({ mode: "url", url }));
      expect(response.status, url).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });
    }
  });
});
