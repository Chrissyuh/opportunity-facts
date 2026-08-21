import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createEmptyCard } from "@/lib/opportunity/schema";
import {
  createResearchSessionStore,
  RESEARCH_SESSION_MAX_SOURCE_CHARACTERS,
  RESEARCH_SESSION_TTL_MS,
  UpstashResearchSessionStore,
} from "@/lib/analysis/research-session";
import type { AnalysisSourceContext } from "@/lib/analysis/model-extraction";
import type { AnalysisPipelineResult } from "@/lib/analysis/pipeline";
import type { SharedRedis } from "@/lib/analysis/shared-redis";

class MemoryRedis implements SharedRedis {
  readonly values = new Map<string, string>();
  readonly commands: readonly unknown[][] = [];

  async command(command: readonly unknown[]): Promise<unknown> {
    (this.commands as unknown[][]).push([...command]);
    const operation = command[0];
    const key = String(command[1]);
    if (operation === "GET") return this.values.get(key) ?? null;
    if (operation === "SET") {
      if (command.includes("NX") && this.values.has(key)) return null;
      if (command.includes("XX") && !this.values.has(key)) return null;
      this.values.set(key, String(command[2]));
      return "OK";
    }
    if (operation === "DEL") {
      for (const candidate of command.slice(1)) this.values.delete(String(candidate));
      return 1;
    }
    if (operation === "EVAL") {
      this.values.delete(String(command[3]));
      return 1;
    }
    throw new Error(`Unexpected command ${String(operation)}`);
  }
}

function source(text = "Official public source text"): AnalysisSourceContext {
  return {
    accessedAt: "2026-08-20T00:00:00.000Z",
    page: {
      id: "source-1",
      url: "https://program.example/",
      title: "Program",
      pageType: "user_supplied",
      trust: "untrusted_source_text",
      text,
      blocks: [],
      links: [],
      truncated: false,
    },
  };
}

const normalResult = {
  card: createEmptyCard({ slug: "draft", summary: "Draft", reviewState: "automated_draft" }),
  reviewedPages: [],
  pageWarnings: [],
  evidenceWarnings: [],
  attentionItems: [],
  quality: { version: "student-research-v2-fast", outcome: "good", reasons: [], signals: {} as never, cacheEligible: false },
  validationStats: { attemptedSupportedClaims: 0, retainedSupportedClaims: 0, withheldSupportedClaims: 0 },
  sourceFingerprint: null,
  familyFailures: [],
  coreAreaAssessments: [],
} satisfies AnalysisPipelineResult;

describe("durable Extended Research sessions", () => {
  it("stores an opaque, bounded handoff for 30 minutes without extending its privacy TTL", async () => {
    let now = 1_000;
    const redis = new MemoryRedis();
    const store = new UpstashResearchSessionStore(redis, () => now, () => "00000000-0000-4000-8000-000000000123");
    const id = await store.create({ sources: [source()], pageWarnings: [], normalResult });
    expect(id).toBe("00000000-0000-4000-8000-000000000123");
    expect(JSON.stringify(redis.commands[0])).toContain(`"EX",${RESEARCH_SESSION_TTL_MS / 1_000},"NX"`);
    expect(JSON.stringify(redis.commands[0])).not.toContain("private-token");
    expect((await store.get(id!))?.normalResult.card.slug).toBe("draft");
    now += RESEARCH_SESSION_TTL_MS + 1;
    expect(await store.get(id!)).toBeNull();
  });

  it("rejects oversized source state before any shared-store write", async () => {
    const redis = new MemoryRedis();
    const store = new UpstashResearchSessionStore(redis);
    expect(await store.create({
      sources: [source("x".repeat(RESEARCH_SESSION_MAX_SOURCE_CHARACTERS + 1))],
      pageWarnings: [],
      normalResult,
    })).toBeNull();
    expect(redis.commands).toHaveLength(0);
  });

  it("invalidates a stored handoff from another analyzer version", async () => {
    const redis = new MemoryRedis();
    const store = new UpstashResearchSessionStore(redis, () => 1_000, () => "00000000-0000-4000-8000-000000000124");
    const id = await store.create({ sources: [source()], pageWarnings: [], normalResult });
    const key = [...redis.values.keys()][0]!;
    const held = JSON.parse(redis.values.get(key)!);
    held.analyzerVersion = "old-version";
    redis.values.set(key, JSON.stringify(held));
    expect(await store.get(id!)).toBeNull();
  });

  it("does not expose instance-local continuation state in production without Redis", () => {
    const store = createResearchSessionStore({ VERCEL_ENV: "production", ANALYSIS_SHARED_CONTROLS_REQUIRED: "true" });
    expect(store.create({ sources: [source()], pageWarnings: [], normalResult })).toBeNull();
  });

  it("uses a shared lease to suppress concurrent Extended provider work", async () => {
    const redis = new MemoryRedis();
    const store = new UpstashResearchSessionStore(redis, () => 1_000, () => "00000000-0000-4000-8000-000000000125");
    const id = await store.create({ sources: [source()], pageWarnings: [], normalResult });
    const first = await store.acquireLease(id!);
    const second = await store.acquireLease(id!);
    expect(first).toMatch(/^[0-9a-f-]{36}$/u);
    expect(second).toBeNull();
    await store.releaseLease(id!, first!);
    expect(await store.acquireLease(id!)).not.toBeNull();
  });
});
