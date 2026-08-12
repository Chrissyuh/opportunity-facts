import "server-only";

import {
  cycleContainerSchema,
  type EvidenceSource,
} from "@/lib/opportunity";
import type { AnalysisSourceContext } from "./model-extraction";

const SEASON_PATTERN = "Winter|Spring|Summer|Fall|Autumn";
const YEAR_RANGE = /\b(20\d{2})\s*[\u2013\u2014-]\s*(20\d{2})\b/gu;
const SEASON_YEAR = new RegExp(`\\b(${SEASON_PATTERN})\\s+(20\\d{2})\\b`, "giu");
const CYCLE_YEAR = /\b(20\d{2})\s+(?:competition\s+)?(?:cycle|cohort|class|program|challenge|competition)\b/giu;

interface CycleCandidate {
  readonly label: string;
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly year: number | null;
  readonly season: "winter" | "spring" | "summer" | "fall" | null;
  readonly cycleType: "academic_year" | "calendar_year" | "seasonal" | "competition_cycle" | "cohort" | "rolling" | "current" | "other";
  readonly excerpt: string;
  readonly source: AnalysisSourceContext;
  readonly score: number;
}

function evidence(source: AnalysisSourceContext, excerpt: string): EvidenceSource {
  return {
    id: source.page.id,
    url: source.page.url,
    title: source.page.title,
    pageType: source.page.pageType,
    accessedAt: source.accessedAt,
    excerpt,
  };
}

function candidateScore(
  excerpt: string,
  sourceIndex: number,
  blockKind: string,
): number {
  let score = sourceIndex === 0 ? 8 : 0;
  if (blockKind === "heading") score += 6;
  if (/\b(apply|application|deadline|current|upcoming|cycle|cohort|class|program|challenge|competition)\b/iu.test(excerpt)) score += 4;
  if (/\b(last year|previous year|historical|in prior years?|alumni|since 20\d{2}|matched in|winners? in)\b/iu.test(excerpt)) score -= 10;
  if (/\b(statistic|applicants?|accepted|selected|winners?|finalists?|participants?)\b/iu.test(excerpt) && !/\b(apply|application|deadline|cycle|cohort)\b/iu.test(excerpt)) score -= 4;
  return score;
}

function pushCandidates(
  candidates: CycleCandidate[],
  source: AnalysisSourceContext,
  sourceIndex: number,
  excerpt: string,
  blockKind: string,
) {
  const normalized = excerpt.trim();
  if (!normalized) return;
  const score = candidateScore(normalized, sourceIndex, blockKind);

  const applicationParticipation = normalized.match(
    new RegExp(
      `\\b(20\\d{2})\\s+application\\b.{0,100}?\\b(?:(${SEASON_PATTERN})\\s+)?(20\\d{2})\\s+(?:entry|enrollment|participation|program|start)\\b`,
      "iu",
    ),
  );
  if (applicationParticipation) {
    const applicationYear = Number(applicationParticipation[1]);
    const participationYear = Number(applicationParticipation[3]);
    const rawSeason = applicationParticipation[2]?.toLowerCase() ?? null;
    const season = rawSeason === null
      ? null
      : (rawSeason === "autumn" ? "fall" : rawSeason) as Exclude<CycleCandidate["season"], null>;
    const participationLabel = season === null
      ? `${participationYear} entry`
      : `${season[0].toUpperCase()}${season.slice(1)} ${participationYear} entry`;
    candidates.push({
      label: `${applicationYear} application / ${participationLabel}`,
      startYear: applicationYear,
      endYear: participationYear,
      year: participationYear,
      season,
      cycleType: "other",
      excerpt: normalized,
      source,
      score: score + 8,
    });
  }

  if (/\brolling (?:admissions?|applications?)\b/iu.test(normalized)) {
    candidates.push({
      label: "Rolling admissions",
      startYear: null,
      endYear: null,
      year: null,
      season: null,
      cycleType: "rolling",
      excerpt: normalized,
      source,
      score: score + 5,
    });
  }

  for (const match of normalized.matchAll(YEAR_RANGE)) {
    const startYear = Number(match[1]);
    const endYear = Number(match[2]);
    if (endYear < startYear || endYear - startYear > 2) continue;
    candidates.push({
      label: `${startYear}\u2013${endYear}`,
      startYear,
      endYear,
      year: null,
      season: null,
      cycleType: "academic_year",
      excerpt: normalized,
      source,
      score: score + 2,
    });
  }

  for (const match of normalized.matchAll(SEASON_YEAR)) {
    const rawSeason = match[1].toLowerCase();
    const season = (rawSeason === "autumn" ? "fall" : rawSeason) as Exclude<
      CycleCandidate["season"],
      null
    >;
    const year = Number(match[2]);
    candidates.push({
      label: `${season[0].toUpperCase()}${season.slice(1)} ${year}`,
      startYear: null,
      endYear: null,
      year,
      season,
      cycleType: "seasonal",
      excerpt: normalized,
      source,
      score: score + 3,
    });
  }

  for (const match of normalized.matchAll(CYCLE_YEAR)) {
    const year = Number(match[1]);
    candidates.push({
      label: `${year}`,
      startYear: null,
      endYear: null,
      year,
      season: null,
      cycleType: /\b(?:challenge|competition)\b/iu.test(normalized)
        ? "competition_cycle"
        : /\bcohort\b/iu.test(normalized)
          ? "cohort"
          : "other",
      excerpt: normalized,
      source,
      score,
    });
  }
}

function cycleStatus(excerpt: string): {
  status: "announced" | "applications_open" | "applications_closed" | "active" | "complete";
  display: string;
} | null {
  if (/\b(applications? (?:are )?open|apply now|accepting applications?)\b/iu.test(excerpt)) {
    return { status: "applications_open", display: "Applications open" };
  }
  if (/\b(applications? (?:are )?closed|submissions? (?:are )?closed|deadline (?:has )?passed)\b/iu.test(excerpt)) {
    return { status: "applications_closed", display: "Applications closed" };
  }
  if (/\b(announced|upcoming|coming in|will open|will begin)\b/iu.test(excerpt)) {
    return { status: "announced", display: "Announced" };
  }
  if (/\b(in progress|underway|currently running)\b/iu.test(excerpt)) {
    return { status: "active", display: "Active" };
  }
  if (/\b(completed|concluded|has ended)\b/iu.test(excerpt)) {
    return { status: "complete", display: "Complete" };
  }
  return null;
}

export interface ResolvedCycleContext {
  readonly label: string;
  readonly years: readonly number[];
  readonly sourceId: string;
  readonly excerpt: string;
  readonly cycle: ReturnType<typeof cycleContainerSchema.parse>;
}

export function resolveExplicitCycle(
  sources: readonly AnalysisSourceContext[],
): ResolvedCycleContext | null {
  const candidates: CycleCandidate[] = [];
  sources.forEach((source, sourceIndex) => {
    source.page.blocks.slice(0, 80).forEach((block) => {
      pushCandidates(candidates, source, sourceIndex, block.text, block.kind);
    });
  });
  if (candidates.length === 0) return null;

  const bestByLabel = new Map<string, CycleCandidate>();
  for (const candidate of candidates) {
    const existing = bestByLabel.get(candidate.label);
    if (!existing || candidate.score > existing.score) bestByLabel.set(candidate.label, candidate);
  }
  const ranked = [...bestByLabel.values()].sort((left, right) => right.score - left.score);
  const best = ranked[0];
  if (!best || best.score < 4) return null;
  const runnerUp = ranked[1];
  if (runnerUp && runnerUp.label !== best.label && runnerUp.score >= best.score - 1) return null;

  const source = evidence(best.source, best.excerpt);
  const status = cycleStatus(best.excerpt);
  const cycleType = best.cycleType;
  const id = `cycle-${best.label.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "")}`;
  const claim = (claimId: string, value: unknown, displayValue: string) => ({
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources: [source],
    note: null,
    conflictingValues: [],
  });
  const unclear = (claimId: string, note: string) => ({
    claimId,
    status: "unclear" as const,
    value: null,
    displayValue: null,
    claimKind: null,
    sources: [source],
    note,
    conflictingValues: [],
  });

  const cycle = cycleContainerSchema.parse({
    status: "modeled",
    value: {
      id,
      label: claim(`${id}-label`, best.label, best.label),
      status: status
        ? claim(`${id}-status`, status.status, status.display)
        : unclear(`${id}-status`, "The source identifies the cycle but does not clearly state its current application status."),
      year: best.year === null ? null : claim(`${id}-year`, best.year, String(best.year)),
      startYear: best.startYear === null ? null : claim(`${id}-start-year`, best.startYear, String(best.startYear)),
      endYear: best.endYear === null ? null : claim(`${id}-end-year`, best.endYear, String(best.endYear)),
      season: best.season === null
        ? null
        : claim(`${id}-season`, best.season, `${best.season[0].toUpperCase()}${best.season.slice(1)}`),
      cycleType: claim(
        `${id}-type`,
        cycleType,
        cycleType === "seasonal"
          ? "Seasonal cohort"
          : cycleType === "academic_year"
            ? "Academic-year cycle"
            : cycleType === "competition_cycle"
              ? "Competition cycle"
              : cycleType === "rolling"
                ? "Rolling admissions"
                : "Named cycle",
      ),
      timingRefs: { opens: null, closes: null, coverageStart: null, coverageEnd: null },
    },
  });
  const years = [best.year, best.startYear, best.endYear].filter(
    (value): value is number => value !== null,
  );
  return { label: best.label, years, sourceId: best.source.page.id, excerpt: best.excerpt, cycle };
}

export function evidenceMatchesResolvedCycle(
  excerpt: string,
  cycle: ResolvedCycleContext,
): boolean {
  if (/\b(last year|previous year|prior year|historical|earlier cohort|past cohort)\b/iu.test(excerpt)) {
    return false;
  }
  const years = [...excerpt.matchAll(/\b(20\d{2})\b/gu)].map((match) => Number(match[1]));
  if (years.length === 0) return true;
  return years.every((year) => cycle.years.includes(year));
}
