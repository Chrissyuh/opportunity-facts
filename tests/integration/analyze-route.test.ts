import { afterEach, describe, expect, it } from "vitest";

import {
  GET,
  MAX_REQUEST_BODY_BYTES,
  POST,
} from "@/app/api/analyze/route";

const previousApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousApiKey;
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("analysis route boundary", () => {
  it("reports no-key configuration without allowing response caching", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ configured: false, model: null });
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
