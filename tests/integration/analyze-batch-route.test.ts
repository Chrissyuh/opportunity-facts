import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/analyze/batch/route";

const previousEnabled = process.env.ANALYSIS_ENABLED;

beforeEach(() => { process.env.ANALYSIS_ENABLED = "true"; });
afterEach(() => {
  if (previousEnabled === undefined) delete process.env.ANALYSIS_ENABLED;
  else process.env.ANALYSIS_ENABLED = previousEnabled;
});

function request(body: unknown) {
  return new Request("http://localhost/api/analyze/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("analysis batch manifest route", () => {
  it("enforces the server maximum and deduplicates canonical URLs", async () => {
    const response = await POST(request({ urls: [
      "https://program.example/apply?utm_source=test",
      "https://program.example/apply#again",
    ] }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      urls: ["https://program.example/apply"],
      duplicateCount: 1,
      maximum: 5,
      concurrency: 2,
    });

    const overLimit = await POST(request({ urls: Array.from({ length: 6 }, (_, index) => `https://p${index}.example/`) }));
    expect(overLimit.status).toBe(400);
  });
});
