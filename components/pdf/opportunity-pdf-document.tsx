import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import {
  FIELD_DEFINITIONS,
  SECTIONS,
  type FieldId,
  type OpportunitySection,
} from "@/lib/opportunity/fields";
import type { EvidenceSource, Fact, OpportunityCard } from "@/lib/opportunity/schema";
import { reviewLabels, statusLabels } from "@/components/status-badge";

export type OpportunityPdfMode = "summary" | "full";

export interface PdfAttentionItem {
  readonly id: string;
  readonly category: string;
  readonly priority: "high" | "medium" | "low";
  readonly title: string;
  readonly explanation: string;
  readonly suggestedNextStep?: string | null;
}

const sectionLabels: Record<OpportunitySection, string> = {
  identity: "Identity",
  eligibility: "Eligibility",
  commitment: "Schedule and commitment",
  money: "Costs and aid",
  selection: "Selection",
  outcomes: "Outcomes",
  terms: "Terms and privacy",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingRight: 46,
    paddingBottom: 52,
    paddingLeft: 46,
    backgroundColor: "#f7f9fc",
    color: "#142337",
    fontFamily: "Source Sans 3",
    fontSize: 9.2,
    lineHeight: 1.45,
  },
  runningHeader: {
    position: "absolute",
    top: 22,
    left: 46,
    right: 46,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.7,
    borderBottomColor: "#b9c7d8",
    paddingBottom: 6,
    color: "#52677f",
    fontSize: 7.5,
  },
  pageNumber: {
    position: "absolute",
    top: 754,
    left: 46,
    right: 46,
    borderTopWidth: 0.7,
    borderTopColor: "#b9c7d8",
    paddingTop: 6,
    color: "#65768a",
    fontSize: 7.5,
    textAlign: "center",
  },
  kicker: {
    color: "#245f9b",
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 8,
    color: "#10263f",
    fontFamily: "Source Sans 3",
    fontWeight: 700,
    fontSize: 27,
    lineHeight: 1.08,
  },
  summary: {
    marginTop: 10,
    color: "#42566d",
    fontSize: 10.5,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  metaPill: {
    borderWidth: 0.7,
    borderColor: "#9eb3ca",
    backgroundColor: "#eef4fa",
    paddingTop: 4,
    paddingRight: 7,
    paddingBottom: 4,
    paddingLeft: 7,
    color: "#254d75",
    fontSize: 7.5,
  },
  metaLabel: {
    color: "#536b83",
    fontWeight: 700,
  },
  boundary: {
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#3279b8",
    backgroundColor: "#edf4fa",
    padding: 10,
    color: "#344d66",
  },
  section: {
    marginTop: 19,
  },
  sectionTitle: {
    borderBottomWidth: 1,
    borderBottomColor: "#87a5c2",
    paddingBottom: 5,
    color: "#173d64",
    fontSize: 13,
    fontWeight: 700,
  },
  glanceGrid: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  glanceItem: {
    width: "48.8%",
    minHeight: 54,
    borderWidth: 0.7,
    borderColor: "#c1cedc",
    backgroundColor: "#ffffff",
    padding: 8,
  },
  label: {
    color: "#5b6f84",
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },
  value: {
    marginTop: 3,
    color: "#152b43",
    fontSize: 10,
    fontWeight: 700,
  },
  status: {
    marginTop: 3,
    color: "#5a6c80",
    fontSize: 7.4,
  },
  attentionItem: {
    marginTop: 7,
    borderWidth: 0.7,
    borderColor: "#d1b675",
    backgroundColor: "#fffaf0",
    padding: 9,
  },
  attentionTitle: {
    color: "#654a12",
    fontSize: 10,
    fontWeight: 700,
  },
  paragraph: {
    marginTop: 4,
    color: "#3f5369",
  },
  compactRow: {
    marginTop: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d5dee8",
    paddingBottom: 6,
  },
  compoundLine: {
    marginTop: 3,
    color: "#152b43",
    fontSize: 9.2,
  },
  factRow: {
    marginTop: 7,
    borderWidth: 0.7,
    borderColor: "#c7d2de",
    backgroundColor: "#ffffff",
    padding: 9,
  },
  factHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  factLabel: {
    color: "#173650",
    fontSize: 9.5,
    fontWeight: 700,
  },
  factStatus: {
    color: "#48647f",
    fontSize: 7.2,
    textTransform: "uppercase",
  },
  evidence: {
    marginTop: 6,
    borderLeftWidth: 1.5,
    borderLeftColor: "#7fa6c9",
    paddingLeft: 7,
  },
  excerpt: {
    color: "#283e53",
    fontFamily: "Source Sans 3",
    fontSize: 8.4,
  },
  sourceLink: {
    marginTop: 3,
    color: "#1d609d",
    fontSize: 7.2,
    textDecoration: "none",
  },
  sourceMeta: {
    marginTop: 2,
    color: "#6a7a8b",
    fontSize: 6.8,
  },
  structureRecord: {
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#7b9fbe",
    backgroundColor: "#ffffff",
    padding: 8,
  },
  structureRecordTitle: {
    color: "#203e5c",
    fontSize: 9.5,
    fontWeight: 700,
  },
  recordContext: {
    marginTop: 3,
    color: "#63778c",
    fontSize: 7.2,
  },
  claimBlock: {
    marginTop: 7,
    marginLeft: 8,
    paddingLeft: 8,
  },
  claimLabel: {
    color: "#536b83",
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  claimDetails: {
    marginTop: 3,
    color: "#475d73",
    fontSize: 7.6,
  },
  evidenceParent: {
    marginTop: 5,
    color: "#5e748a",
    fontSize: 6.8,
    fontWeight: 700,
  },
  metadataBlock: {
    marginTop: 6,
    borderLeftWidth: 1,
    borderLeftColor: "#d5dee8",
    paddingLeft: 5,
    paddingTop: 5,
    color: "#566c82",
    fontSize: 7.2,
  },
  sourceListItem: {
    marginTop: 7,
  },
  disclaimer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#8ba1b7",
    paddingTop: 9,
    color: "#526578",
    fontSize: 7.6,
  },
});

function factDisplay(fact: Fact): string {
  if (fact.status === "not_found") return "Not found in the sources checked";
  if (fact.status === "not_applicable") return "Does not apply";
  if (fact.status === "unclear") return fact.note ?? "The reviewed wording is unclear";
  if (fact.status === "conflicting") return "Reviewed sources support conflicting values";
  return fact.displayValue ?? "Disclosed value unavailable";
}

function formatDate(value: string | null): string {
  if (value === null) return "Not yet reviewed";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function breakableUrl(value: string): string {
  return value.replace(/([/?&=_-])/g, "$1\u200b");
}

function PdfEvidence({ source }: { source: EvidenceSource }) {
  return (
    <View style={styles.evidence}>
      <Text style={styles.excerpt}>“{source.excerpt}”</Text>
      <Link src={source.url} style={styles.sourceLink}>
        {source.title} · {breakableUrl(source.url)}
      </Link>
      <Text style={styles.sourceMeta}>
        {source.pageType.replaceAll("_", " ")} · accessed {formatDate(source.accessedAt)}
      </Text>
    </View>
  );
}

const atAGlance: Array<{ label: string; fieldIds: FieldId[]; includeAll?: boolean }> = [
  { label: "Eligibility", fieldIds: ["grade_levels", "ages", "geographic_restrictions"] },
  { label: "Application deadline", fieldIds: ["application_deadline"] },
  { label: "Dates and duration", fieldIds: ["start_date", "end_date", "duration"] },
  { label: "Format and location", fieldIds: ["participation_format", "location"] },
  { label: "Cost", fieldIds: ["tuition", "estimated_total_mandatory_cost"], includeAll: true },
  { label: "Financial aid", fieldIds: ["financial_aid"] },
  { label: "Operated by", fieldIds: ["operating_organization"] },
  { label: "Institution relationships", fieldIds: ["institution_relationship"] },
  { label: "Selection", fieldIds: ["selection_process"] },
  { label: "Main outcome", fieldIds: ["cash_award", "tuition_waiver", "program_seat", "other_benefits"] },
];

type StructuredClaim = {
  claimId: string;
  status: string;
  value: unknown;
  displayValue: string | null;
  claimKind: string | null;
  note: string | null;
  sources: EvidenceSource[];
  conflictingValues: Array<{
    value: unknown;
    displayValue: string;
    claimKind: string;
    note: string | null;
    sources: EvidenceSource[];
  }>;
};

type ClaimEntry = { label: string; claim: StructuredClaim };

type StructuredRecord = {
  id: string;
  title: string;
  context: string;
  claims: ClaimEntry[];
};

type StructuredGroup = {
  label: string;
  status: string;
  note: string | null;
  completeness?: string;
  records: StructuredRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStructuredClaim(value: unknown): value is StructuredClaim {
  return (
    isRecord(value) &&
    typeof value.claimId === "string" &&
    typeof value.status === "string" &&
    (typeof value.displayValue === "string" || value.displayValue === null) &&
    Array.isArray(value.sources) &&
    Array.isArray(value.conflictingValues)
  );
}

function humanLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined) return "Not specified";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).replaceAll("_", " ");
  }
  if (Array.isArray(value)) return value.length ? value.map(compactValue).join(", ") : "None";
  if (!isRecord(value)) return String(value);
  if ("kind" in value && value.kind === "exact" && "amount" in value && "currency" in value) {
    return `${value.currency} ${value.amount}`;
  }
  if (
    "kind" in value &&
    value.kind === "range" &&
    "minimum" in value &&
    "maximum" in value &&
    "currency" in value
  ) {
    return `${value.currency} ${value.minimum}-${value.maximum}`;
  }
  return Object.entries(value)
    .map(([key, child]) => `${humanLabel(key)}: ${compactValue(child)}`)
    .join("; ");
}

function scopeFromValue(value: unknown): Record<"variantIds" | "stageIds" | "pathwayIds", string[]> | null {
  if (!isRecord(value) || !isRecord(value.scope)) return null;
  const scope = value.scope;
  if (!Array.isArray(scope.variantIds) || !Array.isArray(scope.stageIds) || !Array.isArray(scope.pathwayIds)) {
    return null;
  }
  return {
    variantIds: scope.variantIds.filter((id): id is string => typeof id === "string"),
    stageIds: scope.stageIds.filter((id): id is string => typeof id === "string"),
    pathwayIds: scope.pathwayIds.filter((id): id is string => typeof id === "string"),
  };
}

function buildEntityLabels(card: OpportunityCard): Map<string, string> {
  const labels = new Map<string, string>();
  if (card.organizations.status === "modeled") {
    card.organizations.records.forEach((record) => labels.set(record.id, record.name.displayValue));
  }
  if (card.variants.status === "modeled") {
    card.variants.records.forEach((record) => labels.set(record.id, record.definition.displayValue));
  }
  if (card.stages.status === "modeled") {
    card.stages.records.forEach((record) => labels.set(record.id, record.definition.displayValue));
  }
  if (card.pathways.status === "modeled") {
    card.pathways.records.forEach((record) => labels.set(record.id, record.definition.displayValue));
  }
  if (card.costItems.status === "modeled") {
    card.costItems.records.forEach((record) => labels.set(record.id, record.definition.displayValue));
  }
  if (card.outcomes.status === "modeled") {
    card.outcomes.records.forEach((record) => labels.set(record.id, record.definition.displayValue));
  }
  return labels;
}

function formatScope(value: unknown, labels: Map<string, string>): string | null {
  const scope = scopeFromValue(value);
  if (!scope) return null;
  const parts = [
    scope.variantIds.length
      ? `Programs/cohorts: ${scope.variantIds.map((id) => labels.get(id) ?? id).join(", ")}`
      : null,
    scope.stageIds.length
      ? `Stages: ${scope.stageIds.map((id) => labels.get(id) ?? id).join(", ")}`
      : null,
    scope.pathwayIds.length
      ? `Pathways: ${scope.pathwayIds.map((id) => labels.get(id) ?? id).join(", ")}`
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(" | ") : "Applies to the opportunity generally";
}

function structuredDetails(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value).filter(([key]) => key !== "scope");
  return entries.length ? entries.map(([key, child]) => `${humanLabel(key)}: ${compactValue(child)}`).join(" | ") : null;
}

function collectClaimEntries(
  value: unknown,
  path: string[] = [],
  seen = new Set<string>(),
): ClaimEntry[] {
  if (isStructuredClaim(value)) {
    if (seen.has(value.claimId)) return [];
    seen.add(value.claimId);
    return [{ label: path.length ? path.join(" / ") : "Claim", claim: value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectClaimEntries(item, [...path, `Item ${index + 1}`], seen));
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "id" || key === "order"
      ? []
      : collectClaimEntries(child, [...path, humanLabel(key)], seen),
  );
}

function recordTitle(record: Record<string, unknown>, fallback: string): string {
  for (const key of ["definition", "name", "assertion", "label"]) {
    const candidate = record[key];
    if (isStructuredClaim(candidate) && candidate.displayValue) return candidate.displayValue;
  }
  return fallback;
}

function recordContext(record: Record<string, unknown>, labels: Map<string, string>): string {
  const parts: string[] = [];
  if (typeof record.id === "string") parts.push(`Record ID: ${record.id}`);
  if (typeof record.order === "number") parts.push(`Order: ${record.order}`);
  for (const [key, child] of Object.entries(record)) {
    if (key.endsWith("Id") && typeof child === "string") {
      parts.push(`${humanLabel(key)}: ${labels.get(child) ?? child}`);
    }
  }
  return parts.join(" | ");
}

function collectionGroup(
  label: string,
  collection: unknown,
  labels: Map<string, string>,
): StructuredGroup {
  if (!isRecord(collection)) {
    return { label, status: "unassessed", note: null, records: [] };
  }
  const status = typeof collection.status === "string" ? collection.status : "unassessed";
  const note = typeof collection.note === "string" ? collection.note : null;
  const completeness = typeof collection.completeness === "string" ? collection.completeness : undefined;
  const rawRecords = Array.isArray(collection.records) ? collection.records : [];
  return {
    label,
    status,
    note,
    completeness,
    records: rawRecords.filter(isRecord).map((record, index) => ({
      id: typeof record.id === "string" ? record.id : `${label}-${index + 1}`,
      title: recordTitle(record, `${label} record ${index + 1}`),
      context: recordContext(record, labels),
      claims: collectClaimEntries(record),
    })),
  };
}

function structuredGroups(card: OpportunityCard): StructuredGroup[] {
  const labels = buildEntityLabels(card);
  const cycleGroup: StructuredGroup = card.cycle.status === "modeled"
    ? {
        label: "Cycle",
        status: "modeled",
        note: null,
        records: [{
          id: card.cycle.value.id,
          title: card.cycle.value.label.displayValue,
          context: `Record ID: ${card.cycle.value.id}`,
          claims: collectClaimEntries(card.cycle.value),
        }],
      }
    : { label: "Cycle", status: "unassessed", note: null, records: [] };
  return [
    cycleGroup,
    collectionGroup("Organizations", card.organizations, labels),
    collectionGroup("Organization roles", card.organizationRoles, labels),
    collectionGroup("Institution relationships", card.institutionRelationships, labels),
    collectionGroup("Programs and cohorts", card.variants, labels),
    collectionGroup("Stages", card.stages, labels),
    collectionGroup("Pathways", card.pathways, labels),
    collectionGroup("Costs", card.costItems, labels),
    collectionGroup("Outcomes", card.outcomes, labels),
  ];
}

function meaningfulFacts(card: OpportunityCard, fieldIds: readonly FieldId[], includeAll = false) {
  if (includeAll) {
    return fieldIds.map((fieldId) => ({
      field: FIELD_DEFINITIONS.find((candidate) => candidate.id === fieldId)!,
      fact: card.facts[fieldId],
    }));
  }
  const useful = fieldIds
    .map((fieldId) => ({
      field: FIELD_DEFINITIONS.find((candidate) => candidate.id === fieldId)!,
      fact: card.facts[fieldId],
    }))
    .filter(({ fact }) => fact.status === "disclosed" || fact.status === "conflicting");
  if (useful.length) return useful;
  const fallbackId = fieldIds[0];
  return [{
    field: FIELD_DEFINITIONS.find((candidate) => candidate.id === fallbackId)!,
    fact: card.facts[fallbackId],
  }];
}

function SummaryCompoundFact({
  card,
  label,
  fieldIds,
  includeAll = false,
}: {
  card: OpportunityCard;
  label: string;
  fieldIds: readonly FieldId[];
  includeAll?: boolean;
}) {
  const facts = meaningfulFacts(card, fieldIds, includeAll);
  return (
    <View style={styles.glanceItem} wrap={false}>
      <Text style={styles.label}>{label}</Text>
      {facts.map(({ field, fact }) => (
        <View key={field.id}>
          {facts.length > 1 ? <Text style={styles.status}>{field.label}</Text> : null}
          <Text style={facts.length > 1 ? styles.compoundLine : styles.value}>{factDisplay(fact)}</Text>
          <Text style={styles.status}>{statusLabels[fact.status]}</Text>
        </View>
      ))}
    </View>
  );
}

function reviewDateLabel(card: OpportunityCard): string {
  if (card.reviewState === "ai_audited") return "AI-audited date";
  if (card.reviewState === "human_reviewed") return "Human-reviewed date";
  if (card.reviewState === "organizer_confirmed") return "Organizer-confirmed date";
  return "Record date";
}

function StructuredClaimView({
  entry,
  labels,
  parentTitle,
}: {
  entry: ClaimEntry;
  labels: Map<string, string>;
  parentTitle: string;
}) {
  const { claim } = entry;
  const scope = formatScope(claim.value, labels);
  const details = structuredDetails(claim.value);
  const value = claim.displayValue ?? claim.note ?? statusLabels[claim.status as keyof typeof statusLabels] ?? claim.status;
  return (
    <View style={styles.claimBlock}>
      <View wrap={false} minPresenceAhead={45}>
        <Text style={styles.claimLabel}>{entry.label}</Text>
        <Text style={styles.structureRecordTitle}>{value}</Text>
        <Text style={styles.recordContext}>
          {humanLabel(claim.status)} | Claim ID: {claim.claimId}
          {claim.claimKind ? ` | ${humanLabel(claim.claimKind)}` : ""}
        </Text>
        {scope ? <Text style={styles.claimDetails}>Scope: {scope}</Text> : null}
        {details ? <Text style={styles.claimDetails}>Structured value: {details}</Text> : null}
        {claim.note && claim.displayValue ? <Text style={styles.claimDetails}>Note: {claim.note}</Text> : null}
      </View>
      {claim.sources.map((source, index) => (
        <View key={`${claim.claimId}-${source.id}-${index}`} wrap={false}>
          <Text style={styles.evidenceParent}>Evidence for {parentTitle} / {entry.label}</Text>
          <PdfEvidence source={source} />
        </View>
      ))}
      {claim.conflictingValues.map((candidate, candidateIndex) => (
        <View key={`${claim.claimId}-candidate-${candidateIndex}`}>
          <View wrap={false}>
            <Text style={styles.claimDetails}>
              Conflicting candidate {candidateIndex + 1}: {candidate.displayValue}
            </Text>
            <Text style={styles.recordContext}>
              {humanLabel(candidate.claimKind)}
              {candidate.note ? ` | ${candidate.note}` : ""}
            </Text>
          </View>
          {candidate.sources.map((source, sourceIndex) => (
            <View key={`${claim.claimId}-conflict-${candidateIndex}-${sourceIndex}`} wrap={false}>
              <Text style={styles.evidenceParent}>
                Evidence for {parentTitle} / {entry.label} / conflicting candidate {candidateIndex + 1}
              </Text>
              <PdfEvidence source={source} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function SummaryDocument({
  card,
  attentionItems,
  generatedAt,
}: {
  card: OpportunityCard;
  attentionItems: readonly PdfAttentionItem[];
  generatedAt: string;
}) {
  const name = card.facts.opportunity_name.displayValue ?? card.slug;
  const cycle = card.cycle.status === "modeled" ? card.cycle.value.label.value : "Cycle not established";
  const stages = card.stages.status === "modeled" ? card.stages.records : [];
  const costs = card.costItems.status === "modeled" ? card.costItems.records : [];
  const outcomes = card.outcomes.status === "modeled" ? card.outcomes.records : [];
  const entityLabels = buildEntityLabels(card);
  return (
    <Document title={`${name} — Opportunity Facts summary`} author="Opportunity Facts">
      <Page size="LETTER" style={styles.page}>
        <RunningChrome name={name} label="Student summary" />
        <Text style={styles.kicker}>Opportunity Facts · Student summary</Text>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.summary}>{card.summary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaPill}>{reviewLabels[card.reviewState]}</Text>
          <Text style={styles.metaPill}>{cycle}</Text>
          <Text style={styles.metaPill}>
            <Text style={styles.metaLabel}>Generated: </Text>{formatDate(generatedAt)}
          </Text>
          <Text style={styles.metaPill}>
            <Text style={styles.metaLabel}>{reviewDateLabel(card)}: </Text>{formatDate(card.reviewedAt)}
          </Text>
        </View>
        <View style={styles.boundary}>
          <Text>
            AI-assisted research organizes public-source evidence. This summary is not a rating,
            recommendation, legitimacy finding, or substitute for checking the official pages.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <View style={styles.glanceGrid}>
            {atAGlance.map((item) => (
              <SummaryCompoundFact
                key={item.label}
                card={card}
                label={item.label}
                fieldIds={item.fieldIds}
                includeAll={item.includeAll}
              />
            ))}
          </View>
        </View>

        {attentionItems.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} minPresenceAhead={90}>Needs attention</Text>
            {attentionItems.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.attentionItem} wrap={false}>
                <Text style={styles.label}>{item.category.replaceAll("_", " ")} · {item.priority}</Text>
                <Text style={styles.attentionTitle}>{item.title}</Text>
                <Text style={styles.paragraph}>{item.explanation}</Text>
                {item.suggestedNextStep ? (
                  <Text style={styles.paragraph}>Verify next: {item.suggestedNextStep}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {stages.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline and selection</Text>
            {stages.map((stage) => (
              <View key={stage.id} style={styles.compactRow} wrap={false}>
                <Text style={styles.factLabel}>{stage.definition.displayValue}</Text>
                {stage.timings.map((timing) => (
                  <Text key={timing.claimId} style={styles.paragraph}>{timing.displayValue}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Costs, aid, and outcomes</Text>
          {(["tuition", "estimated_total_mandatory_cost", "financial_aid", "refund_policy"] as FieldId[]).map((fieldId) => {
            const field = FIELD_DEFINITIONS.find((candidate) => candidate.id === fieldId)!;
            const fact = card.facts[fieldId];
            return (
              <View key={fieldId} style={styles.compactRow} wrap={false}>
                <Text style={styles.label}>{field.label}</Text>
                <Text style={styles.value}>{factDisplay(fact)}</Text>
              </View>
            );
          })}
          {card.costItems.status !== "modeled" ? (
            <View style={styles.compactRow} wrap={false}>
              <Text style={styles.label}>Structured cost inventory</Text>
              <Text style={styles.paragraph}>
                {humanLabel(card.costItems.status)}
                {card.costItems.note ? `: ${card.costItems.note}` : ""}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.compactRow} wrap={false}>
                <Text style={styles.label}>Structured cost inventory</Text>
                <Text style={styles.paragraph}>
                  {humanLabel(card.costItems.completeness)} inventory
                  {card.costItems.note ? `: ${card.costItems.note}` : ""}
                </Text>
              </View>
              {costs.map((cost) => {
                const scope = formatScope(cost.definition.value, entityLabels);
                return (
                  <View key={cost.id} style={styles.compactRow} wrap={false}>
                    <Text style={styles.label}>{humanLabel(cost.definition.value.kind)} | {humanLabel(cost.definition.value.requirement)}</Text>
                    <Text style={styles.value}>{cost.definition.displayValue}</Text>
                    <Text style={styles.paragraph}>{cost.amount.displayValue ?? cost.amount.note}</Text>
                    {scope ? <Text style={styles.paragraph}>Scope: {scope}</Text> : null}
                    {cost.chargeBasis ? <Text style={styles.paragraph}>Charge basis: {cost.chargeBasis.displayValue ?? cost.chargeBasis.note}</Text> : null}
                    {cost.refundability ? <Text style={styles.paragraph}>Refundability: {cost.refundability.displayValue ?? cost.refundability.note}</Text> : null}
                    {cost.conditions.map((condition) => (
                      <Text key={condition.claimId} style={styles.paragraph}>Condition: {condition.displayValue}</Text>
                    ))}
                  </View>
                );
              })}
            </>
          )}
          {outcomes.map((outcome) => (
            <View key={outcome.id} style={styles.compactRow} wrap={false}>
              <Text style={styles.label}>Outcome</Text>
              <Text style={styles.value}>{outcome.definition.displayValue}</Text>
              {outcome.amount ? <Text style={styles.paragraph}>{outcome.amount.displayValue}</Text> : null}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Essential sources</Text>
          {card.sourcePagesChecked.slice(0, 10).map((source) => (
            <View key={source.id} style={styles.sourceListItem}>
              <Link src={source.url} style={styles.sourceLink}>{source.title}</Link>
              <Text style={styles.sourceMeta}>{breakableUrl(source.url)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

function FullDocument({ card, generatedAt }: { card: OpportunityCard; generatedAt: string }) {
  const name = card.facts.opportunity_name.displayValue ?? card.slug;
  const labels = buildEntityLabels(card);
  return (
    <Document title={`${name} — Opportunity Facts full evidence record`} author="Opportunity Facts">
      <Page size="LETTER" style={styles.page}>
        <RunningChrome name={name} label="Full evidence record" />
        <Text style={styles.kicker}>Opportunity Facts · Full evidence record</Text>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.summary}>{card.summary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaPill}>{reviewLabels[card.reviewState]}</Text>
          <Text style={styles.metaPill}>Card revision {card.cardVersion}</Text>
          <Text style={styles.metaPill}>Schema {card.schemaVersion}</Text>
          <Text style={styles.metaPill}>
            <Text style={styles.metaLabel}>Generated: </Text>{formatDate(generatedAt)}
          </Text>
          <Text style={styles.metaPill}>
            <Text style={styles.metaLabel}>{reviewDateLabel(card)}: </Text>{formatDate(card.reviewedAt)}
          </Text>
        </View>
        <View style={styles.boundary}>
          <Text>
            Review state describes the source-alignment process, not independent verification of
            the underlying claims. Statuses and uncertainty are preserved below.
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Record contents</Text>
          <Text style={styles.paragraph}>
            Structured source model · all 59 projected facts · exact evidence excerpts · source
            inventory · review and version metadata
          </Text>
        </View>
        <Disclaimer />
      </Page>

      {structuredGroups(card).flatMap((group) => {
        const records: Array<StructuredRecord | null> = group.records.length ? group.records : [null];
        return records.map((record, recordIndex) => (
          <Page key={`${group.label}-${record?.id ?? "empty"}`} size="LETTER" style={styles.page}>
            <RunningChrome name={name} label="Structured source model" />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {group.label}{group.records.length > 1 ? ` | record ${recordIndex + 1} of ${group.records.length}` : ""}
              </Text>
              <View style={styles.metadataBlock} wrap={false}>
                <Text>Collection status: {humanLabel(group.status)}</Text>
                {group.completeness ? <Text>Inventory completeness: {humanLabel(group.completeness)}</Text> : null}
                {group.note ? <Text>Collection note: {group.note}</Text> : null}
              </View>
              {record ? (
                <View>
                  <View style={styles.structureRecord} wrap={false} minPresenceAhead={55}>
                    <Text style={styles.label}>{group.label} record</Text>
                    <Text style={styles.structureRecordTitle}>{record.title}</Text>
                    {record.context ? <Text style={styles.recordContext}>{record.context}</Text> : null}
                  </View>
                  {record.claims.map((entry) => (
                    <StructuredClaimView
                      key={entry.claim.claimId}
                      entry={entry}
                      labels={labels}
                      parentTitle={record.title}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.paragraph}>
                  No modeled records. {group.note ?? "This structured collection has no retained records."}
                </Text>
              )}
            </View>
          </Page>
        ));
      })}

      {SECTIONS.map((section) => (
        <Page key={section} size="LETTER" style={styles.page}>
          <RunningChrome name={name} label="Projected facts" />
          <View key={section} style={styles.section}>
            <Text style={styles.sectionTitle}>{sectionLabels[section]} · projected facts</Text>
            {FIELD_DEFINITIONS.filter((field) => field.section === section).map((field) => {
              const fact = card.facts[field.id];
              return (
                <View key={field.id}>
                <View style={styles.factRow} wrap={false} minPresenceAhead={50}>
                  <View style={styles.factHeader}>
                    <Text style={styles.factLabel}>{field.label}</Text>
                    <Text style={styles.factStatus}>{statusLabels[fact.status]}</Text>
                  </View>
                  <Text style={styles.value}>{factDisplay(fact)}</Text>
                  {fact.note && fact.status !== "unclear" ? <Text style={styles.paragraph}>{fact.note}</Text> : null}
                  {fact.status === "conflicting" ? fact.conflictingValues.map((candidate, index) => (
                    <View key={`${field.id}-candidate-${index}`} style={styles.compactRow}>
                      <Text style={styles.factLabel}>Supported value {index + 1}: {candidate.displayValue}</Text>
                      {candidate.note ? <Text style={styles.paragraph}>Note: {candidate.note}</Text> : null}
                    </View>
                  )) : null}
                </View>
                  <View style={styles.metadataBlock} wrap={false}>
                    <Text style={styles.evidenceParent}>Projection and calculation metadata for {field.label}</Text>
                    <Text>Field ID: {field.id}</Text>
                    <Text>Claim kind: {fact.claimKind ? humanLabel(fact.claimKind) : "None"}</Text>
                    {fact.projection ? (
                      <>
                        <Text>Projection rule: {fact.projection.rule}</Text>
                        <Text>Projection schema: {fact.projection.schemaVersion}</Text>
                      </>
                    ) : <Text>Projection metadata: Not projected from a structured V2 collection</Text>}
                    {fact.calculation ? (
                      <>
                        <Text>Calculation formula: {fact.calculation.formula}</Text>
                        <Text>Calculation inputs: {fact.calculation.inputs.map((input) => `${input.fieldId}=${input.value}`).join(", ")}</Text>
                        <Text>Calculation explanation: {fact.calculation.explanation}</Text>
                      </>
                    ) : <Text>Calculation: None</Text>}
                  </View>
                  {fact.projection ? (
                    fact.projection.claimRefs.length ? (
                      Array.from({ length: Math.ceil(fact.projection.claimRefs.length / 8) }, (_, index) => (
                        <View key={`${field.id}-refs-${index}`} style={styles.metadataBlock} wrap={false}>
                          <Text style={styles.evidenceParent}>
                            Structured claim references for {field.label} | group {index + 1}
                          </Text>
                          <Text>{fact.projection!.claimRefs.slice(index * 8, (index + 1) * 8).join(", ")}</Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.metadataBlock} wrap={false}>
                        <Text style={styles.evidenceParent}>Structured claim references for {field.label}</Text>
                        <Text>Assessed absence; no positive claim references</Text>
                      </View>
                    )
                  ) : null}
                  {fact.status === "conflicting" ? (
                    fact.conflictingValues.flatMap((candidate, candidateIndex) =>
                      candidate.sources.map((source, sourceIndex) => (
                        <View key={`${field.id}-candidate-${candidateIndex}-${sourceIndex}`} wrap={false}>
                          <Text style={styles.evidenceParent}>
                            Evidence for {field.label} / supported value {candidateIndex + 1}: {candidate.displayValue}
                          </Text>
                          <PdfEvidence source={source} />
                        </View>
                      )),
                    )
                  ) : (
                    fact.sources.map((source, index) => (
                      <View key={`${field.id}-${source.id}-${index}`} wrap={false}>
                        <Text style={styles.evidenceParent}>Evidence for projected fact: {field.label}</Text>
                        <PdfEvidence source={source} />
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        </Page>
      ))}

      <Page size="LETTER" style={styles.page}>
        <RunningChrome name={name} label="Sources and record boundary" />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Source inventory</Text>
          {card.sourcePagesChecked.map((source) => (
            <View key={source.id} style={styles.sourceListItem}>
              <Link src={source.url} style={styles.sourceLink}>{source.title}</Link>
              <Text style={styles.sourceMeta}>
                {breakableUrl(source.url)} · {source.pageType.replaceAll("_", " ")} · accessed {formatDate(source.accessedAt)}
              </Text>
            </View>
          ))}
        </View>
        <Disclaimer />
      </Page>
    </Document>
  );
}

function RunningChrome({ name, label }: { name: string; label: string }) {
  return (
    <>
      <View style={styles.runningHeader} fixed>
        <Text>Opportunity Facts</Text>
        <Text>{name} · {label}</Text>
      </View>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </>
  );
}

function Disclaimer() {
  return (
    <View style={styles.disclaimer}>
      <Text>
        Opportunity Facts reports what identified sources disclose and keeps missing, unclear, and
        conflicting information visible. It does not rank opportunities or assess legitimacy,
        prestige, quality, value, admissions impact, or whether anyone should apply or pay.
      </Text>
    </View>
  );
}

export function OpportunityPdfDocument({
  card,
  mode,
  attentionItems = [],
  fontBaseUrl = "/fonts",
  generatedAt = new Date().toISOString(),
}: {
  card: OpportunityCard;
  mode: OpportunityPdfMode;
  attentionItems?: readonly PdfAttentionItem[];
  fontBaseUrl?: string;
  generatedAt?: string;
}) {
  Font.register({
    family: "Source Sans 3",
    fonts: [
      { src: `${fontBaseUrl}/SourceSans3-Regular.ttf`, fontWeight: 400 },
      { src: `${fontBaseUrl}/SourceSans3-Bold.ttf`, fontWeight: 700 },
    ],
  });
  return mode === "summary" ? (
    <SummaryDocument card={card} attentionItems={attentionItems} generatedAt={generatedAt} />
  ) : (
    <FullDocument card={card} generatedAt={generatedAt} />
  );
}
