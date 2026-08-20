import "server-only";

import type { AnalysisSourceContext } from "./model-extraction";

const IDENTITY_PATH_MARKERS = new Set([
  "challenge",
  "challenges",
  "competition",
  "competitions",
  "opportunity",
  "opportunities",
  "program",
  "programs",
  "programme",
  "programmes",
  "scholarship",
  "scholarships",
]);

const IDENTITY_STOP_WORDS = new Set([
  "a",
  "about",
  "and",
  "apply",
  "application",
  "at",
  "by",
  "for",
  "from",
  "home",
  "in",
  "of",
  "official",
  "on",
  "program",
  "programme",
  "scholarship",
  "student",
  "students",
  "the",
  "to",
  "with",
]);

const GENERIC_PAGE_TITLE_WORDS = new Set([
  "about",
  "aid",
  "apply",
  "eligibility",
  "faq",
  "financial",
  "frequently",
  "home",
  "how",
  "asked",
  "privacy",
  "policy",
  "questions",
  "regulations",
  "requirements",
  "rules",
  "service",
  "terms",
  "tuition",
  "welcome",
]);

const NAMED_OPPORTUNITY_KIND =
  /\b(challenge|competition|conference|contest|fellowship|internship|match|olympiad|prize program|research program|summer program)\b/iu;

const GENERIC_IDENTITY_WORDS = new Set([
  "challenge",
  "college",
  "competition",
  "conference",
  "contest",
  "fellow",
  "global",
  "high",
  "international",
  "junior",
  "match",
  "national",
  "prize",
  "research",
  "school",
  "scholar",
  "scholars",
  "senior",
  "summer",
  "young",
  "youth",
]);

function words(value: string): string[] {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .map((word) => ["fellow", "fellows", "fellowship", "fellowships"].includes(word) ? "fellow" : word)
    .filter((word) => word.length >= 3 && !IDENTITY_STOP_WORDS.has(word));
}

function titleIdentity(title: string): Set<string> {
  const segments = title.split(/\s+[|\u2013\u2014:]\s+/u);
  const primary = words(segments[0] ?? title);
  if (
    segments.length > 1 &&
    (primary.length === 0 || primary.every((word) => GENERIC_PAGE_TITLE_WORDS.has(word)))
  ) {
    return new Set(words(segments.at(-1) ?? title));
  }
  return new Set(primary);
}

function pathIdentity(url: string): string | null {
  const segments = new URL(url).pathname
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment).toLowerCase();
      } catch {
        return segment.toLowerCase();
      }
    })
    .filter(Boolean);
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (IDENTITY_PATH_MARKERS.has(segments[index])) {
      const next = segments[index + 1];
      if (next && !IDENTITY_PATH_MARKERS.has(next)) return next;
    }
  }
  return null;
}

function overlap(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

function distinctive(tokens: ReadonlySet<string>): Set<string> {
  return new Set(
    [...tokens].filter(
      (token) =>
        !GENERIC_IDENTITY_WORDS.has(token) &&
        !GENERIC_PAGE_TITLE_WORDS.has(token),
    ),
  );
}

function identityMatch(
  targetTokens: ReadonlySet<string>,
  candidateTokens: ReadonlySet<string>,
): boolean {
  const targetDistinctive = distinctive(targetTokens);
  const candidateDistinctive = distinctive(candidateTokens);
  const broadCoverage = overlap(targetTokens, candidateTokens) >=
    Math.max(2, Math.ceil(targetTokens.size * 0.75));
  if (targetDistinctive.size > 0) {
    return broadCoverage ||
      overlap(targetDistinctive, candidateDistinctive) >= Math.min(2, targetDistinctive.size);
  }
  return targetTokens.size === 1
    ? overlap(targetTokens, candidateTokens) === 1
    : broadCoverage;
}

export type SourceEntityRelevance = "target" | "organization_level" | "sibling" | "unclear";

export interface SourceRelevanceAssessment {
  readonly sourceId: string;
  readonly relevance: SourceEntityRelevance;
  readonly reason: string;
  readonly targetTokens: readonly string[];
  readonly explicitTargetIdentity: boolean;
}

/**
 * Classifies source identity, not factual truth. A same-organization sibling
 * can still support an organization record, but never target-specific facts.
 */
export function assessSourceRelevance(
  sources: readonly AnalysisSourceContext[],
): ReadonlyMap<string, SourceRelevanceAssessment> {
  const root = sources[0];
  if (!root) return new Map();
  const rootPathIdentity = pathIdentity(root.page.url);
  const headingIdentity = root.page.blocks
    .slice(0, 12)
    .filter((block) => block.kind === "heading" && NAMED_OPPORTUNITY_KIND.test(block.text))
    .flatMap((block) => words(block.text));
  const rootTokens = new Set([
    ...titleIdentity(root.page.title),
    ...headingIdentity,
    ...(rootPathIdentity === null ? [] : words(rootPathIdentity)),
  ]);
  const result = new Map<string, SourceRelevanceAssessment>();

  sources.forEach((source, index) => {
    if (index === 0) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "target",
        reason: "Submitted page defines the target opportunity context.",
        targetTokens: [...rootTokens],
        explicitTargetIdentity: true,
      });
      return;
    }

    const candidateTokens = titleIdentity(source.page.title);
    const candidateHeadingTokens = new Set(
      source.page.blocks
        .slice(0, 12)
        .filter((block) => block.kind === "heading")
        .flatMap((block) => words(block.text)),
    );
    const candidateIdentityTokens = new Set([
      ...candidateTokens,
      ...candidateHeadingTokens,
    ]);
    const titleMatches = identityMatch(rootTokens, candidateIdentityTokens);
    const candidatePathIdentity = pathIdentity(source.page.url);
    const pathMatches =
      rootPathIdentity !== null && candidatePathIdentity === rootPathIdentity;
    const pathConflicts =
      rootPathIdentity !== null &&
      candidatePathIdentity !== null &&
      candidatePathIdentity !== rootPathIdentity;

    if (pathConflicts) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "sibling",
        reason: "Page is under a different named opportunity path on the same organization site.",
        targetTokens: [...rootTokens],
        explicitTargetIdentity: false,
      });
    } else if (pathMatches || titleMatches) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "target",
        reason: "Page title or opportunity path matches the submitted opportunity.",
        targetTokens: [...rootTokens],
        explicitTargetIdentity: true,
      });
    } else if (
      distinctive(candidateTokens).size > 0 &&
      overlap(distinctive(rootTokens), distinctive(candidateIdentityTokens)) === 0 &&
      NAMED_OPPORTUNITY_KIND.test(source.page.title.split(/\s+[|\u2013\u2014:]\s+/u)[0] ?? source.page.title)
    ) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "sibling",
        reason: "Page title identifies a different named opportunity on the same organization site.",
        targetTokens: [...rootTokens],
        explicitTargetIdentity: false,
      });
    } else if (/\b(?:about|privacy|terms)(?:\b|[-_/])/iu.test(source.page.url)) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "organization_level",
        reason: "Page appears organization-wide rather than target-program-specific.",
        targetTokens: [...rootTokens],
        explicitTargetIdentity: titleMatches,
      });
    } else {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "unclear",
        reason: "Page does not establish a strong target or sibling identity.",
        targetTokens: [...rootTokens],
        explicitTargetIdentity: titleMatches,
      });
    }
  });

  return result;
}

export function sourceSupportsTargetSpecificClaim(
  sourceId: string,
  assessments: ReadonlyMap<string, SourceRelevanceAssessment>,
  excerpt?: string,
): boolean {
  const assessment = assessments.get(sourceId);
  if (!assessment || assessment.relevance === "sibling") return false;
  if (assessment.relevance === "target" || assessment.explicitTargetIdentity) return true;
  if (!excerpt) return false;
  const excerptTokens = new Set(words(excerpt));
  return overlap(new Set(assessment.targetTokens), excerptTokens) >=
    Math.min(2, Math.max(1, assessment.targetTokens.length));
}

export function targetIdentityHint(title: string, url: string): {
  readonly tokens: readonly string[];
  readonly pathIdentity: string | null;
} {
  return {
    tokens: [...titleIdentity(title)],
    pathIdentity: pathIdentity(url),
  };
}

export function looksLikeDifferentNamedOpportunity(
  linkText: string,
  targetTokens: readonly string[],
): boolean {
  const candidateTokens = titleIdentity(linkText);
  return NAMED_OPPORTUNITY_KIND.test(linkText) &&
    distinctive(candidateTokens).size > 0 &&
    !identityMatch(new Set(targetTokens), candidateTokens);
}
