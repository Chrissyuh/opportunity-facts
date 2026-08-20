import { describe, expect, it } from "vitest";
import { acceptsAnalysisStream, encodeAnalysisStreamMessage } from "@/lib/analysis/stream-protocol";

describe("analysis stream protocol", () => {
  it("negotiates NDJSON explicitly and emits one JSON object per line", () => {
    expect(acceptsAnalysisStream(new Request("https://product.example/api", {
      headers: { Accept: "application/x-ndjson, application/json;q=0.5" },
    }))).toBe(true);
    expect(acceptsAnalysisStream(new Request("https://product.example/api", {
      headers: { Accept: "application/json" },
    }))).toBe(false);
    const encoded = encodeAnalysisStreamMessage({ type: "error", code: "STOPPED", message: "Stopped safely." });
    expect(new TextDecoder().decode(encoded)).toBe('{"type":"error","code":"STOPPED","message":"Stopped safely."}\n');
  });
});
