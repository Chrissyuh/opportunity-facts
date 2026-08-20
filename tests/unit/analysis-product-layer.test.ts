import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  deriveDeterministicAttention,
  evidenceForAttentionItem,
  groundAttentionCandidates,
} from "@/lib/analysis/attention";
import { createAnalysisBatchManifest } from "@/lib/analysis/batch-server";
import {
  analysisFailureCacheKey,
  configuredFailureCacheBypassHosts,
  createCachedQualityFailure,
  shouldBypassFailureCache,
  UpstashRestAnalysisFailureCache,
} from "@/lib/analysis/failure-cache";
import { createSequencedProgressSink } from "@/lib/analysis/progress";
import { assessAnalysisQuality } from "@/lib/analysis/quality-gate";
import { opportunityCardSchema } from "@/lib/opportunity/schema";

const card = opportunityCardSchema.parse(JSON.parse(readFileSync(
  "data/opportunities/mites-summer-2027.json",
  "utf8",
)));

describe("analysis product layer", () => {
  it("sequences observable progress with monotonic elapsed time", () => {
    const events: unknown[] = [];
    const times = [100, 104, 112];
    const progress = createSequencedProgressSink((event) => events.push(event), () => times.shift() ?? 112);
    progress({ type: "accepted" });
    progress({ type: "cache_checked", state: "miss" });
    expect(events).toEqual([
      { type: "accepted", sequence: 1, elapsedMs: 4 },
      { type: "cache_checked", state: "miss", sequence: 2, elapsedMs: 12 },
    ]);
  });

  it("rejects model attention that introduces an unsupported institution", () => {
    const items = groundAttentionCandidates(card, [{
      id: "unsupported-institution",
      category: "organization_relationship",
      priority: "high",
      title: "Stanford partnership is unclear",
      explanation: "Stanford may operate this opportunity.",
      fieldIds: ["operating_organization"],
      claimIds: [],
    }]);
    expect(items.some((item) => item.id === "unsupported-institution")).toBe(false);
    expect(items).toEqual(expect.arrayContaining(deriveDeterministicAttention(card)));
  });

  it("resolves exact structured-claim evidence for claim-only attention", () => {
    const items = groundAttentionCandidates(card, [{
      id: "summer-dates-unavailable",
      category: "cycle",
      priority: "medium",
      title: "Summer dates remain unavailable",
      explanation: "The exact Summer dates are not yet available.",
      fieldIds: [],
      claimIds: ["mites-cycle-label"],
    }]);
    const item = items.find((candidate) => candidate.id === "summer-dates-unavailable");
    expect(item).toBeDefined();
    expect(evidenceForAttentionItem(card, item!)).toEqual([
      expect.objectContaining({
        id: "mites-faq",
        excerpt: "2027 MITES Summer dates are not yet available",
      }),
    ]);
  });

  it("gates an unresolved empty draft without treating ordinary caveats as a score", () => {
    const empty = structuredClone(card);
    for (const field of Object.values(empty.facts)) {
      Object.assign(field, { status: "not_found", value: null, displayValue: null, normalizedValue: null, sources: [], conflictingValues: [] });
    }
    const result = assessAnalysisQuality({
      card: empty,
      acquiredPages: 1,
      pageWarnings: [],
      evidenceWarnings: [],
      attentionItems: [],
    });
    expect(result.outcome).toBe("insufficient_quality");
    expect(result.reasons.map((reason) => reason.code)).toContain("TARGET_IDENTITY_UNRESOLVED");
  });

  it("does not suppress any of the ten independently reviewed real records", () => {
    const outcomes = readdirSync("data/opportunities").filter((file) => file.endsWith(".json")).map((file) => {
      const reviewed = opportunityCardSchema.parse(JSON.parse(readFileSync(`data/opportunities/${file}`, "utf8")));
      return assessAnalysisQuality({
        card: reviewed,
        acquiredPages: reviewed.sourcePagesChecked.length,
        pageWarnings: [],
        evidenceWarnings: [],
        attentionItems: deriveDeterministicAttention(reviewed),
      }).outcome;
    });
    expect(outcomes).not.toContain("insufficient_quality");
  });

  it("canonicalizes and deduplicates a maximum-five batch manifest", () => {
    const manifest = createAnalysisBatchManifest({
      urls: [
        "https://program.example/apply?utm_source=test#top",
        "https://program.example/apply",
        "https://other.example/",
      ],
    });
    expect(manifest.urls).toEqual(["https://program.example/apply", "https://other.example/"]);
    expect(manifest.duplicateCount).toBe(1);
    expect(manifest.maximum).toBe(5);
    expect(() => createAnalysisBatchManifest({ urls: Array.from({ length: 6 }, (_, index) => `https://p${index}.example/`) })).toThrow();
  });

  it("isolates cache bypass matching from analysis behavior and uses expiring Upstash commands", async () => {
    const hosts = configuredFailureCacheBypassHosts({ ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS: "example.org" });
    expect(shouldBypassFailureCache("https://apply.example.org/", hosts)).toBe(true);
    expect(shouldBypassFailureCache("https://notexample.org/", hosts)).toBe(false);
    expect(analysisFailureCacheKey("https://program.example/?utm_source=test"))
      .toBe(analysisFailureCacheKey("https://program.example/"));
    expect(analysisFailureCacheKey("https://program.example/", "next-version"))
      .not.toBe(analysisFailureCacheKey("https://program.example/"));

    const requests: unknown[] = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });
    const cache = new UpstashRestAnalysisFailureCache("https://redis.example", "secret", fetchMock as typeof fetch);
    const failure = createCachedQualityFailure([{
      code: "TOO_FEW_SUPPORTED_FACTS",
      priority: "high",
      title: "Not enough source-backed information",
      explanation: "Too few supported facts survived.",
    }], { now: new Date("2026-08-20T00:00:00.000Z") });
    await cache.set("key", failure, 120);
    expect(requests).toEqual([["SET", "key", JSON.stringify(failure), "EX", 120]]);
  });

  it("treats expired durable failures as cache misses", async () => {
    const expired = createCachedQualityFailure([{
      code: "TOO_FEW_SUPPORTED_FACTS",
      priority: "high",
      title: "Not enough source-backed information",
      explanation: "Too few supported facts survived.",
    }], { now: new Date("2020-01-01T00:00:00.000Z") });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: JSON.stringify(expired) }), { status: 200 }));
    const cache = new UpstashRestAnalysisFailureCache("https://redis.example", "secret", fetchMock as typeof fetch);
    await expect(cache.get("expired-key")).resolves.toBeNull();
  });
});
