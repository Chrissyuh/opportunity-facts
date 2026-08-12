import type { FieldId } from "./fields";
import {
  factSchema,
  type CardConflict,
  type EvidenceSource,
  type Fact,
  type OpportunityFacts,
} from "./schema-v1";
import type { OpportunityCard } from "./schema-v2";
import type { Scope } from "./structured-schema";

export const STRUCTURED_PROJECTION_FIELDS = [
  "operating_organization",
  "organization_type",
  "named_institution",
  "institution_relationship",
  "relationship_explanation",
  "application_deadline",
  "decision_date",
  "start_date",
  "end_date",
  "duration",
  "weekly_hours",
  "required_live_hours",
  "participation_format",
  "location",
  "application_fee",
  "deposit",
  "tuition",
  "other_mandatory_costs",
  "estimated_total_mandatory_cost",
  "selection_process",
  "cash_award",
  "stipend",
  "tuition_waiver",
  "program_seat",
  "in_kind_value",
  "mentorship",
  "certificate",
  "college_credit",
  "other_benefits",
] as const satisfies readonly FieldId[];

type ProjectionFieldId = (typeof STRUCTURED_PROJECTION_FIELDS)[number];
type ClaimWithEvidence = {
  claimId: string;
  status: string;
  sources: EvidenceSource[];
  conflictingValues: Array<{ sources: EvidenceSource[] }>;
};

function isDisclosed<T extends { status: string }>(claim: T): claim is Extract<T, { status: "disclosed" }> {
  return claim.status === "disclosed";
}

function emptyScope(scope: Scope): boolean {
  return scope.variantIds.length === 0 && scope.stageIds.length === 0 && scope.pathwayIds.length === 0;
}

function scopedVariationLabel(scopes: readonly Scope[], valuesDiffer: boolean): string {
  const variesByVariant = scopes.some((scope) => scope.variantIds.length > 0);
  const variesByProcess = scopes.some(
    (scope) => scope.stageIds.length > 0 || scope.pathwayIds.length > 0,
  );
  const dimension = variesByVariant && variesByProcess
    ? "program/cohort and stage/pathway"
    : variesByVariant
      ? "program/cohort"
      : variesByProcess
        ? "stage/pathway"
        : "source record";
  return valuesDiffer
    ? `Varies by ${dimension}`
    : `Scoped by ${dimension} \u2014 see details`;
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

function claimSources(claims: readonly ClaimWithEvidence[]): EvidenceSource[] {
  return distinctSources(
    claims.flatMap((claim) => [
      ...claim.sources,
      ...claim.conflictingValues.flatMap((candidate) => candidate.sources),
    ]),
  );
}

function claimRefs(claims: readonly ClaimWithEvidence[]): string[] {
  return [...new Set(claims.map((claim) => claim.claimId))];
}

function sourceClaimKind(claims: readonly { claimKind: string | null }[]) {
  return claims.length > 0 && claims.every((claim) => claim.claimKind === "organizer_stated")
    ? "organizer_stated" as const
    : "source_stated" as const;
}

function projectionMetadata(rule: string, refs: string[]) {
  return { schemaVersion: "2.0.0" as const, rule, claimRefs: refs };
}

function disclosedProjection({
  value,
  displayValue,
  normalizedValue = null,
  sources,
  claimKind,
  note = null,
  rule,
  refs,
}: {
  value: string | number | boolean | string[];
  displayValue: string;
  normalizedValue?: Fact["normalizedValue"];
  sources: EvidenceSource[];
  claimKind: "source_stated" | "organizer_stated";
  note?: string | null;
  rule: string;
  refs: string[];
}): Fact {
  return factSchema.parse({
    status: "disclosed",
    value,
    displayValue,
    normalizedValue,
    sources: distinctSources(sources),
    note,
    confidence: null,
    claimKind,
    conflictingValues: [],
    calculation: null,
    projection: projectionMetadata(rule, refs),
  });
}

function unresolvedProjection(
  status: "not_found" | "not_applicable" | "unclear",
  note: string,
  sources: EvidenceSource[],
  rule: string,
  refs: string[],
): Fact {
  return factSchema.parse({
    status,
    note,
    sources: status === "unclear" ? distinctSources(sources) : [],
    projection: projectionMetadata(rule, refs),
  });
}

function setProjection(
  facts: OpportunityFacts,
  refsByField: Partial<Record<FieldId, string[]>>,
  fieldId: ProjectionFieldId,
  fact: Fact,
) {
  facts[fieldId] = fact;
  refsByField[fieldId] = fact.projection?.claimRefs ?? [];
}

function formatEnum(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function projectOrganizations(
  card: OpportunityCard,
  facts: OpportunityFacts,
  refsByField: Partial<Record<FieldId, string[]>>,
) {
  const organizations = new Map(
    (card.organizations.status === "modeled" ? card.organizations.records : [])
      .map((organization) => [organization.id, organization]),
  );
  if (card.organizations.status === "modeled" && card.organizationRoles.status === "modeled") {
    const roles = card.organizationRoles.records;
    const operators = roles.filter((role) => role.role.value.role === "operator");
    const selected = operators.length > 0 ? operators : roles;
    if (selected.length > 0) {
    const sorted = [...selected].sort((left, right) => left.id.localeCompare(right.id));
    const pieces = sorted.flatMap((role) => {
      const organization = organizations.get(role.organizationId);
      if (!organization) return [];
      const suffix = operators.length === 0 ? ` (${formatEnum(role.role.value.role).toLowerCase()})` : "";
      return [`${organization.name.value}${suffix}`];
    });
    const claims = sorted.flatMap((role) => {
      const organization = organizations.get(role.organizationId);
      return organization ? [role.role, organization.name] : [role.role];
    });
    if (pieces.length > 0) {
      const refs = claimRefs(claims);
      setProjection(facts, refsByField, "operating_organization", disclosedProjection({
        value: pieces.join("; "),
        displayValue: pieces.join("; "),
        sources: claimSources(claims),
        claimKind: sourceClaimKind(claims),
        note: operators.length === 0 ? "No single operator is asserted; the v2 role ledger is summarized without upgrading another role." : null,
        rule: "organizations.primary-operator",
        refs,
      }));
    }
    if (operators.length === 1) {
      const organization = organizations.get(operators[0].organizationId);
      if (organization?.kind.status === "disclosed") {
        const claims = [organization.kind, organization.name];
        const refs = claimRefs(claims);
        setProjection(facts, refsByField, "organization_type", disclosedProjection({
          value: organization.kind.value,
          displayValue: organization.kind.displayValue,
          normalizedValue: { kind: "text", value: organization.kind.value },
          sources: claimSources(claims),
          claimKind: sourceClaimKind(claims),
          rule: "organizations.primary-operator-kind",
          refs,
        }));
      }
    }
    }
  }

  if (card.institutionRelationships.status !== "modeled") return;
  const relationships = card.institutionRelationships.records.filter((record) => record.assertion.status === "disclosed");
  if (relationships.length === 0) return;
  const relationClaims = relationships.map((record) => record.assertion);
  const targetClaims = relationships.flatMap((record) => {
    const targetId = record.assertion.status === "disclosed" ? record.assertion.value.targetOrganizationId : null;
    const target = targetId ? organizations.get(targetId) : undefined;
    return target ? [target.name] : [];
  });
  const targetNames = relationships.flatMap((record) => {
    if (record.assertion.status !== "disclosed") return [];
    if (record.assertion.value.targetInstitutionName) return [record.assertion.value.targetInstitutionName];
    const targetId = record.assertion.value.targetOrganizationId;
    const target = targetId ? organizations.get(targetId) : undefined;
    return target ? [target.name.value] : [];
  });
  const uniqueTargets = [...new Set(targetNames)];
  if (uniqueTargets.length > 0) {
    const claims = [...relationClaims, ...targetClaims];
    const refs = claimRefs(claims);
    const displayValue = uniqueTargets.join("; ");
    setProjection(facts, refsByField, "named_institution", disclosedProjection({
      value: displayValue,
      displayValue,
      normalizedValue: { kind: "text", value: displayValue },
      sources: claimSources(claims),
      claimKind: sourceClaimKind(claims),
      rule: "relationships.institution-list",
      refs,
    }));
  }
  const allClaims = [...relationClaims, ...targetClaims];
  const refs = claimRefs(allClaims);
  const displayValue = relationships.length === 1
    ? relationships[0].assertion.displayValue!
    : "Multiple institution relationships — see details";
  const onlyType = relationships.length === 1 ? relationships[0].assertion.value!.relationshipType : null;
  const legacyRelationship = onlyType === "founders_affiliated_with"
    ? "founded_by_affiliates"
    : onlyType === "institution_operated" ||
        onlyType === "institution_sponsored" ||
        onlyType === "institution_partnered" ||
        onlyType === "hosted_at_institution" ||
        onlyType === "independent" ||
        onlyType === "unclear"
      ? onlyType
      : null;
  setProjection(facts, refsByField, "institution_relationship", disclosedProjection({
    value: onlyType ?? displayValue,
    displayValue,
    normalizedValue: legacyRelationship ? { kind: "relationship", value: legacyRelationship } : null,
    sources: claimSources(allClaims),
    claimKind: sourceClaimKind(allClaims),
    note: relationships.length > 1 ? "The structured relationship ledger preserves each affiliation and partnership separately." : null,
    rule: "relationships.summary",
    refs,
  }));
  const relationshipExplanation = relationships
    .map((record) => record.assertion.value!.description)
    .join("; ");
  setProjection(facts, refsByField, "relationship_explanation", disclosedProjection({
    value: relationshipExplanation,
    displayValue: relationshipExplanation,
    normalizedValue: { kind: "text", value: relationshipExplanation },
    sources: claimSources(allClaims),
    claimKind: sourceClaimKind(allClaims),
    rule: "relationships.explanations",
    refs,
  }));
}

function temporalDisplay(value: { precision: string; date?: string; dateTime?: string; year?: number; month?: number }): string {
  if (value.precision === "date") return value.date!;
  if (value.precision === "date_time") return value.dateTime!;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(value.year!, value.month! - 1, 1)));
}

const TIMING_FIELD: Partial<Record<string, ProjectionFieldId>> = {
  deadline: "application_deadline",
  decision: "decision_date",
  notification: "decision_date",
  starts: "start_date",
  ends: "end_date",
};

function scopedClaimProjection(
  fieldId: ProjectionFieldId,
  claims: Array<ClaimWithEvidence & { status: "disclosed"; value: { scope: Scope }; displayValue: string; claimKind: "source_stated" | "organizer_stated" }>,
  facts: OpportunityFacts,
  refsByField: Partial<Record<FieldId, string[]>>,
  rule: string,
  normalizedValue: Fact["normalizedValue"] = null,
) {
  if (claims.length === 0) return;
  const displays = [...new Set(claims.map((claim) => claim.displayValue))];
  const universallyScoped = claims.every((claim) => emptyScope(claim.value.scope));
  const refs = claimRefs(claims);
  if (displays.length === 1 && universallyScoped) {
    setProjection(facts, refsByField, fieldId, disclosedProjection({
      value: displays[0],
      displayValue: displays[0],
      normalizedValue,
      sources: claimSources(claims),
      claimKind: sourceClaimKind(claims),
      rule,
      refs,
    }));
    return;
  }
  const displayValue = scopedVariationLabel(
    claims.map((claim) => claim.value.scope),
    displays.length > 1,
  );
  setProjection(facts, refsByField, fieldId, disclosedProjection({
    value: displayValue,
    displayValue,
    sources: claimSources(claims),
    claimKind: sourceClaimKind(claims),
    note: displays.join("; "),
    rule,
    refs,
  }));
}

function projectStages(
  card: OpportunityCard,
  facts: OpportunityFacts,
  refsByField: Partial<Record<FieldId, string[]>>,
) {
  if (card.stages.status !== "modeled") return;
  const stages = card.stages.records;
  const timings = stages.flatMap((stage) => stage.timings.filter(isDisclosed));
  const timingById = new Map(timings.map((timing) => [timing.claimId, timing]));
  if (card.cycle.status === "modeled") {
    const cycleTimingFields = [
      ["application_deadline", card.cycle.value.timingRefs.closes, "closes"],
      [
        "start_date",
        card.cycle.value.timingRefs.coverageStart ?? card.cycle.value.timingRefs.opens,
        card.cycle.value.timingRefs.coverageStart ? "coverage-start" : "opens",
      ],
      ["end_date", card.cycle.value.timingRefs.coverageEnd, "coverage-end"],
    ] as const;
    for (const [fieldId, claimId, ruleSuffix] of cycleTimingFields) {
      if (claimId === null) continue;
      const timing = timingById.get(claimId);
      if (!timing) continue;
      const refs = [timing.claimId];
      const displayValue = timing.displayValue || temporalDisplay(timing.value.when);
      setProjection(facts, refsByField, fieldId, disclosedProjection({
        value: displayValue,
        displayValue,
        normalizedValue:
          timing.value.when.precision === "date" &&
          timing.value.when.certainty === "stated"
            ? { kind: "date", isoDate: timing.value.when.date }
            : null,
        sources: claimSources([timing]),
        claimKind: timing.claimKind,
        note:
          ruleSuffix === "opens"
            ? "The cycle opening is used because no separate participation start was identified."
            : null,
        rule: `cycle.${ruleSuffix}`,
        refs,
      }));
    }
  }
  for (const [event, fieldId] of Object.entries(TIMING_FIELD)) {
    if (fieldId && refsByField[fieldId] !== undefined) continue;
    const matching = timings.filter((timing) => timing.value.event === event);
    if (matching.length === 0 || !fieldId) continue;
    const displays = [...new Set(matching.map((timing) => timing.displayValue || temporalDisplay(timing.value.when)))];
    const universal = matching.every((timing) => emptyScope(timing.value.scope));
    const refs = claimRefs(matching);
    const exactDates = matching.flatMap((timing) =>
      timing.value.when.precision === "date" && timing.value.when.certainty === "stated"
        ? [timing.value.when.date]
        : [],
    );
    const displayValue = displays.length === 1 && universal
      ? displays[0]
      : scopedVariationLabel(
          matching.map((timing) => timing.value.scope),
          displays.length > 1,
        );
    setProjection(facts, refsByField, fieldId, disclosedProjection({
      value: displayValue,
      displayValue,
      normalizedValue: displays.length === 1 && universal && exactDates.length === 1
        ? { kind: "date", isoDate: exactDates[0] }
        : null,
      sources: claimSources(matching),
      claimKind: sourceClaimKind(matching),
      note: displays.length === 1 && universal ? null : displays.join("; "),
      rule: `stages.${event}`,
      refs,
    }));
  }
  const durations = stages.flatMap((stage) => stage.durations.filter(isDisclosed));
  if (durations.length > 0) {
    const normalized = durations.length === 1 && emptyScope(durations[0].value.scope)
      ? {
          kind: "duration" as const,
          amount: durations[0].value.duration.minimum,
          unit: durations[0].value.duration.unit,
        }
      : null;
    scopedClaimProjection("duration", durations, facts, refsByField, "stages.duration", normalized);
  }
  const commitments = stages.flatMap((stage) => stage.timeCommitments.filter(isDisclosed));
  const weekly = commitments.filter((commitment) => commitment.value.period === "week");
  if (weekly.length > 0) {
    const value = weekly.length === 1 && emptyScope(weekly[0].value.scope)
      ? {
          kind: "hours" as const,
          minimum: weekly[0].value.minimumHours,
          maximum: weekly[0].value.maximumHours,
          period: "week" as const,
        }
      : null;
    scopedClaimProjection("weekly_hours", weekly, facts, refsByField, "stages.weekly-hours", value);
  }
  const live = commitments.filter((commitment) => commitment.value.label.toLowerCase().includes("live"));
  if (live.length > 0) {
    const value = live.length === 1 && emptyScope(live[0].value.scope)
      ? {
          kind: "hours" as const,
          minimum: live[0].value.minimumHours,
          maximum: live[0].value.maximumHours,
          period: live[0].value.period,
        }
      : null;
    scopedClaimProjection("required_live_hours", live, facts, refsByField, "stages.live-hours", value);
  }
  const formats = stages.flatMap((stage) => stage.formats.filter(isDisclosed));
  if (formats.length > 0) {
    const unique = [...new Set(formats.flatMap((format) => format.value.formats))];
    const normalized = unique.length === 1 && formats.every((format) => emptyScope(format.value.scope))
      ? { kind: "participation_format" as const, value: unique[0] }
      : null;
    scopedClaimProjection("participation_format", formats, facts, refsByField, "stages.formats", normalized);
  }
  const locations = stages.flatMap((stage) => stage.locations.filter(isDisclosed));
  if (locations.length > 0) {
    scopedClaimProjection("location", locations, facts, refsByField, "stages.locations");
  }

  const definitions = stages.map((stage) => stage.definition);
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  let displayValue = [...stages]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((stage) => stage.definition.value.label)
    .join(" → ");
  const processClaims: ClaimWithEvidence[] = [];
  if (card.pathways.status === "modeled" && card.pathways.records.length > 0) {
    displayValue = card.pathways.records.map((pathway) => {
      processClaims.push(pathway.definition, ...pathway.steps);
      const labels = pathway.steps.flatMap((step) => {
        const stage = stageById.get(step.value.stageId);
        if (!stage) return [];
        processClaims.push(stage.definition);
        return [stage.definition.value.label];
      });
      return `${pathway.definition.value.label}: ${labels.join(" → ")}`;
    }).join("; ");
  } else {
    processClaims.push(...definitions);
  }
  if (displayValue) {
    const refs = claimRefs(processClaims);
    setProjection(facts, refsByField, "selection_process", disclosedProjection({
      value: displayValue,
      displayValue,
      sources: claimSources(processClaims),
      claimKind: sourceClaimKind(processClaims as Array<ClaimWithEvidence & { claimKind: string | null }>),
      note: card.pathways.status === "modeled" && card.pathways.records.length > 0
        ? card.pathways.records.length > 1
          ? "The v2 pathway ledger preserves the branches rather than selecting one route."
          : "The v2 pathway ledger defines the authoritative route; unrelated stages are not inserted into it."
        : null,
      rule: "stages.process",
      refs,
    }));
  }
}

const COST_FIELD: Partial<Record<string, ProjectionFieldId>> = {
  application_fee: "application_fee",
  deposit: "deposit",
  tuition: "tuition",
  materials: "other_mandatory_costs",
  other: "other_mandatory_costs",
};

function moneyDisplay(value: { kind: string; amount?: number; minimum?: number; maximum?: number; currency: string }): string {
  const format = (amount: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return value.kind === "exact" ? format(value.amount!) : `${format(value.minimum!)}–${format(value.maximum!)}`;
}

function costRefs(cost: OpportunityCard["costItems"] extends { records: Array<infer T> } ? T : never): ClaimWithEvidence[] {
  return [
    cost.definition,
    cost.amount,
    ...(cost.chargeBasis ? [cost.chargeBasis] : []),
    ...(cost.treatment ? [cost.treatment] : []),
    ...(cost.refundability ? [cost.refundability] : []),
    ...cost.conditions,
    ...cost.includedItems,
    ...cost.excludedItems,
  ];
}

type CostRecord = OpportunityCard["costItems"]["records"][number];
type ConflictingCostAmount = Extract<CostRecord["amount"], { status: "conflicting" }>;

function conflictingCostProjection(
  amount: ConflictingCostAmount,
  classification: "fee" | "deposit",
  note: string,
  rule: string,
  refs: string[],
  inputOnly = false,
): Fact {
  return factSchema.parse({
    status: "conflicting",
    note,
    conflictingValues: amount.conflictingValues.map((candidate) => {
      const displayValue = inputOnly
        ? `Conflicting mandatory input: ${candidate.displayValue}`
        : candidate.displayValue;
      return {
        value:
          inputOnly || candidate.value.kind === "range"
            ? displayValue
            : candidate.value.amount,
        displayValue,
        normalizedValue:
          !inputOnly && candidate.value.kind === "exact"
            ? {
                kind: "money" as const,
                amount: candidate.value.amount,
                currency: candidate.value.currency,
                classification,
              }
            : null,
        sources: candidate.sources,
        note: candidate.note,
      };
    }),
    projection: projectionMetadata(rule, refs),
  });
}

function projectCosts(
  card: OpportunityCard,
  facts: OpportunityFacts,
  refsByField: Partial<Record<FieldId, string[]>>,
) {
  if (card.costItems.status !== "modeled") return;
  const costs = card.costItems.records;
  for (const [kind, fieldId] of Object.entries(COST_FIELD)) {
    if (!fieldId) continue;
    const matching = costs.filter((cost) => cost.definition.value.kind === kind);
    if (matching.length === 0) continue;
    const claims = matching.flatMap(costRefs);
    const refs = claimRefs(claims);
    const amounts = matching.filter((cost) => cost.amount.status === "disclosed");
    const universal = matching.every((cost) => emptyScope(cost.definition.value.scope));
    const uniqueAmounts = new Set(amounts.map((cost) => JSON.stringify(cost.amount.status === "disclosed" ? cost.amount.value : null)));
    if (matching.length === 1 && amounts.length === 1 && universal && matching[0].definition.value.requirement !== "conditional") {
      const amount = amounts[0].amount;
      if (amount.status !== "disclosed") continue;
      if (amount.value.kind === "exact") {
        setProjection(facts, refsByField, fieldId, disclosedProjection({
          value: amount.value.amount,
          displayValue: amount.displayValue,
          normalizedValue: {
              kind: "money",
              amount: amount.value.amount,
              currency: amount.value.currency,
              classification: kind === "deposit" ? "deposit" : "fee",
          },
          sources: claimSources(claims),
          claimKind: sourceClaimKind(claims as Array<ClaimWithEvidence & { claimKind: string | null }>),
          rule: `costs.${kind}`,
          refs,
        }));
      } else {
        setProjection(facts, refsByField, fieldId, disclosedProjection({
          value: amount.displayValue,
          displayValue: amount.displayValue,
          sources: claimSources(claims),
          claimKind: sourceClaimKind(claims as Array<ClaimWithEvidence & { claimKind: string | null }>),
          rule: `costs.${kind}`,
          refs,
        }));
      }
    } else if (amounts.length === matching.length && uniqueAmounts.size > 0) {
      const label = universal && uniqueAmounts.size === 1
        ? amounts[0].amount.displayValue!
        : "Varies by program/cohort";
      setProjection(facts, refsByField, fieldId, disclosedProjection({
        value: label,
        displayValue: label,
        sources: claimSources(claims),
        claimKind: sourceClaimKind(claims as Array<ClaimWithEvidence & { claimKind: string | null }>),
        note: matching.map((cost) => `${cost.definition.value.label}: ${cost.amount.displayValue}`).join("; "),
        rule: `costs.${kind}-matrix`,
        refs,
      }));
    } else {
      const unresolved = matching.map((cost) => cost.amount).find((amount) => amount.status !== "disclosed")!;
      if (unresolved.status === "conflicting") {
        setProjection(
          facts,
          refsByField,
          fieldId,
          conflictingCostProjection(
            unresolved,
            kind === "deposit" ? "deposit" : "fee",
            "Reviewed sources support different amounts for this structured cost; no value was selected.",
            `costs.${kind}-conflicting`,
            refs,
          ),
        );
        continue;
      }
      const status = unresolved.status === "not_applicable" ? "not_applicable" : unresolved.status === "not_found" ? "not_found" : "unclear";
      setProjection(facts, refsByField, fieldId, unresolvedProjection(
        status,
        unresolved.note,
        unresolved.sources,
        `costs.${kind}-unresolved`,
        refs,
      ));
    }
  }

  const totalClaims = costs.flatMap(costRefs);
  const totalRefs = claimRefs(totalClaims);
  const relevant = costs.filter((cost) => cost.definition.value.requirement !== "optional");
  if (relevant.length === 0) return;
  const unresolved = relevant.find((cost) => cost.amount.status !== "disclosed");
  if (unresolved) {
    if (unresolved.amount.status === "conflicting") {
      setProjection(
        facts,
        refsByField,
        "estimated_total_mandatory_cost",
        conflictingCostProjection(
          unresolved.amount,
          "fee",
          "A mandatory-cost input conflicts across reviewed sources, so no total was selected. The candidates below are conflicting inputs, not computed totals.",
          "costs.total-conflicting",
          totalRefs,
          true,
        ),
      );
      return;
    }
    const status = unresolved.amount.status === "not_found" ? "not_found" : unresolved.amount.status === "not_applicable" ? "not_applicable" : "unclear";
    setProjection(facts, refsByField, "estimated_total_mandatory_cost", unresolvedProjection(
      status,
      "A complete mandatory total cannot be calculated because at least one required cost amount is unresolved.",
      unresolved.amount.sources,
      "costs.total-unresolved",
      totalRefs,
    ));
    return;
  }
  if (card.costItems.completeness === "incomplete") {
    setProjection(facts, refsByField, "estimated_total_mandatory_cost", unresolvedProjection(
      "unclear",
      "The reviewed cost inventory contains source-backed items but does not establish that every applicable mandatory charge is known.",
      claimSources(totalClaims),
      "costs.total-incomplete",
      totalRefs,
    ));
    return;
  }
  if (relevant.some((cost) => cost.definition.value.requirement === "conditional")) {
    setProjection(facts, refsByField, "estimated_total_mandatory_cost", disclosedProjection({
      value: "Conditional — see cost details",
      displayValue: "Conditional — see cost details",
      sources: claimSources(totalClaims),
      claimKind: sourceClaimKind(totalClaims as Array<ClaimWithEvidence & { claimKind: string | null }>),
      note: "A single total is not asserted because at least one participant cost is conditional.",
      rule: "costs.total-conditional",
      refs: totalRefs,
    }));
    return;
  }
  if (relevant.some((cost) => !emptyScope(cost.definition.value.scope))) {
    setProjection(facts, refsByField, "estimated_total_mandatory_cost", disclosedProjection({
      value: "Varies by program/cohort",
      displayValue: "Varies by program/cohort",
      sources: claimSources(totalClaims),
      claimKind: sourceClaimKind(totalClaims as Array<ClaimWithEvidence & { claimKind: string | null }>),
      note: "Scoped prices are preserved in the cost breakdown rather than flattened into one total.",
      rule: "costs.total-scoped",
      refs: totalRefs,
    }));
    return;
  }
  const chargeable = relevant.filter((cost) => cost.treatment?.status !== "disclosed");
  const knownMoney = chargeable.flatMap((cost) =>
    cost.amount.status === "disclosed" ? [cost.amount.value] : [],
  );
  const knownCurrencies = new Set(knownMoney.map((amount) => amount.currency));
  const fields = chargeable.map((cost) => COST_FIELD[cost.definition.value.kind]).filter(Boolean) as FieldId[];
  if (
    knownMoney.length === chargeable.length &&
    knownCurrencies.size === 1 &&
    fields.length === chargeable.length &&
    new Set(fields).size === fields.length &&
    knownMoney.some((amount) => amount.kind === "range")
  ) {
    const minimum = knownMoney.reduce(
      (sum, amount) => sum + (amount.kind === "exact" ? amount.amount : amount.minimum),
      0,
    );
    const maximum = knownMoney.reduce(
      (sum, amount) => sum + (amount.kind === "exact" ? amount.amount : amount.maximum),
      0,
    );
    const currency = [...knownCurrencies][0];
    const displayValue = moneyDisplay({ kind: "range", minimum, maximum, currency });
    facts.estimated_total_mandatory_cost = factSchema.parse({
      status: "disclosed",
      value: displayValue,
      displayValue,
      normalizedValue: null,
      sources: claimSources(totalClaims),
      note: "Calculated range from the minimum and maximum of every complete, compatible mandatory cost item; no currency conversion was applied.",
      confidence: null,
      claimKind: "calculated",
      conflictingValues: [],
      calculation: {
        formula: `range(${fields.join(" + ")})`,
        inputs: knownMoney.map((amount, index) => ({
          fieldId: fields[index],
          value: amount.kind === "exact" ? amount.amount : amount.minimum,
        })),
        explanation: "Each input records the minimum bound used in the displayed range; the maximum is recomputed from the same complete structured cost items.",
      },
      projection: projectionMetadata("costs.total-range", totalRefs),
    });
    refsByField.estimated_total_mandatory_cost = totalRefs;
    return;
  }
  const exact = chargeable.flatMap((cost) =>
    cost.amount.status === "disclosed" && cost.amount.value.kind === "exact" ? [cost] : [],
  );
  const currencies = new Set(exact.map((cost) => cost.amount.status === "disclosed" ? cost.amount.value.currency : ""));
  if (
    exact.length !== chargeable.length ||
    fields.length !== chargeable.length ||
    currencies.size !== 1 ||
    new Set(fields).size !== fields.length
  ) {
    setProjection(facts, refsByField, "estimated_total_mandatory_cost", unresolvedProjection(
      "unclear",
      "The structured cost items are not compatible with one deterministic total.",
      claimSources(totalClaims),
      "costs.total-incompatible",
      totalRefs,
    ));
    return;
  }
  const currency = [...currencies][0];
  const total = exact.reduce((sum, cost) =>
    sum + (cost.amount.status === "disclosed" && cost.amount.value.kind === "exact" ? cost.amount.value.amount : 0),
  0);
  facts.estimated_total_mandatory_cost = factSchema.parse({
    status: "disclosed",
    value: total,
    displayValue: moneyDisplay({ kind: "exact", amount: total, currency }),
    normalizedValue: { kind: "money", amount: total, currency, classification: "fee" },
    sources: claimSources(totalClaims),
    note: "Calculated from complete compatible structured mandatory costs; credited deposits are excluded from the sum.",
    confidence: null,
    claimKind: "calculated",
    conflictingValues: [],
    calculation: {
      formula: fields.join(" + "),
      inputs: exact.map((cost, index) => ({
        fieldId: fields[index],
        value: cost.amount.status === "disclosed" && cost.amount.value.kind === "exact" ? cost.amount.value.amount : 0,
      })),
      explanation: "Calculated from complete compatible v2 cost items; credited deposits are not added twice.",
    },
    projection: projectionMetadata("costs.total-exact", totalRefs),
  });
  refsByField.estimated_total_mandatory_cost = totalRefs;
}

const OUTCOME_FIELDS: Record<
  "cash_award" | "stipend" | "tuition_waiver" | "program_seat" | "in_kind_value" | "mentorship" | "certificate" | "college_credit",
  readonly string[]
> = {
  cash_award: ["personal_cash_prize", "team_cash_prize"],
  stipend: ["stipend"],
  tuition_waiver: ["tuition_waiver", "scholarship"],
  program_seat: ["program_seat"],
  in_kind_value: ["equipment", "other_in_kind"],
  mentorship: ["mentorship"],
  certificate: ["certificate"],
  college_credit: ["college_credit"],
};

function outcomeClaims(outcome: OpportunityCard["outcomes"] extends { records: Array<infer T> } ? T : never): ClaimWithEvidence[] {
  return [
    outcome.definition,
    outcome.recipientScope,
    ...(outcome.monetaryNature ? [outcome.monetaryNature] : []),
    ...(outcome.amount ? [outcome.amount] : []),
    ...(outcome.distribution ? [outcome.distribution] : []),
    ...(outcome.rank ? [outcome.rank] : []),
    ...(outcome.track ? [outcome.track] : []),
    ...(outcome.quantity ? [outcome.quantity] : []),
    ...(outcome.useRestriction ? [outcome.useRestriction] : []),
    ...(outcome.combinability ? [outcome.combinability] : []),
    ...outcome.conditions,
  ];
}

function projectOutcomes(
  card: OpportunityCard,
  facts: OpportunityFacts,
  refsByField: Partial<Record<FieldId, string[]>>,
) {
  if (card.outcomes.status !== "modeled") return;
  const outcomes = card.outcomes.records;
  for (const [fieldId, types] of Object.entries(OUTCOME_FIELDS) as Array<[keyof typeof OUTCOME_FIELDS, readonly string[]]>) {
    const matching = outcomes.filter((outcome) => types.includes(outcome.definition.value.outcomeType));
    if (matching.length === 0) continue;
    const claims = matching.flatMap(outcomeClaims);
    const refs = claimRefs(claims);
    if (matching.length === 1) {
      const outcome = matching[0];
      const amount = outcome.amount?.status === "disclosed" ? outcome.amount.value : null;
      const exact = amount?.kind === "exact" ? amount : null;
      const range = amount?.kind === "range" ? amount : null;
      const classification = fieldId === "tuition_waiver"
        ? "tuition_waiver"
        : fieldId === "in_kind_value"
          ? "in_kind"
          : fieldId === "cash_award" || fieldId === "stipend"
            ? "cash"
            : null;
      const recipientSuffix = outcome.recipientScope.status === "disclosed"
        ? `/${outcome.recipientScope.value}`
        : "";
      const displayValue = exact || range
        ? `${outcome.definition.value.label} — ${outcome.amount!.displayValue}`
        : outcome.definition.displayValue;
      const scopedDisplayValue = exact || range ? `${displayValue}${recipientSuffix}` : displayValue;
      setProjection(facts, refsByField, fieldId, disclosedProjection({
        value: exact ? exact.amount : range ? outcome.amount!.displayValue! : outcome.definition.value.label,
        displayValue: scopedDisplayValue,
        normalizedValue: exact && classification
          ? { kind: "money", amount: exact.amount, currency: exact.currency, classification }
          : null,
        sources: claimSources(claims),
        claimKind: sourceClaimKind(claims as Array<ClaimWithEvidence & { claimKind: string | null }>),
        note: outcome.distribution?.status === "disclosed" ? outcome.distribution.displayValue : null,
        rule: `outcomes.${fieldId}`,
        refs,
      }));
    } else {
      const label = fieldId === "cash_award" ? "Multiple cash awards — see prize details" : "Multiple outcomes — see details";
      setProjection(facts, refsByField, fieldId, disclosedProjection({
        value: label,
        displayValue: label,
        sources: claimSources(claims),
        claimKind: sourceClaimKind(claims as Array<ClaimWithEvidence & { claimKind: string | null }>),
        note: matching.map((outcome) => outcome.definition.displayValue).join("; "),
        rule: `outcomes.${fieldId}-matrix`,
        refs,
      }));
    }
  }
  const mappedTypes = new Set(Object.values(OUTCOME_FIELDS).flat());
  const other = outcomes.filter((outcome) => !mappedTypes.has(outcome.definition.value.outcomeType));
  if (other.length > 0) {
    const claims = other.flatMap(outcomeClaims);
    const refs = claimRefs(claims);
    const labels = other.map((outcome) => outcome.definition.value.label);
    setProjection(facts, refsByField, "other_benefits", disclosedProjection({
      value: labels,
      displayValue: labels.join("; "),
      normalizedValue: { kind: "text_list", values: labels },
      sources: claimSources(claims),
      claimKind: sourceClaimKind(claims as Array<ClaimWithEvidence & { claimKind: string | null }>),
      rule: "outcomes.other-benefits",
      refs,
    }));
  }
}

export interface ProjectionResult {
  facts: OpportunityFacts;
  projectionRefs: Partial<Record<FieldId, string[]>>;
  conflicts: CardConflict[];
}

export function projectOpportunityFacts(card: OpportunityCard): ProjectionResult {
  const facts = structuredClone(card.facts);
  for (const fieldId of STRUCTURED_PROJECTION_FIELDS) {
    // Anything generated by a prior structured state must be removed before
    // recalculation. Legacy/manual facts have no projection metadata and remain
    // available when V2 has no richer claim for that summary dimension.
    facts[fieldId] = facts[fieldId].projection === null
      ? facts[fieldId]
      : factSchema.parse({ status: "not_found" });
  }
  const projectionRefs: Partial<Record<FieldId, string[]>> = {};
  projectOrganizations(card, facts, projectionRefs);
  projectStages(card, facts, projectionRefs);
  projectCosts(card, facts, projectionRefs);
  projectOutcomes(card, facts, projectionRefs);
  const conflicts = card.conflicts.filter((conflict) =>
    card.facts[conflict.fieldId].projection === null,
  );
  for (const fieldId of STRUCTURED_PROJECTION_FIELDS) {
    const fact = facts[fieldId];
    if (fact.status !== "conflicting" || fact.projection === null) continue;
    conflicts.push({
      fieldId,
      summary: (fact.note ?? `Reviewed structured claims conflict for ${fieldId}.`).slice(0, 500),
    });
  }
  return { facts, projectionRefs, conflicts };
}

export function applyOpportunityProjections<T extends OpportunityCard>(card: T): T {
  const projection = projectOpportunityFacts(card);
  return {
    ...card,
    facts: projection.facts,
    projectionRefs: projection.projectionRefs,
    conflicts: projection.conflicts,
  };
}

export interface ProjectionDrift {
  fields: FieldId[];
  refs: boolean;
  conflicts: boolean;
}

export function getProjectionDrift(card: OpportunityCard): ProjectionDrift {
  const projected = projectOpportunityFacts(card);
  const fields = STRUCTURED_PROJECTION_FIELDS.filter((fieldId) =>
    JSON.stringify(card.facts[fieldId]) !== JSON.stringify(projected.facts[fieldId]),
  );
  return {
    fields,
    refs: JSON.stringify(card.projectionRefs) !== JSON.stringify(projected.projectionRefs),
    conflicts: JSON.stringify(card.conflicts) !== JSON.stringify(projected.conflicts),
  };
}
