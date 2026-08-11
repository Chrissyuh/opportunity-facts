import {
  factSchema,
  type EvidenceSource,
  type Fact,
  type NormalizedValue,
} from "./schema";
import {
  PARTICIPATION_FORMATS,
  RELATIONSHIP_TYPES,
  type MoneyClassification,
  type ParticipationFormat,
  type RelationshipType,
} from "./fields";

export function normalizeWhitespace(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDate(value: string): NormalizedValue | null {
  const trimmed = normalizeWhitespace(value);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  let year: number;
  let month: number;
  let day: number;
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    const namedMatch = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})$/i.exec(trimmed);
    if (!namedMatch) return null;
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    year = Number(namedMatch[3]);
    month = months.indexOf(namedMatch[1].toLowerCase()) + 1;
    day = Number(namedMatch[2]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { kind: "date", isoDate: date.toISOString().slice(0, 10) };
}

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
};

export function normalizeCurrency(
  value: string | number,
  classification: MoneyClassification,
  defaultCurrency = "USD",
): NormalizedValue | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return { kind: "money", amount: value, currency: defaultCurrency, classification };
  }

  const text = normalizeWhitespace(value);
  const symbol = text.charAt(0);
  const explicitCode = /\b([A-Z]{3})\b/.exec(text)?.[1];
  const currency = explicitCode ?? CURRENCY_SYMBOLS[symbol] ?? defaultCurrency;
  const numeric = text
    .replace(/[A-Z]{3}/g, "")
    .replace(/[$€£,\s]/g, "")
    .replace(/^\((.+)\)$/, "-$1");
  if (!/^\d+(?:\.\d{1,2})?$/.test(numeric)) return null;
  const amount = Number(numeric);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return { kind: "money", amount, currency, classification };
}

export function normalizeParticipantCount(value: string | number): NormalizedValue | null {
  const amount = typeof value === "number" ? value : Number(value.replace(/,/g, "").trim());
  if (!Number.isSafeInteger(amount) || amount < 0) return null;
  return { kind: "number", value: amount, unit: "people" };
}

export function normalizeDuration(value: string): NormalizedValue | null {
  const match = /^(\d+(?:\.\d+)?)\s*(hours?|days?|weeks?|months?)$/i.exec(
    normalizeWhitespace(value),
  );
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase().replace(/s$/, "") as
    | "hour"
    | "day"
    | "week"
    | "month";
  return {
    kind: "duration",
    amount,
    unit: `${unit}s` as "hours" | "days" | "weeks" | "months",
  };
}

export function normalizeWeeklyHours(value: string | number): NormalizedValue | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return { kind: "hours", minimum: value, maximum: null, period: "week" };
  }
  const match = /^(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:hours?|hrs?)(?:\s*per\s*week|\/week)?$/i.exec(
    normalizeWhitespace(value),
  );
  if (!match) return null;
  const minimum = Number(match[1]);
  const maximum = match[2] ? Number(match[2]) : null;
  if (maximum !== null && maximum < minimum) return null;
  return { kind: "hours", minimum, maximum, period: "week" };
}

export function calculateAcceptanceRate(
  applicantCount: number,
  acceptanceCount: number,
): number | null {
  if (
    !Number.isSafeInteger(applicantCount) ||
    !Number.isSafeInteger(acceptanceCount) ||
    applicantCount <= 0 ||
    acceptanceCount < 0 ||
    acceptanceCount > applicantCount
  ) {
    return null;
  }
  return Math.round((acceptanceCount / applicantCount) * 10_000) / 100;
}

function numericCount(fact: Fact): number | null {
  if (fact.status !== "disclosed") return null;
  if (fact.normalizedValue?.kind === "number") return fact.normalizedValue.value;
  return typeof fact.value === "number" ? fact.value : null;
}

function distinctSources(sources: readonly EvidenceSource[]): EvidenceSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.id}\u0000${source.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createCalculatedAcceptanceRateFact(
  applicantCountFact: Fact,
  acceptanceCountFact: Fact,
): Fact {
  const inputFacts = [applicantCountFact, acceptanceCountFact];
  if (inputFacts.some((fact) => fact.status !== "disclosed")) {
    if (inputFacts.every((fact) => fact.status === "not_applicable")) {
      return factSchema.parse({
        status: "not_applicable",
        note: "An acceptance-rate calculation does not apply because both count fields are not applicable.",
      });
    }
    if (inputFacts.some((fact) => fact.status === "unclear" || fact.status === "conflicting")) {
      const sources = distinctSources(
        inputFacts.flatMap((fact) => [
          ...fact.sources,
          ...fact.conflictingValues.flatMap((candidate) => candidate.sources),
        ]),
      );
      return factSchema.parse({
        status: "unclear",
        note: "A rate was not calculated because the published applicant or acceptance count is unclear or conflicting.",
        sources,
      });
    }
    return factSchema.parse({
      status: "not_found",
      note: "A rate was not calculated because both required published counts were not available.",
    });
  }

  const applicantCount = numericCount(applicantCountFact);
  const acceptanceCount = numericCount(acceptanceCountFact);
  const rate =
    applicantCount === null || acceptanceCount === null
      ? null
      : calculateAcceptanceRate(applicantCount, acceptanceCount);
  const sources = distinctSources([
    ...applicantCountFact.sources,
    ...acceptanceCountFact.sources,
  ]);

  if (rate === null || applicantCount === null || acceptanceCount === null || sources.length === 0) {
    return factSchema.parse({
      status: "unclear",
      note: "A rate was not calculated because supported applicant and acceptance counts were unavailable or invalid.",
      sources,
    });
  }

  return factSchema.parse({
    status: "disclosed",
    value: rate,
    displayValue: `${rate}%`,
    normalizedValue: { kind: "percentage", value: rate },
    sources,
    claimKind: "calculated",
    calculation: {
      formula: "acceptance_count / applicant_count × 100",
      inputs: [
        { fieldId: "applicant_count", value: applicantCount },
        { fieldId: "acceptance_count", value: acceptanceCount },
      ],
      explanation: "Calculated from published counts.",
    },
    note: "Calculated from published counts.",
  });
}

function normalizedEnumToken(value: string): string {
  return normalizeWhitespace(value).toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeRelationship(value: string): NormalizedValue | null {
  const token = normalizedEnumToken(value);
  if (!RELATIONSHIP_TYPES.includes(token as RelationshipType)) return null;
  return { kind: "relationship", value: token as RelationshipType };
}

export function normalizeParticipationFormat(value: string): NormalizedValue | null {
  const token = normalizedEnumToken(value);
  if (!PARTICIPATION_FORMATS.includes(token as ParticipationFormat)) return null;
  return { kind: "participation_format", value: token as ParticipationFormat };
}
