import { describe, expect, it } from "vitest";
import { normalizeAnalysisUrlInput } from "@/lib/opportunity/url-input";

describe("analysis URL input normalization", () => {
  it.each([
    ["example.org/program", "https://example.org/program"],
    ["www.example.org/apply", "https://www.example.org/apply"],
    ["  example.org/program  ", "https://example.org/program"],
    ["https://example.org/program?cycle=2027#dates", "https://example.org/program?cycle=2027#dates"],
    ["http://example.org/program", "http://example.org/program"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeAnalysisUrlInput(input)).toEqual({ ok: true, url: expected });
  });

  it.each([
    "",
    "not a domain",
    "not-a-domain",
    "https://",
    "ftp://example.org/program",
    "https://user:password@example.org/program",
  ])("returns one clean error for malformed input %s", (input) => {
    expect(normalizeAnalysisUrlInput(input)).toEqual({
      ok: false,
      message: "Enter a valid public opportunity URL, such as example.org/program.",
    });
  });
});
