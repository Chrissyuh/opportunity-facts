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

const NAMED_OPPORTUNITY_KIND =
  /\b(challenge|competition|contest|fellowship|internship|olympiad|prize program|research program|summer program)\b/iu;

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
  const primaryTitle = title.split(/\s+[|\u2013\u2014:]\s+/u)[0] ?? title;
  return new Set(words(primaryTitle));
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

export type SourceEntityRelevance = "target" | "organization_level" | "sibling" | "unclear";

export interface SourceRelevanceAssessment {
  readonly sourceId: string;
  readonly relevance: SourceEntityRelevance;
  readonly reason: string;
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
  const rootTokens = titleIdentity(root.page.title);
  const rootPathIdentity = pathIdentity(root.page.url);
  const result = new Map<string, SourceRelevanceAssessment>();

  sources.forEach((source, index) => {
    if (index === 0) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "target",
        reason: "Submitted page defines the target opportunity context.",
      });
      return;
    }

    const candidateTokens = titleIdentity(source.page.title);
    const titleOverlap = overlap(rootTokens, candidateTokens);
    const candidatePathIdentity = pathIdentity(source.page.url);
    const pathMatches =
      rootPathIdentity !== null && candidatePathIdentity === rootPathIdentity;
    const pathConflicts =
      rootPathIdentity !== null &&
      candidatePathIdentity !== null &&
      candidatePathIdentity !== rootPathIdentity;

    if (pathMatches || titleOverlap >= Math.min(2, Math.max(1, rootTokens.size))) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "target",
        reason: "Page title or opportunity path matches the submitted opportunity.",
      });
    } else if (pathConflicts) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "sibling",
        reason: "Page is under a different named opportunity path on the same organization site.",
      });
    } else if (
      titleOverlap === 0 &&
      NAMED_OPPORTUNITY_KIND.test(source.page.title.split(/\s+[|\u2013\u2014:]\s+/u)[0] ?? source.page.title)
    ) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "sibling",
        reason: "Page title identifies a different named opportunity on the same organization site.",
      });
    } else if (/\b(?:about|privacy|terms)(?:\b|[-_/])/iu.test(source.page.url)) {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "organization_level",
        reason: "Page appears organization-wide rather than target-program-specific.",
      });
    } else {
      result.set(source.page.id, {
        sourceId: source.page.id,
        relevance: "unclear",
        reason: "Page does not establish a strong target or sibling identity.",
      });
    }
  });

  return result;
}

export function sourceSupportsTargetSpecificClaim(
  sourceId: string,
  assessments: ReadonlyMap<string, SourceRelevanceAssessment>,
): boolean {
  return assessments.get(sourceId)?.relevance !== "sibling";
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
  const candidateTokens = words(linkText);
  return NAMED_OPPORTUNITY_KIND.test(linkText) &&
    candidateTokens.every((token) => !targetTokens.includes(token));
}
