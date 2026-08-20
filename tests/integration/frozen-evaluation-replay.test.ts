import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  extractOpportunityCard,
  type AnalysisSourceContext,
  type ModelExtraction,
} from "@/lib/analysis/model-extraction";

interface ArtifactSource {
  id: string;
  url: string;
  title: string;
  accessedAt: string;
}

interface EvaluationArtifact {
  acquisition: { successfullyAcquired: ArtifactSource[] };
  modelOutput: { rawStructuredCandidate: ModelExtraction };
}

function collectExcerpts(value: unknown, bySourceId = new Map<string, Set<string>>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectExcerpts(item, bySourceId));
    return bySourceId;
  }
  if (typeof value !== "object" || value === null) return bySourceId;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.sources)) {
    for (const source of record.sources) {
      if (typeof source !== "object" || source === null) continue;
      const evidence = source as { id?: unknown; excerpt?: unknown };
      if (typeof evidence.id !== "string" || typeof evidence.excerpt !== "string") continue;
      const excerpts = bySourceId.get(evidence.id) ?? new Set<string>();
      excerpts.add(evidence.excerpt);
      bySourceId.set(evidence.id, excerpts);
    }
  }
  Object.values(record).forEach((child) => collectExcerpts(child, bySourceId));
  return bySourceId;
}

function replayArtifact(filename: string): {
  artifact: EvaluationArtifact;
  sources: AnalysisSourceContext[];
} {
  const artifact = JSON.parse(
    readFileSync(
      join(process.cwd(), "research", "extraction-evaluation", "first-pass", filename),
      "utf8",
    ),
  ) as EvaluationArtifact;
  const excerpts = collectExcerpts(artifact.modelOutput.rawStructuredCandidate);
  const sources = artifact.acquisition.successfullyAcquired.map((source) => {
    const blocks = [...(excerpts.get(source.id) ?? [])].map((text) => ({
      kind: "paragraph" as const,
      text,
    }));
    return {
      accessedAt: source.accessedAt,
      page: {
        id: source.id,
        url: source.url,
        title: source.title,
        pageType: "user_supplied" as const,
        trust: "untrusted_source_text" as const,
        text: blocks.map((block) => block.text).join("\n"),
        blocks,
        links: [],
        truncated: false,
      },
    };
  });
  return { artifact, sources };
}

describe("closed out-of-sample artifact replay", () => {
  it("withholds the teacher-only Breakthrough benefit from participant benefits", async () => {
    const { artifact, sources } = replayArtifact(
      "breakthrough-junior-challenge-2026-run-01.json",
    );
    const result = await extractOpportunityCard(
      sources,
      async () => artifact.modelOutput.rawStructuredCandidate,
    );
    expect(result.card.facts.other_benefits.status).toBe("unclear");
    expect(result.card.cycle.status === "modeled" && result.card.cycle.value.label.value).toBe("2026");
  });

  it("withholds CAC eligibility geography and optional-SMS terms from unrelated fields", async () => {
    const { artifact, sources } = replayArtifact(
      "congressional-app-challenge-2026-run-01.json",
    );
    const result = await extractOpportunityCard(
      sources,
      async () => artifact.modelOutput.rawStructuredCandidate,
    );
    expect(result.card.facts.location.status).toBe("unclear");
    expect(result.card.facts.cancellation_rights.status).toBe("unclear");
    expect(result.card.facts.material_terms.status).toBe("unclear");
    expect(result.card.cycle.status === "modeled" && result.card.cycle.value.label.value).toBe("2026");
  });

  it("keeps the supported MITES selection wording while withholding national reach as eligibility", async () => {
    const { artifact, sources } = replayArtifact(
      "mites-summer-2027-run-01.json",
    );
    const result = await extractOpportunityCard(
      sources,
      async () => artifact.modelOutput.rawStructuredCandidate,
    );
    expect(result.card.facts.geographic_restrictions.status).toBe("unclear");
    expect(result.card.facts.selection_process.status).toBe("disclosed");
    expect(result.card.facts.selection_process.displayValue).toBe("Holistic selection process");
    expect(result.card.cycle.status === "modeled" && result.card.cycle.value.label.value).toBe("Summer 2027");
  });

  it("withholds all three Polygence platform/legal subject errors", async () => {
    const { artifact, sources } = replayArtifact(
      "polygence-core-program-fall-2026-run-01.json",
    );
    const result = await extractOpportunityCard(
      sources,
      async () => artifact.modelOutput.rawStructuredCandidate,
    );
    expect(result.card.facts.ages.status).toBe("unclear");
    expect(result.card.facts.geographic_restrictions.status).toBe("unclear");
    expect(result.card.facts.sponsor_requirement.status).toBe("unclear");
    expect(result.card.facts.program_seat.status).toBe("unclear");
  });

  it("does not promote the historical QuestBridge count without target-cycle alignment", async () => {
    const { artifact, sources } = replayArtifact(
      "questbridge-national-college-match-2026-run-01.json",
    );
    const result = await extractOpportunityCard(
      sources,
      async () => artifact.modelOutput.rawStructuredCandidate,
    );
    expect(result.card.facts.acceptance_count.status).toBe("unclear");
    expect(result.card.facts.acceptance_count.note).toMatch(/target cycle/i);
    expect(result.card.facts.entry_format.status).toBe("unclear");
    expect(result.card.facts.entry_format.note).toMatch(/individual entry/i);
  });

  it("preserves Yale application-plan fees without labeling them cohort variation", async () => {
    const { artifact, sources } = replayArtifact(
      "yale-young-global-scholars-summer-2027-run-01.json",
    );
    const result = await extractOpportunityCard(
      sources,
      async () => artifact.modelOutput.rawStructuredCandidate,
    );
    expect(result.card.facts.application_fee.status).toBe("disclosed");
    expect(result.card.facts.application_fee.displayValue).toBe(
      "Multiple application fees — see cost details",
    );
    expect(result.card.facts.cancellation_rights.status).toBe("unclear");
    expect(result.card.cycle.status === "modeled" && result.card.cycle.value.label.value).toBe("Summer 2027");
  });
});
