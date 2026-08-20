import "server-only";

import {
  cycleContainerSchema,
  type EvidenceSource,
} from "@/lib/opportunity";
import type { AnalysisSourceContext } from "./model-extraction";

const SEASON_PATTERN = "Winter|Spring|Summer|Fall|Autumn";
const YEAR_RANGE = /\b(20\d{2})\s*[\u2013\u2014-]\s*(20\d{2})\b/gu;
const SHORT_YEAR_RANGE = /\b(20\d{2})\s*[\u2013\u2014-]\s*(\d{2})\b/gu;
const SEASON_YEAR = new RegExp(
  `\\b(${SEASON_PATTERN})(?:\\s+cohort)?\\s+(20\\d{2})\\b`,
  "giu",
);
const YEAR_SEASON = new RegExp(
  `\\b(20\\d{2})\\b.{0,60}?\\b(${SEASON_PATTERN})(?:\\s+(?:dates?|sessions?|cohort|program))?\\b`,
  "giu",
);
const CYCLE_YEAR = /\b(20\d{2})\s+(?:competition\s+)?(?:cycle|cohort|class|program|challenge|competition)\b/giu;
const MONTHS_YEAR = /\b(June|July|August)(?:\s*(?:&|and|,|through|to|-)\s*(?:June|July|August))?\s+(20\d{2})\b/giu;
const CURRENT_CYCLE_CONTEXT = /\b(?:apply|application|deadline|due|submissions?|sessions?|program|challenge|competition|scholars?|match|timeline|dates?|cohort|class|entry|enrollment|admissions?|current|upcoming|open)\b/iu;
const HISTORICAL_CONTEXT = /\b(?:last year|previous year|historical|in prior years?|alumni|since 20\d{2}|matched in|winners? in|selected in|class of)\b/iu;
const ELIGIBILITY_SCHOOL_YEAR_CONTEXT = /\b(?:graduate|graduation|eligible|eligibility)\b.{0,100}\b(?:academic |school )?year\b|\b(?:academic |school )?year\b.{0,100}\b(?:graduate|graduation|eligible|eligibility)\b/iu;

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
  if (blockKind === "title") score += 8;
  if (/\b(apply|application|deadline|current|upcoming|cycle|cohort|class|program|challenge|competition)\b/iu.test(excerpt)) score += 4;
  if (/\b(last year|previous year|historical|in prior years?|alumni|since 20\d{2}|matched in|winners? in)\b/iu.test(excerpt)) score -= 10;
  if (ELIGIBILITY_SCHOOL_YEAR_CONTEXT.test(excerpt)) score -= 8;
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
  const eligibilityYearContext = ELIGIBILITY_SCHOOL_YEAR_CONTEXT.test(normalized);
  const targetIdentityText = `${normalized} ${source.page.title}`;
  const inferCycleType = (text: string): CycleCandidate["cycleType"] =>
    /\b(?:challenge|competition)\b/iu.test(text)
      ? "competition_cycle"
      : /\bcohort\b/iu.test(text)
        ? "cohort"
        : "other";

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

  const pendingDates = normalized.match(
    /\b(20\d{2})\s+dates?\s+(?:tbd|pending|not yet available|to be announced)\b/iu,
  );
  if (pendingDates) {
    const year = Number(pendingDates[1]);
    const seasonMatch = targetIdentityText.match(new RegExp(`\\b(${SEASON_PATTERN})\\b`, "iu"));
    const rawSeason = seasonMatch?.[1]?.toLowerCase() ?? null;
    const season = rawSeason === null
      ? null
      : (rawSeason === "autumn" ? "fall" : rawSeason) as Exclude<CycleCandidate["season"], null>;
    const seasonLabel = season === null
      ? String(year)
      : `${season[0].toUpperCase()}${season.slice(1)} ${year}`;
    candidates.push({
      label: seasonLabel,
      startYear: null,
      endYear: null,
      year,
      season,
      cycleType: season === null ? inferCycleType(targetIdentityText) : "seasonal",
      excerpt: normalized,
      source,
      score: score + 10,
    });
  }

  if (
    /\brolling (?:admissions?|applications?)\b/iu.test(normalized) ||
    /\beach month\b.{0,80}\b(?:new )?cohort\b/iu.test(normalized)
  ) {
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

  for (const match of eligibilityYearContext ? [] : normalized.matchAll(YEAR_RANGE)) {
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

  for (const match of eligibilityYearContext ? [] : normalized.matchAll(SHORT_YEAR_RANGE)) {
    const startYear = Number(match[1]);
    const shortEndYear = Number(match[2]);
    const endYear = Math.floor(startYear / 100) * 100 + shortEndYear;
    if (endYear < startYear || endYear - startYear > 2) continue;
    candidates.push({
      label: `${startYear}\u2013${endYear}`,
      startYear,
      endYear,
      year: null,
      season: null,
      cycleType: /\b(?:academic|school)\s+year\b/iu.test(normalized)
        ? "academic_year"
        : inferCycleType(targetIdentityText),
      excerpt: normalized,
      source,
      score: score + 3,
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


  for (const match of normalized.matchAll(YEAR_SEASON)) {
    const year = Number(match[1]);
    const rawSeason = match[2].toLowerCase();
    const season = (rawSeason === "autumn" ? "fall" : rawSeason) as Exclude<
      CycleCandidate["season"],
      null
    >;
    candidates.push({
      label: `${season[0].toUpperCase()}${season.slice(1)} ${year}`,
      startYear: null,
      endYear: null,
      year,
      season,
      cycleType: /\bcohort\b/iu.test(normalized) ? "cohort" : "seasonal",
      excerpt: normalized,
      source,
      score: score + 3,
    });
  }

  for (const match of normalized.matchAll(MONTHS_YEAR)) {
    const year = Number(match[2]);
    candidates.push({
      label: `Summer ${year}`,
      startYear: null,
      endYear: null,
      year,
      season: "summer",
      cycleType: "seasonal",
      excerpt: normalized,
      source,
      score: score + 4,
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
      cycleType: inferCycleType(targetIdentityText),
      excerpt: normalized,
      source,
      score,
    });
  }


  if (CURRENT_CYCLE_CONTEXT.test(normalized) && !eligibilityYearContext) {
    for (const match of normalized.matchAll(/\b(20\d{2})\b/gu)) {
      const year = Number(match[1]);
      candidates.push({
        label: String(year),
        startYear: null,
        endYear: null,
        year,
        season: null,
        cycleType: inferCycleType(targetIdentityText),
        excerpt: normalized,
        source,
        score: score + (/\b(?:application|submissions?|deadline|due|current|open)\b/iu.test(normalized) ? 3 : 0),
      });
    }
  }
}

function candidateYears(candidate: CycleCandidate): number[] {
  return [candidate.year, candidate.startYear, candidate.endYear].filter(
    (value): value is number => value !== null,
  );
}

function candidatesAreCompatible(left: CycleCandidate, right: CycleCandidate): boolean {
  if (left.label === right.label) return true;
  if (left.cycleType === "rolling" || right.cycleType === "rolling") return false;
  if (
    left.season !== null &&
    right.season !== null &&
    left.season !== right.season
  ) return false;
  const leftYears = candidateYears(left);
  const rightYears = candidateYears(right);
  return leftYears.some((year) => rightYears.includes(year));
}

function cycleStatus(excerpt: string): {
  status: "announced" | "applications_open" | "applications_closed" | "active" | "complete";
  display: string;
} | null {
  if (/\b(applications? (?:are )?(?:(?:now|currently) )?open|apply now|accepting applications?)\b/iu.test(excerpt)) {
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
    pushCandidates(candidates, source, sourceIndex, source.page.title, "title");
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
  if (
    runnerUp &&
    !candidatesAreCompatible(best, runnerUp) &&
    runnerUp.score >= best.score - 1
  ) return null;

  const lifecycleContinuation = best.year === null
    ? null
    : ranked.find((candidate) =>
        candidate !== best &&
        candidate.year === best.year! + 1 &&
        candidate.season !== null &&
        !HISTORICAL_CONTEXT.test(candidate.excerpt) &&
        !ELIGIBILITY_SCHOOL_YEAR_CONTEXT.test(candidate.excerpt) &&
        /\b(?:entry|enroll(?:ment|s|ed|ing)?|attend(?:s|ed|ing|ance)?|participation)\b/iu.test(
          candidate.excerpt,
        ),
      ) ?? null;
  const resolvedLabel = lifecycleContinuation === null
    ? best.label
    : `${best.label} / ${lifecycleContinuation.label} entry`;
  const source = evidence(best.source, best.excerpt);
  const continuationSource = lifecycleContinuation === null
    ? null
    : evidence(lifecycleContinuation.source, lifecycleContinuation.excerpt);
  const status = cycleStatus(best.excerpt);
  const cycleType = best.cycleType;
  const id = `cycle-${resolvedLabel.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "")}`;
  const claim = (
    claimId: string,
    value: unknown,
    displayValue: string,
    sources = [source],
    claimKind: "source_stated" | "organizer_stated" = "source_stated",
  ) => ({
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind,
    sources,
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
      label: claim(
        `${id}-label`,
        resolvedLabel,
        resolvedLabel,
        continuationSource === null ? [source] : [source, continuationSource],
        "source_stated",
      ),
      status: status
        ? claim(`${id}-status`, status.status, status.display)
        : unclear(`${id}-status`, "The source identifies the cycle but does not clearly state its current application status."),
      year: best.year === null ? null : claim(`${id}-year`, best.year, String(best.year)),
      startYear: best.startYear === null && lifecycleContinuation === null
        ? null
        : claim(
            `${id}-start-year`,
            best.startYear ?? best.year,
            String(best.startYear ?? best.year),
          ),
      endYear: best.endYear === null && lifecycleContinuation === null
        ? null
        : claim(
            `${id}-end-year`,
            best.endYear ?? lifecycleContinuation!.year,
            String(best.endYear ?? lifecycleContinuation!.year),
            best.endYear === null && continuationSource !== null
              ? [continuationSource]
              : [source],
          ),
      season: best.season === null && lifecycleContinuation?.season === null
        ? null
        : (() => {
            const season = best.season ?? lifecycleContinuation?.season;
            return season === null || season === undefined
              ? null
              : claim(
                  `${id}-season`,
                  season,
                  `${season[0].toUpperCase()}${season.slice(1)}`,
                  best.season === null && continuationSource !== null
                    ? [continuationSource]
                    : [source],
                );
          })(),
      cycleType: cycleType === "other"
        ? unclear(
            `${id}-type`,
            "The source identifies the target cycle but does not explicitly establish a standard cycle type.",
          )
        : claim(
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
                    : cycleType === "cohort"
                      ? "Cohort"
                      : cycleType === "calendar_year"
                        ? "Calendar-year cycle"
                        : "Current cycle",
          ),
      timingRefs: { opens: null, closes: null, coverageStart: null, coverageEnd: null },
    },
  });
  const bestYears = candidateYears(best);
  const years = [...new Set(
    candidates.flatMap((candidate) => {
      const candidateYearValues = candidateYears(candidate);
      const lifecycleContext = /\b(?:application|deadline|submissions?|requirements?|admissions? decisions?|entry|enroll(?:ment|s|ed|ing)?|attend(?:s|ed|ing|ance)?|participation|program (?:begins|starts)|sessions?|academic school year)\b/iu.test(candidate.excerpt);
      const adjacentToAnchor = candidateYearValues.some((year) =>
        bestYears.some((anchorYear) => Math.abs(year - anchorYear) <= 1),
      );
      if (
        HISTORICAL_CONTEXT.test(candidate.excerpt) ||
        ELIGIBILITY_SCHOOL_YEAR_CONTEXT.test(candidate.excerpt) ||
        (!candidatesAreCompatible(best, candidate) && !(lifecycleContext && adjacentToAnchor))
      ) return [];
      return candidateYearValues;
    }),
  )].sort((left, right) => left - right);
  return {
    label: resolvedLabel,
    years,
    sourceId: best.source.page.id,
    excerpt: continuationSource === null
      ? best.excerpt
      : `${best.excerpt} ${continuationSource.excerpt}`,
    cycle,
  };
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
