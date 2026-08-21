import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { opportunityCardSchema } from "@/lib/opportunity/schema";
import { ANALYZER_VERSION } from "./analyzer-version";
import { createSharedRedis, type SharedRedis } from "./shared-redis";
import type { AnalysisSourceContext } from "./model-extraction";
import type { AnalysisPipelineResult } from "./pipeline";
import type { PageAcquisitionFailure } from "./types";

export const RESEARCH_SESSION_TTL_MS = 30 * 60 * 1_000;
export const RESEARCH_SESSION_TTL_SECONDS = RESEARCH_SESSION_TTL_MS / 1_000;
export const RESEARCH_SESSION_MAX_ENTRIES = 12;
export const RESEARCH_SESSION_MAX_SOURCE_CHARACTERS = 420_000;
export const RESEARCH_SESSION_MAX_BYTES = 850_000;
export const RESEARCH_SESSION_LEASE_SECONDS = 180;

export const extendedResearchRequestSchema = z.strictObject({ sessionId: z.string().uuid() });

export interface ResearchSession {
  readonly id: string;
  readonly analyzerVersion: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly sources: readonly AnalysisSourceContext[];
  readonly pageWarnings: readonly PageAcquisitionFailure[];
  readonly normalResult: AnalysisPipelineResult;
  readonly extendedResult: AnalysisPipelineResult | null;
  readonly extendedCompletedSections: readonly ("details" | "financial")[];
  readonly extendedFailedSections: readonly ("details" | "financial")[];
}

type NewResearchSession = Omit<ResearchSession,
  "id" | "analyzerVersion" | "createdAt" | "expiresAt" |
  "extendedResult" | "extendedCompletedSections" | "extendedFailedSections"
>;
type MaybePromise<T> = T | Promise<T>;

export interface ResearchSessionStore {
  create(input: NewResearchSession): MaybePromise<string | null>;
  get(id: string): MaybePromise<ResearchSession | null>;
  saveExtended(
    id: string,
    result: AnalysisPipelineResult,
    completedSections: readonly ("details" | "financial")[],
    failedSections: readonly ("details" | "financial")[],
  ): MaybePromise<void>;
  delete(id: string): MaybePromise<void>;
  acquireLease(id: string): MaybePromise<string | null>;
  releaseLease(id: string, leaseToken: string): MaybePromise<void>;
}

function sessionSizeAllowed(input: NewResearchSession): boolean {
  const sourceCharacters = input.sources.reduce((sum, source) => sum + source.page.text.length, 0);
  if (sourceCharacters > RESEARCH_SESSION_MAX_SOURCE_CHARACTERS) return false;
  return new TextEncoder().encode(JSON.stringify(input)).byteLength <= RESEARCH_SESSION_MAX_BYTES;
}

function isSourceContext(value: unknown): value is AnalysisSourceContext {
  if (typeof value !== "object" || value === null) return false;
  const context = value as { readonly accessedAt?: unknown; readonly page?: unknown };
  if (typeof context.accessedAt !== "string" || typeof context.page !== "object" || context.page === null) return false;
  const page = context.page as { readonly id?: unknown; readonly url?: unknown; readonly title?: unknown; readonly text?: unknown };
  return typeof page.id === "string" && typeof page.url === "string" &&
    typeof page.title === "string" && typeof page.text === "string";
}

function isPipelineResult(value: unknown): value is AnalysisPipelineResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as { readonly card?: unknown; readonly reviewedPages?: unknown; readonly pageWarnings?: unknown };
  return opportunityCardSchema.safeParse(result.card).success &&
    Array.isArray(result.reviewedPages) && Array.isArray(result.pageWarnings);
}

function parseStoredSession(value: unknown, now = Date.now()): ResearchSession | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<ResearchSession>;
  if (
    typeof candidate.id !== "string" || !z.string().uuid().safeParse(candidate.id).success ||
    candidate.analyzerVersion !== ANALYZER_VERSION ||
    typeof candidate.createdAt !== "number" || typeof candidate.expiresAt !== "number" ||
    candidate.expiresAt <= now ||
    !Array.isArray(candidate.sources) || !candidate.sources.every(isSourceContext) ||
    !Array.isArray(candidate.pageWarnings) ||
    !isPipelineResult(candidate.normalResult) ||
    (candidate.extendedResult !== null && !isPipelineResult(candidate.extendedResult)) ||
    !Array.isArray(candidate.extendedCompletedSections) ||
    !Array.isArray(candidate.extendedFailedSections)
  ) return null;
  return candidate as ResearchSession;
}

export class InMemoryResearchSessionStore implements ResearchSessionStore {
  private readonly entries = new Map<string, ResearchSession>();
  private readonly leases = new Map<string, string>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly idFactory: () => string = randomUUID,
  ) {}

  private prune() {
    const now = this.now();
    for (const [id, session] of this.entries) {
      if (session.expiresAt <= now || session.analyzerVersion !== ANALYZER_VERSION) {
        this.entries.delete(id);
        this.leases.delete(id);
      }
    }
  }

  create(input: NewResearchSession): string | null {
    if (!sessionSizeAllowed(input)) return null;
    this.prune();
    while (this.entries.size >= RESEARCH_SESSION_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      this.leases.delete(oldest);
    }
    const createdAt = this.now();
    const id = this.idFactory();
    this.entries.set(id, {
      ...input,
      id,
      analyzerVersion: ANALYZER_VERSION,
      createdAt,
      expiresAt: createdAt + RESEARCH_SESSION_TTL_MS,
      extendedResult: null,
      extendedCompletedSections: [],
      extendedFailedSections: [],
    });
    return id;
  }

  get(id: string): ResearchSession | null {
    this.prune();
    const session = this.entries.get(id);
    if (!session || session.analyzerVersion !== ANALYZER_VERSION || session.expiresAt <= this.now()) return null;
    this.entries.delete(id);
    this.entries.set(id, session);
    return session;
  }

  saveExtended(
    id: string,
    result: AnalysisPipelineResult,
    completedSections: readonly ("details" | "financial")[],
    failedSections: readonly ("details" | "financial")[],
  ): void {
    const session = this.get(id);
    if (!session) return;
    this.entries.set(id, {
      ...session,
      extendedResult: result,
      extendedCompletedSections: completedSections,
      extendedFailedSections: failedSections,
    });
  }

  delete(id: string): void { this.entries.delete(id); this.leases.delete(id); }

  acquireLease(id: string): string | null {
    if (!this.get(id) || this.leases.has(id)) return null;
    const token = randomUUID();
    this.leases.set(id, token);
    return token;
  }

  releaseLease(id: string, leaseToken: string): void {
    if (this.leases.get(id) === leaseToken) this.leases.delete(id);
  }
}

const RELEASE_LEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export class UpstashResearchSessionStore implements ResearchSessionStore {
  constructor(
    private readonly redis: SharedRedis,
    private readonly now: () => number = Date.now,
    private readonly idFactory: () => string = randomUUID,
  ) {}

  private key(id: string) { return `opportunity-facts:research-session:${id}`; }
  private leaseKey(id: string) { return `opportunity-facts:research-session-lease:${id}`; }

  async create(input: NewResearchSession): Promise<string | null> {
    if (!sessionSizeAllowed(input)) return null;
    const createdAt = this.now();
    const id = this.idFactory();
    const session: ResearchSession = {
      ...input,
      id,
      analyzerVersion: ANALYZER_VERSION,
      createdAt,
      expiresAt: createdAt + RESEARCH_SESSION_TTL_MS,
      extendedResult: null,
      extendedCompletedSections: [],
      extendedFailedSections: [],
    };
    const result = await this.redis.command(["SET", this.key(id), JSON.stringify(session), "EX", RESEARCH_SESSION_TTL_SECONDS, "NX"]);
    return result === "OK" ? id : null;
  }

  async get(id: string): Promise<ResearchSession | null> {
    const value = await this.redis.command(["GET", this.key(id)]);
    if (value === null || value === undefined) return null;
    let decoded: unknown;
    try { decoded = typeof value === "string" ? JSON.parse(value) : value; } catch { decoded = null; }
    const session = parseStoredSession(decoded, this.now());
    if (session === null) await this.delete(id).catch(() => undefined);
    return session;
  }

  async saveExtended(
    id: string,
    result: AnalysisPipelineResult,
    completedSections: readonly ("details" | "financial")[],
    failedSections: readonly ("details" | "financial")[],
  ): Promise<void> {
    const session = await this.get(id);
    if (!session) return;
    const remainingSeconds = Math.max(1, Math.ceil((session.expiresAt - this.now()) / 1_000));
    const updated: ResearchSession = {
      ...session,
      extendedResult: result,
      extendedCompletedSections: completedSections,
      extendedFailedSections: failedSections,
    };
    if (new TextEncoder().encode(JSON.stringify(updated)).byteLength > RESEARCH_SESSION_MAX_BYTES) return;
    await this.redis.command(["SET", this.key(id), JSON.stringify(updated), "EX", remainingSeconds, "XX"]);
  }

  async delete(id: string): Promise<void> { await this.redis.command(["DEL", this.key(id), this.leaseKey(id)]); }

  async acquireLease(id: string): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.command(["SET", this.leaseKey(id), token, "EX", RESEARCH_SESSION_LEASE_SECONDS, "NX"]);
    return result === "OK" ? token : null;
  }

  async releaseLease(id: string, leaseToken: string): Promise<void> {
    await this.redis.command(["EVAL", RELEASE_LEASE_SCRIPT, 1, this.leaseKey(id), leaseToken]);
  }
}

export class UnavailableResearchSessionStore implements ResearchSessionStore {
  create(): null { return null; }
  get(): null { return null; }
  saveExtended(): void {}
  delete(): void {}
  acquireLease(): null { return null; }
  releaseLease(): void {}
}

const globalSessionSymbol = Symbol.for("opportunity-facts.research-sessions.v3");
type SessionGlobal = typeof globalThis & { [globalSessionSymbol]?: InMemoryResearchSessionStore };

function requiresDurableSessions(environment: Readonly<Record<string, string | undefined>>): boolean {
  const explicit = environment.ANALYSIS_SHARED_CONTROLS_REQUIRED?.trim().toLowerCase();
  if (explicit !== undefined && explicit !== "") return ["1", "true", "yes", "on"].includes(explicit);
  return environment.VERCEL_ENV === "production";
}

export function createResearchSessionStore(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ResearchSessionStore {
  const redis = createSharedRedis(environment);
  if (redis !== null) return new UpstashResearchSessionStore(redis);
  if (requiresDurableSessions(environment)) return new UnavailableResearchSessionStore();
  const shared = globalThis as SessionGlobal;
  shared[globalSessionSymbol] ??= new InMemoryResearchSessionStore();
  return shared[globalSessionSymbol];
}
