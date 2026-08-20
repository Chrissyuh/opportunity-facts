import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ runProductAnalysis: vi.fn() }));
vi.mock("@/lib/analysis/product-run", () => ({ runProductAnalysis: mocks.runProductAnalysis }));

import { POST } from "@/app/api/analyze/route";

const previousEnabled = process.env.ANALYSIS_ENABLED;
const previousKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  process.env.ANALYSIS_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-only";
});
afterEach(() => {
  mocks.runProductAnalysis.mockReset();
  if (previousEnabled === undefined) delete process.env.ANALYSIS_ENABLED;
  else process.env.ANALYSIS_ENABLED = previousEnabled;
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});

describe("streamed analysis route", () => {
  it("streams accepted, validated progress, and a final result as NDJSON", async () => {
    mocks.runProductAnalysis.mockImplementation(async (_input, options) => {
      options.onProgress?.({ type: "validation_complete", retained: 8, withheld: 2 });
      return {
        kind: "quality_failure",
        cached: false,
        cacheEligible: false,
        quality: {
          classification: "INSUFFICIENT_SOURCE_QUALITY",
          reasons: [],
          createdAt: "2026-08-20T00:00:00.000Z",
          expiresAt: "2026-09-03T00:00:00.000Z",
          analyzerVersion: "student-research-v1",
        },
      };
    });
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      body: JSON.stringify({ mode: "url", url: "https://program.example/" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    const messages = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(messages[0]).toMatchObject({ type: "progress", event: { type: "accepted", sequence: 1 } });
    expect(messages[1]).toMatchObject({ type: "progress", event: { type: "validation_complete", retained: 8, withheld: 2, sequence: 2 } });
    expect(messages.at(-1)).toMatchObject({
      type: "complete",
      result: { kind: "quality_failure", cached: false, cacheEligible: false },
    });
  });
});
