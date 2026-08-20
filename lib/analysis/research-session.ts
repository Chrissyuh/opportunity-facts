import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ANALYZER_VERSION } from "./analyzer-version";
import type { AnalysisSourceContext } from "./model-extraction";
import type { AnalysisPipelineResult } from "./pipeline";
import type { PageAcquisitionFailure } from "./types";

export const RESEARCH_SESSION_TTL_MS = 30 * 60 * 1_000;
export const RESEARCH_SESSION_MAX_ENTRIES = 12;
export const RESEARCH_SESSION_MAX_SOURCE_CHARACTERS = 420_000;

export const extendedResearchRequestSchema = z.strictObject({
  sessionId: z.string().uuid(),
});

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

export interface ResearchSessionStore {
  create(input: Omit<ResearchSession, "id" | "analyzerVersion" | "createdAt" | "expiresAt" | "extendedResult" | "extendedCompletedSections" | "extendedFailedSections">): string | null;
  get(id: string): ResearchSession | null;
  saveExtended(
    id: string,
    result: AnalysisPipelineResult,
    completedSections: readonly ("details" | "financial")[],
    failedSections: readonly ("details" | "financial")[],
  ): void;
  delete(id: string): void;
}

export class InMemoryResearchSessionStore implements ResearchSessionStore {
  private readonly entries = new Map<string, ResearchSession>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly idFactory: () => string = randomUUID,
  ) {}

  private prune() {
    const now = this.now();
    for (const [id, session] of this.entries) {
      if (session.expiresAt <= now || session.analyzerVersion !== ANALYZER_VERSION) this.entries.delete(id);
    }
  }

  create(input: Omit<ResearchSession, "id" | "analyzerVersion" | "createdAt" | "expiresAt" | "extendedResult" | "extendedCompletedSections" | "extendedFailedSections">): string | null {
    const sourceCharacters = input.sources.reduce((sum, source) => sum + source.page.text.length, 0);
    if (sourceCharacters > RESEARCH_SESSION_MAX_SOURCE_CHARACTERS) return null;
    this.prune();
    while (this.entries.size >= RESEARCH_SESSION_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
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
    // Refresh insertion order without extending the privacy TTL.
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

  delete(id: string): void {
    this.entries.delete(id);
  }
}

const globalSessionSymbol = Symbol.for("opportunity-facts.research-sessions.v2");
type SessionGlobal = typeof globalThis & { [globalSessionSymbol]?: InMemoryResearchSessionStore };

export function createResearchSessionStore(): ResearchSessionStore {
  const shared = globalThis as SessionGlobal;
  shared[globalSessionSymbol] ??= new InMemoryResearchSessionStore();
  return shared[globalSessionSymbol];
}
