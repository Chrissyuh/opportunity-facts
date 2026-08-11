import "server-only";

import type {
  DiscoveredPageCandidate,
  DiscoveryTopic,
  ExtractedLink,
} from "./types";
import {
  haveSameOrigin,
  normalizedOrigin,
  parsePublicHttpUrl,
} from "./url-safety";

export const MAX_DISCOVERED_PAGES = 6;

interface TopicRule {
  readonly topic: DiscoveryTopic;
  readonly weight: number;
  readonly patterns: readonly RegExp[];
}

const TOPIC_RULES: readonly TopicRule[] = [
  {
    topic: "privacy",
    weight: 18,
    patterns: [/\bprivacy\b/iu, /\bdata\s+(?:use|sharing|policy)\b/iu],
  },
  {
    topic: "refund",
    weight: 17,
    patterns: [/\brefunds?\b/iu, /\bnon[ -]?refundable\b/iu],
  },
  {
    topic: "cancellation",
    weight: 16,
    patterns: [/\bcancell?ation\b/iu, /\bcancel(?:led|ed|s|ing)?\b/iu],
  },
  {
    topic: "financial_aid",
    weight: 15,
    patterns: [
      /\bfinancial\s+aid\b/iu,
      /\bscholarships?\b/iu,
      /\bfee\s+waivers?\b/iu,
    ],
  },
  {
    topic: "cost",
    weight: 14,
    patterns: [
      /\btuition\b/iu,
      /\bcosts?\b/iu,
      /\bfees?\b/iu,
      /\bdeposits?\b/iu,
      /\bpricing\b/iu,
    ],
  },
  {
    topic: "rules",
    weight: 14,
    patterns: [/\brules?\b/iu, /\bregulations?\b/iu, /\bguidelines?\b/iu],
  },
  {
    topic: "terms",
    weight: 14,
    patterns: [
      /\bterms(?:\s+(?:of\s+(?:use|service)|and\s+conditions))?\b/iu,
      /\bconditions\b/iu,
      /\bpolic(?:y|ies)\b/iu,
    ],
  },
  {
    topic: "faq",
    weight: 13,
    patterns: [
      /\bfaq\b/iu,
      /\bfrequently\s+asked\s+questions?\b/iu,
      /\bquestions?\s+and\s+answers?\b/iu,
    ],
  },
  {
    topic: "eligibility",
    weight: 12,
    patterns: [
      /\beligib(?:le|ility)\b/iu,
      /\brequirements?\b/iu,
      /\bwho\s+can\s+apply\b/iu,
    ],
  },
  {
    topic: "admissions",
    weight: 11,
    patterns: [/\badmissions?\b/iu, /\bselection\b/iu],
  },
  {
    topic: "application",
    weight: 10,
    patterns: [/\bapply\b/iu, /\bapplication\b/iu],
  },
  {
    topic: "award",
    weight: 10,
    patterns: [
      /\bawards?\b/iu,
      /\bprizes?\b/iu,
      /\bstipends?\b/iu,
      /\bbenefits?\b/iu,
    ],
  },
  {
    topic: "schedule",
    weight: 9,
    patterns: [
      /\bschedules?\b/iu,
      /\bdates?\b/iu,
      /\bdeadlines?\b/iu,
      /\bcalendar\b/iu,
    ],
  },
];

const NEGATIVE_PATTERNS = [
  /\b(?:sign|log)[ -]?in\b/iu,
  /\baccounts?\b/iu,
  /\bdonat(?:e|ion)\b/iu,
  /\bcareers?\b/iu,
  /\bpress\b/iu,
  /\bnews\b/iu,
  /\bblog\b/iu,
  /\bsocial\b/iu,
];

const NON_TEXT_EXTENSION =
  /\.(?:avif|bmp|csv|docx?|gif|jpe?g|json|mp3|mp4|mov|odt|pdf|png|pptx?|svg|webm|webp|xlsx?|xml|zip)$/iu;

const BLOCKED_ACTION_PATTERN =
  /(?:^|[\s/._-])(?:log[ -]?in|log[ -]?out|sign[ -]?in|sign[ -]?out|delete|unsubscribe|remove[ -]?account)(?:$|[\s/?#._=&-])/iu;

function searchableUrl(url: URL): string {
  let decoded = `${url.pathname} ${url.search}`;
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // The normalized URL is still safe to rank when percent decoding fails.
  }
  return decoded.replace(/[-_+/?.=&]+/gu, " ");
}

function classify(text: string, url: URL): {
  topic: DiscoveryTopic;
  score: number;
} {
  const linkText = text.toLowerCase();
  const pathText = searchableUrl(url).toLowerCase();
  let bestRule: TopicRule | undefined;
  let score = 0;

  for (const rule of TOPIC_RULES) {
    let ruleScore = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(linkText)) {
        ruleScore += rule.weight;
      }
      if (pattern.test(pathText)) {
        ruleScore += Math.max(2, rule.weight - 3);
      }
    }

    if (ruleScore > 0) {
      score += ruleScore;
      if (!bestRule || ruleScore > bestRule.weight) {
        bestRule = { ...rule, weight: ruleScore };
      }
    }
  }

  const combined = `${linkText} ${pathText}`;
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(combined)) {
      score -= 10;
    }
  }

  return {
    topic: bestRule?.topic ?? "other",
    score,
  };
}

function withoutFragment(url: URL): URL {
  const copy = new URL(url.href);
  copy.hash = "";
  return copy;
}

function canonicalResourceKey(url: URL): string {
  return `${normalizedOrigin(url)}${url.pathname}${url.search}`;
}

export interface RankSameOriginLinksOptions {
  readonly maxPages?: number;
}

export function rankSameOriginLinks(
  submittedPageUrl: string | URL,
  links: readonly ExtractedLink[],
  options: RankSameOriginLinksOptions = {},
): readonly DiscoveredPageCandidate[] {
  const baseUrl = withoutFragment(parsePublicHttpUrl(submittedPageUrl));
  const baseResourceKey = canonicalResourceKey(baseUrl);
  const requestedMaximum = options.maxPages ?? MAX_DISCOVERED_PAGES;
  const maximum = Math.max(
    0,
    Math.min(
      MAX_DISCOVERED_PAGES,
      Number.isSafeInteger(requestedMaximum) ? requestedMaximum : MAX_DISCOVERED_PAGES,
    ),
  );

  const candidates = new Map<
    string,
    DiscoveredPageCandidate & { readonly documentOrder: number }
  >();

  links.forEach((link, documentOrder) => {
    let url: URL;
    try {
      url = withoutFragment(parsePublicHttpUrl(link.url));
    } catch {
      return;
    }

    if (!link.sameOrigin || !haveSameOrigin(baseUrl, url)) {
      return;
    }
    const resourceKey = canonicalResourceKey(url);
    if (
      resourceKey === baseResourceKey ||
      NON_TEXT_EXTENSION.test(url.pathname) ||
      BLOCKED_ACTION_PATTERN.test(`${link.text} ${searchableUrl(url)}`)
    ) {
      return;
    }

    const classification = classify(link.text, url);
    if (classification.score <= 0) {
      return;
    }

    const candidate = {
      url: url.href,
      text: link.text,
      score: classification.score,
      topic: classification.topic,
      documentOrder,
    } as const;
    const existing = candidates.get(resourceKey);
    if (!existing || candidate.score > existing.score) {
      candidates.set(resourceKey, candidate);
    }
  });

  const ranked = [...candidates.values()].sort(
      (left, right) =>
        right.score - left.score ||
        left.documentOrder - right.documentOrder ||
        left.url.localeCompare(right.url),
    );
  const selected: typeof ranked = [];
  const seenTopics = new Set<DiscoveryTopic>();
  for (const candidate of ranked) {
    if (selected.length >= maximum) break;
    if (seenTopics.has(candidate.topic)) continue;
    selected.push(candidate);
    seenTopics.add(candidate.topic);
  }
  for (const candidate of ranked) {
    if (selected.length >= maximum) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }

  return selected
    .map((candidate) => ({
      url: candidate.url,
      text: candidate.text,
      score: candidate.score,
      topic: candidate.topic,
    }));
}
