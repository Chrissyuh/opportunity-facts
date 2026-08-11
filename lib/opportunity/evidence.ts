import { normalizeWhitespace } from "./normalize";
import {
  factSchema,
  opportunityCardSchema,
  type EvidenceSource,
  type Fact,
  type OpportunityCard,
} from "./schema";

export interface EvidenceValidationError {
  readonly fieldId: string;
  readonly sourceId: string;
  readonly message: string;
}

export function excerptMatchesSource(excerpt: string, sourceText: string): boolean {
  const normalizedExcerpt = normalizeWhitespace(excerpt).toLocaleLowerCase("en-US");
  const normalizedSource = normalizeWhitespace(sourceText).toLocaleLowerCase("en-US");
  return normalizedExcerpt.length > 0 && normalizedSource.includes(normalizedExcerpt);
}

function sourceTextFor(
  source: EvidenceSource,
  sourceTexts: Readonly<Record<string, string>>,
): string | undefined {
  if (Object.hasOwn(sourceTexts, source.id)) return sourceTexts[source.id];
  return Object.hasOwn(sourceTexts, source.url) ? sourceTexts[source.url] : undefined;
}

function isSupported(
  source: EvidenceSource,
  sourceTexts: Readonly<Record<string, string>>,
): boolean {
  const sourceText = sourceTextFor(source, sourceTexts);
  return sourceText !== undefined && excerptMatchesSource(source.excerpt, sourceText);
}

export interface ValidatedFactEvidence {
  readonly fact: Fact;
  readonly errors: readonly Omit<EvidenceValidationError, "fieldId">[];
}

export function validateFactEvidence(
  fact: Fact,
  sourceTexts: Readonly<Record<string, string>>,
): ValidatedFactEvidence {
  const errors: Omit<EvidenceValidationError, "fieldId">[] = [];
  const validateSources = (sources: readonly EvidenceSource[]): EvidenceSource[] =>
    sources.filter((source) => {
      if (isSupported(source, sourceTexts)) return true;
      errors.push({
        sourceId: source.id,
        message: "The cited excerpt was not found in the normalized source text.",
      });
      return false;
    });

  if (fact.status === "disclosed") {
    const sources = validateSources(fact.sources);
    if (sources.length > 0) {
      return { fact: factSchema.parse({ ...fact, sources }), errors };
    }
    return {
      fact: factSchema.parse({
        status: "unclear",
        sources: [],
        note: "Evidence validation could not match the supplied excerpt to the source text; the value is not displayed as supported.",
      }),
      errors,
    };
  }

  if (fact.status === "conflicting") {
    const candidates = fact.conflictingValues
      .map((candidate) => ({ ...candidate, sources: validateSources(candidate.sources) }))
      .filter((candidate) => candidate.sources.length > 0);
    if (candidates.length >= 2) {
      return {
        fact: factSchema.parse({
          ...fact,
          sources: validateSources(fact.sources),
          conflictingValues: candidates,
        }),
        errors,
      };
    }

    const remainingSources = candidates.flatMap((candidate) => candidate.sources);
    return {
      fact: factSchema.parse({
        status: "unclear",
        sources: remainingSources,
        note: "Evidence validation did not leave two supported values, so the conflict is not displayed as resolved or sourced.",
      }),
      errors,
    };
  }

  if (fact.status === "unclear") {
    return {
      fact: factSchema.parse({ ...fact, sources: validateSources(fact.sources) }),
      errors,
    };
  }

  return { fact, errors };
}

export interface ValidatedCardEvidence {
  readonly card: OpportunityCard;
  readonly errors: readonly EvidenceValidationError[];
}

export function validateCardEvidence(
  card: OpportunityCard,
  sourceTexts: Readonly<Record<string, string>>,
): ValidatedCardEvidence {
  const facts = { ...card.facts };
  const errors: EvidenceValidationError[] = [];

  for (const [fieldId, fact] of Object.entries(card.facts)) {
    const result = validateFactEvidence(fact, sourceTexts);
    facts[fieldId as keyof typeof facts] = result.fact;
    errors.push(...result.errors.map((error) => ({ ...error, fieldId })));
  }

  const conflicts = card.conflicts.filter(
    (conflict) => facts[conflict.fieldId].status === "conflicting",
  );
  return {
    card: opportunityCardSchema.parse({ ...card, facts, conflicts }),
    errors,
  };
}
