import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { reviewLabels, statusLabels } from "@/components/status-badge";
import {
  FIELD_DEFINITIONS,
  SECTIONS,
  type FieldId,
  type OpportunitySection,
} from "@/lib/opportunity/fields";
import type { EvidenceSource, Fact, OpportunityCard } from "@/lib/opportunity/schema";

export type OpportunityPdfMode = "summary" | "full";

export interface PdfAttentionItem {
  readonly id: string;
  readonly category: string;
  readonly priority: "high" | "medium" | "low";
  readonly title: string;
  readonly explanation: string;
  readonly suggestedNextStep?: string | null;
}

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
  definitionClaim: StructuredClaim | null;
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

interface EvidenceRegisterEntry {
  readonly number: number;
  readonly label: string;
  readonly source: EvidenceSource;
}

export interface OpportunityPdfReportModel {
  readonly structuredGroups: readonly StructuredGroup[];
  readonly projectedFacts: ReadonlyArray<{
    readonly fieldId: FieldId;
    readonly label: string;
    readonly fact: Fact;
  }>;
  readonly evidence: readonly EvidenceRegisterEntry[];
  readonly sourceNumbers: ReadonlyMap<string, number>;
  readonly evidenceLabelsByKey: ReadonlyMap<string, string>;
}

const sectionLabels: Record<OpportunitySection, string> = {
  identity: "Identity and operator",
  eligibility: "Eligibility",
  commitment: "Dates and participation",
  money: "Costs and aid",
  selection: "Selection",
  outcomes: "Outcomes and benefits",
  terms: "Terms and privacy",
};

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

const summaryCostFields: FieldId[] = [
  "tuition",
  "estimated_total_mandatory_cost",
  "financial_aid",
  "refund_policy",
];

const styles = StyleSheet.create({
  page: {
    paddingTop: 43,
    paddingRight: 38,
    paddingBottom: 76,
    paddingLeft: 38,
    backgroundColor: "#f8fafc",
    color: "#142337",
    fontFamily: "Source Sans 3",
    fontSize: 8.4,
    lineHeight: 1.32,
  },
  header: {
    position: "absolute",
    top: 17,
    left: 38,
    right: 38,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.6,
    borderBottomColor: "#b8c6d4",
    paddingBottom: 5,
    color: "#5b6c7e",
    fontSize: 6.8,
  },
  footer: {
    position: "absolute",
    top: 710,
    left: 38,
    right: 38,
    borderTopWidth: 0.6,
    borderTopColor: "#b8c6d4",
    paddingTop: 5,
    color: "#697989",
    fontSize: 6.8,
    textAlign: "center",
  },
  kicker: {
    color: "#245f9b",
    fontSize: 7.4,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    color: "#10263f",
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.06,
  },
  summary: {
    marginTop: 7,
    color: "#41556b",
    fontSize: 9.5,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  metaPill: {
    borderWidth: 0.6,
    borderColor: "#9fb3c8",
    backgroundColor: "#edf3f9",
    paddingTop: 3,
    paddingRight: 6,
    paddingBottom: 3,
    paddingLeft: 6,
    color: "#315679",
    fontSize: 6.7,
  },
  boundary: {
    marginTop: 10,
    borderLeftWidth: 2.5,
    borderLeftColor: "#3279b8",
    backgroundColor: "#edf4fa",
    padding: 7,
    color: "#344d66",
    fontSize: 7.7,
  },
  section: { marginTop: 13 },
  sectionTitle: {
    borderBottomWidth: 0.8,
    borderBottomColor: "#89a5c0",
    paddingBottom: 3,
    color: "#173d64",
    fontSize: 11.2,
    fontWeight: 700,
  },
  sectionLead: { marginTop: 4, color: "#53687d", fontSize: 7.4 },
  glanceGrid: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  glanceItem: {
    width: "49.1%",
    minHeight: 43,
    borderWidth: 0.6,
    borderColor: "#c1cedc",
    backgroundColor: "#ffffff",
    padding: 6,
  },
  label: {
    color: "#607287",
    fontSize: 6.4,
    fontWeight: 700,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  value: { marginTop: 2, color: "#152b43", fontSize: 8.7, fontWeight: 700 },
  valueRegular: { marginTop: 2, color: "#22384e", fontSize: 8.1 },
  status: { marginTop: 2, color: "#66788a", fontSize: 6.5 },
  refs: { marginTop: 2, color: "#276392", fontSize: 6.2 },
  attentionItem: {
    marginTop: 5,
    borderWidth: 0.6,
    borderColor: "#d1b675",
    backgroundColor: "#fffaf0",
    padding: 7,
  },
  attentionTitle: { color: "#654a12", fontSize: 8.8, fontWeight: 700 },
  paragraph: { marginTop: 3, color: "#43586d" },
  compactRow: {
    marginTop: 4,
    borderBottomWidth: 0.4,
    borderBottomColor: "#d5dee8",
    paddingBottom: 4,
  },
  twoColumnRow: { flexDirection: "row", gap: 12 },
  twoColumn: { width: "49%" },
  group: {
    marginTop: 7,
    paddingLeft: 5,
  },
  groupTitle: { color: "#1d405f", fontSize: 9, fontWeight: 700 },
  record: {
    marginTop: 5,
    paddingTop: 4,
  },
  recordTitle: { color: "#18354f", fontSize: 8.3, fontWeight: 700 },
  recordContext: { marginTop: 1, color: "#66798c", fontSize: 6.4 },
  claimLine: { marginTop: 2.5, color: "#344b61", fontSize: 7.4 },
  claimLabel: { color: "#203d59", fontWeight: 700 },
  factRow: {
    marginTop: 4,
    borderBottomWidth: 0.4,
    borderBottomColor: "#d5dee8",
    paddingBottom: 4,
  },
  factTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  factLabel: { color: "#173650", fontSize: 8, fontWeight: 700 },
  factStatus: { color: "#5d7185", fontSize: 6.4, textTransform: "uppercase" },
  evidenceItem: {
    marginTop: 5,
    borderLeftWidth: 1.3,
    borderLeftColor: "#86a8c6",
    paddingLeft: 6,
  },
  evidenceTitle: { color: "#204765", fontSize: 7.5, fontWeight: 700 },
  excerpt: { marginTop: 2, color: "#2c4257", fontSize: 7.3 },
  sourceLink: { marginTop: 2, color: "#1d609d", fontSize: 6.5, textDecoration: "none" },
  sourceMeta: { marginTop: 1, color: "#6a7a8b", fontSize: 6.1 },
  sourceItem: { marginTop: 4 },
  disclaimer: {
    marginTop: 14,
    borderTopWidth: 0.8,
    borderTopColor: "#8ba1b7",
    paddingTop: 7,
    color: "#526578",
    fontSize: 6.8,
  },
});

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

function reviewDateLabel(card: OpportunityCard): string {
  if (card.reviewState === "ai_audited") return "AI-audited";
  if (card.reviewState === "human_reviewed") return "Human-reviewed";
  if (card.reviewState === "organizer_confirmed") return "Organizer-confirmed";
  return "Record";
}

function claimSources(claim: StructuredClaim): EvidenceSource[] {
  return [
    ...claim.sources,
    ...claim.conflictingValues.flatMap((candidate) => candidate.sources),
  ];
}

function evidenceKey(source: EvidenceSource): string {
  return `${source.url}\u0000${source.excerpt}`;
}

function sourceNumbers(card: OpportunityCard): Map<string, number> {
  return new Map(card.sourcePagesChecked.map((source, index) => [source.url, index + 1]));
}

function sourceRefs(sources: readonly EvidenceSource[], numbers: ReadonlyMap<string, number>): string {
  const references = Array.from(new Set(sources.map((source) => numbers.get(source.url)).filter(
    (number): number is number => number !== undefined,
  ))).sort((left, right) => left - right);
  return references.length ? references.map((number) => `S${number}`).join(", ") : "";
}

function factSources(fact: Fact): EvidenceSource[] {
  return fact.status === "conflicting"
    ? fact.conflictingValues.flatMap((candidate) => candidate.sources)
    : fact.sources;
}

export function getSummarySourceUrls(card: OpportunityCard): ReadonlySet<string> {
  const urls = new Set<string>();
  const add = (sources: readonly EvidenceSource[]) => sources.forEach((source) => urls.add(source.url));
  for (const item of atAGlance) {
    for (const fieldId of item.fieldIds) add(factSources(card.facts[fieldId]));
  }
  for (const fieldId of summaryCostFields) add(factSources(card.facts[fieldId]));
  if (card.stages.status === "modeled") {
    for (const stage of card.stages.records.slice(0, 8)) {
      add(claimSources(stage.definition));
      stage.timings.forEach((timing) => add(claimSources(timing)));
    }
  }
  if (card.costItems.status === "modeled") {
    for (const cost of card.costItems.records.slice(0, 6)) {
      add(claimSources(cost.definition));
      add(claimSources(cost.amount));
      if (cost.chargeBasis) add(claimSources(cost.chargeBasis));
    }
  }
  if (card.outcomes.status === "modeled") {
    for (const outcome of card.outcomes.records.slice(0, 6)) {
      add(claimSources(outcome.definition));
      if (outcome.amount) add(claimSources(outcome.amount));
    }
  }
  return urls;
}

function evidenceRefs(
  sources: readonly EvidenceSource[],
  labels: ReadonlyMap<string, string>,
): string {
  return Array.from(new Set(sources.map((source) => labels.get(evidenceKey(source))).filter(
    (label): label is string => label !== undefined,
  ))).join(", ");
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
    return value.flatMap((item, index) => {
      const itemPath = path.length
        ? [...path.slice(0, -1), `${path.at(-1)} ${index + 1}`]
        : [`Item ${index + 1}`];
      return collectClaimEntries(item, itemPath, seen);
    });
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "id" || key === "order"
      ? []
      : collectClaimEntries(child, [...path, humanLabel(key)], seen),
  );
}

function recordDefinitionClaim(record: Record<string, unknown>): StructuredClaim | null {
  for (const key of ["definition", "name", "assertion", "label"]) {
    if (isStructuredClaim(record[key])) return record[key];
  }
  return null;
}

function recordTitle(record: Record<string, unknown>, fallback: string): string {
  return recordDefinitionClaim(record)?.displayValue ?? fallback;
}

function buildEntityLabels(card: OpportunityCard): Map<string, string> {
  const labels = new Map<string, string>();
  const collections = [
    card.organizations,
    card.variants,
    card.stages,
    card.pathways,
    card.costItems,
    card.outcomes,
  ];
  for (const collection of collections) {
    if (collection.status !== "modeled") continue;
    for (const record of collection.records) {
      const candidate = record as unknown as Record<string, unknown>;
      labels.set(record.id, recordTitle(candidate, record.id));
    }
  }
  return labels;
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

function formatScope(value: unknown, labels: ReadonlyMap<string, string>): string | null {
  const scope = scopeFromValue(value);
  if (!scope) return null;
  const parts = [
    scope.variantIds.length ? `Programs: ${scope.variantIds.map((id) => labels.get(id) ?? id).join(", ")}` : null,
    scope.stageIds.length ? `Stages: ${scope.stageIds.map((id) => labels.get(id) ?? id).join(", ")}` : null,
    scope.pathwayIds.length ? `Pathways: ${scope.pathwayIds.map((id) => labels.get(id) ?? id).join(", ")}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join("; ") : null;
}

function recordContext(record: Record<string, unknown>, labels: ReadonlyMap<string, string>): string {
  const parts: string[] = [];
  if (typeof record.order === "number") parts.push(`Order ${record.order}`);
  for (const [key, child] of Object.entries(record)) {
    if (key.endsWith("Id") && typeof child === "string") {
      parts.push(`${humanLabel(key.replace(/Id$/, ""))}: ${labels.get(child) ?? child}`);
    }
  }
  return parts.join(" | ");
}

function collectionGroup(
  label: string,
  collection: unknown,
  labels: ReadonlyMap<string, string>,
): StructuredGroup {
  if (!isRecord(collection)) return { label, status: "unassessed", note: null, records: [] };
  const status = typeof collection.status === "string" ? collection.status : "unassessed";
  const note = typeof collection.note === "string" ? collection.note : null;
  const completeness = typeof collection.completeness === "string" ? collection.completeness : undefined;
  const records = Array.isArray(collection.records) ? collection.records.filter(isRecord) : [];
  return {
    label,
    status,
    note,
    completeness,
    records: records.map((record, index) => {
      const definitionClaim = recordDefinitionClaim(record);
      return {
        id: typeof record.id === "string" ? record.id : `${label}-${index + 1}`,
        title: recordTitle(record, `${label} ${index + 1}`),
        definitionClaim,
        context: recordContext(record, labels),
        claims: collectClaimEntries(record).filter((entry) => entry.claim.claimId !== definitionClaim?.claimId),
      };
    }),
  };
}

function structuredGroups(card: OpportunityCard): StructuredGroup[] {
  const labels = buildEntityLabels(card);
  const modeledCycle = card.cycle.status === "modeled" ? card.cycle.value : null;
  const cycle: StructuredGroup = modeledCycle
    ? {
        label: "Cycle",
        status: "modeled",
        note: null,
        records: [{
          id: modeledCycle.id,
          title: modeledCycle.label.displayValue,
          definitionClaim: modeledCycle.label,
          context: "",
          claims: collectClaimEntries(modeledCycle).filter(
            (entry) => entry.claim.claimId !== modeledCycle.label.claimId,
          ),
        }],
      }
    : { label: "Cycle", status: card.cycle.status, note: null, records: [] };
  return [
    cycle,
    collectionGroup("Organizations", card.organizations, labels),
    collectionGroup("Organization roles", card.organizationRoles, labels),
    collectionGroup("Institution relationships", card.institutionRelationships, labels),
    collectionGroup("Programs and cohorts", card.variants, labels),
    collectionGroup("Stages and deadlines", card.stages, labels),
    collectionGroup("Selection pathways", card.pathways, labels),
    collectionGroup("Costs", card.costItems, labels),
    collectionGroup("Outcomes", card.outcomes, labels),
  ];
}

function projectedFacts(
  card: OpportunityCard,
  assessedFieldIds?: readonly FieldId[],
): OpportunityPdfReportModel["projectedFacts"] {
  const assessed = assessedFieldIds ? new Set(assessedFieldIds) : null;
  return FIELD_DEFINITIONS.flatMap((field) => {
    if (assessed && !assessed.has(field.id)) return [];
    if (field.id === "opportunity_name" || field.id === "official_url") return [];
    const fact = card.facts[field.id];
    const include =
      fact.status === "disclosed" ||
      fact.status === "conflicting" ||
      fact.status === "unclear" ||
      (field.core && fact.status === "not_found");
    return include ? [{ fieldId: field.id, label: field.label, fact }] : [];
  });
}

export function createOpportunityPdfReportModel(
  card: OpportunityCard,
  assessedFieldIds?: readonly FieldId[],
): OpportunityPdfReportModel {
  const groups = structuredGroups(card).filter((group) => group.records.length || group.note);
  const facts = projectedFacts(card, assessedFieldIds);
  const evidenceByKey = new Map<string, EvidenceSource>();
  const addSources = (sources: readonly EvidenceSource[]) => {
    for (const source of sources) evidenceByKey.set(evidenceKey(source), source);
  };
  for (const group of groups) {
    for (const record of group.records) {
      if (record.definitionClaim) addSources(claimSources(record.definitionClaim));
      for (const entry of record.claims) addSources(claimSources(entry.claim));
    }
  }
  for (const { fact } of facts) {
    addSources(fact.sources);
    for (const candidate of fact.conflictingValues) addSources(candidate.sources);
  }
  const evidence = Array.from(evidenceByKey.values()).map((source, index) => ({
    number: index + 1,
    label: `E${index + 1}`,
    source,
  }));
  return {
    structuredGroups: groups,
    projectedFacts: facts,
    evidence,
    sourceNumbers: sourceNumbers(card),
    evidenceLabelsByKey: new Map(evidence.map((entry) => [evidenceKey(entry.source), entry.label])),
  };
}

function meaningfulFacts(
  card: OpportunityCard,
  fieldIds: readonly FieldId[],
  includeAll = false,
  assessedFieldIds?: readonly FieldId[],
) {
  const assessed = assessedFieldIds ? new Set(assessedFieldIds) : null;
  const entries = fieldIds.filter((fieldId) => !assessed || assessed.has(fieldId)).map((fieldId) => ({
    field: FIELD_DEFINITIONS.find((candidate) => candidate.id === fieldId)!,
    fact: card.facts[fieldId],
  }));
  if (includeAll) return entries;
  const useful = entries.filter(({ fact }) => fact.status === "disclosed" || fact.status === "conflicting");
  return useful.length ? useful : entries.slice(0, 1);
}

function SummaryCompoundFact({
  card,
  label,
  fieldIds,
  includeAll = false,
  numbers,
  assessedFieldIds,
}: {
  card: OpportunityCard;
  label: string;
  fieldIds: readonly FieldId[];
  includeAll?: boolean;
  numbers: ReadonlyMap<string, number>;
  assessedFieldIds?: readonly FieldId[];
}) {
  const facts = meaningfulFacts(card, fieldIds, includeAll, assessedFieldIds);
  if (!facts.length) return null;
  return (
    <View style={styles.glanceItem} wrap={false}>
      <Text style={styles.label}>{label}</Text>
      {facts.map(({ field, fact }) => {
        const refs = sourceRefs(
          fact.status === "conflicting"
            ? fact.conflictingValues.flatMap((candidate) => candidate.sources)
            : fact.sources,
          numbers,
        );
        return (
          <View key={field.id}>
            {facts.length > 1 ? <Text style={styles.status}>{field.label}</Text> : null}
            <Text style={facts.length > 1 ? styles.valueRegular : styles.value}>{factDisplay(fact)}</Text>
            <Text style={styles.status}>
              {statusLabels[fact.status]}{refs ? ` | ${refs}` : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function RunningChrome({ name, label }: { name: string; label: string }) {
  return (
    <>
      <View style={styles.header} fixed>
        <Text>Opportunity Facts</Text>
        <Text>{name} | {label}</Text>
      </View>
      <View style={styles.footer} fixed>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  );
}

function Disclaimer() {
  return (
    <View style={styles.disclaimer} wrap={false}>
      <Text>
        Opportunity Facts reports what identified sources disclose and keeps missing, unclear, and
        conflicting information visible. It does not rank opportunities or assess legitimacy,
        prestige, quality, value, admissions impact, or whether anyone should apply or pay.
      </Text>
    </View>
  );
}

function DocumentHeader({
  card,
  generatedAt,
  reportLabel,
}: {
  card: OpportunityCard;
  generatedAt: string;
  reportLabel: string;
}) {
  const cycle = card.cycle.status === "modeled" ? card.cycle.value.label.displayValue : "Cycle not established";
  const name = card.facts.opportunity_name.displayValue ?? card.slug;
  return (
    <>
      <Text style={styles.kicker}>Opportunity Facts | {reportLabel}</Text>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.summary}>{card.summary}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaPill}>{reviewLabels[card.reviewState]}</Text>
        <Text style={styles.metaPill}>{cycle}</Text>
        <Text style={styles.metaPill}>Generated {formatDate(generatedAt)}</Text>
        <Text style={styles.metaPill}>{reviewDateLabel(card)} {formatDate(card.reviewedAt)}</Text>
      </View>
      <View style={styles.boundary}>
        <Text>
          AI-assisted research organizes public-source evidence. Review state describes the
          source-alignment process, not independent verification of the underlying claims.
          Check the linked official pages before making a decision.
        </Text>
      </View>
    </>
  );
}

function SourceIndex({
  card,
  compact = false,
  includedUrls,
}: {
  card: OpportunityCard;
  compact?: boolean;
  includedUrls?: ReadonlySet<string>;
}) {
  const sources = includedUrls
    ? card.sourcePagesChecked.filter((source) => includedUrls.has(source.url))
    : card.sourcePagesChecked;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={65}>Source index</Text>
      <Text style={styles.sectionLead}>References in this report use the source numbers below.</Text>
      {sources.map((source) => {
        const index = card.sourcePagesChecked.findIndex((candidate) => candidate.url === source.url);
        return (
        <View key={source.id} style={styles.sourceItem} wrap={false}>
          <Link src={source.url} style={styles.sourceLink}>
            S{index + 1} | {source.title}
          </Link>
          <Text style={styles.sourceMeta}>
            {humanLabel(source.pageType)} | accessed {formatDate(source.accessedAt)}
            {compact ? "" : ` | ${breakableUrl(source.url)}`}
          </Text>
        </View>
        );
      })}
    </View>
  );
}

function SummaryDocument({
  card,
  attentionItems,
  generatedAt,
  assessedFieldIds,
}: {
  card: OpportunityCard;
  attentionItems: readonly PdfAttentionItem[];
  generatedAt: string;
  assessedFieldIds?: readonly FieldId[];
}) {
  const name = card.facts.opportunity_name.displayValue ?? card.slug;
  const numbers = sourceNumbers(card);
  const stages = card.stages.status === "modeled" ? card.stages.records.slice(0, 8) : [];
  const costs = card.costItems.status === "modeled" ? card.costItems.records.slice(0, 6) : [];
  const outcomes = card.outcomes.status === "modeled" ? card.outcomes.records.slice(0, 6) : [];
  const labels = buildEntityLabels(card);
  return (
    <Document title={`${name} - Opportunity Facts summary`} author="Opportunity Facts">
      <Page size="LETTER" style={styles.page} wrap>
        <RunningChrome name={name} label="Student summary" />
        <DocumentHeader card={card} generatedAt={generatedAt} reportLabel="Student summary" />

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <View style={styles.glanceGrid}>
            {atAGlance.map((item) => (
              <SummaryCompoundFact
                key={item.label}
                card={card}
                label={item.label}
                fieldIds={item.fieldIds}
                includeAll={item.includeAll}
                numbers={numbers}
                assessedFieldIds={assessedFieldIds}
              />
            ))}
          </View>
        </View>

        {attentionItems.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} minPresenceAhead={65}>Needs attention</Text>
            {attentionItems.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.attentionItem} wrap={false}>
                <Text style={styles.label}>{humanLabel(item.category)} | {item.priority}</Text>
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
            <Text style={styles.sectionTitle}>Major timeline and selection</Text>
            {stages.map((stage) => {
              const refs = sourceRefs([
                ...claimSources(stage.definition),
                ...stage.timings.flatMap(claimSources),
              ], numbers);
              return (
                <View key={stage.id} style={styles.compactRow} wrap={false}>
                  <Text style={styles.factLabel}>{stage.definition.displayValue}</Text>
                  {stage.timings.map((timing) => (
                    <Text key={timing.claimId} style={styles.paragraph}>{timing.displayValue}</Text>
                  ))}
                  {refs ? <Text style={styles.refs}>{refs}</Text> : null}
                </View>
              );
            })}
            {card.stages.status === "modeled" && card.stages.records.length > stages.length ? (
              <Text style={styles.sectionLead}>
                {card.stages.records.length - stages.length} additional stage(s) remain in the Full Evidence report.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Costs, aid, and outcomes</Text>
          {summaryCostFields.filter((fieldId) => !assessedFieldIds || assessedFieldIds.includes(fieldId)).map((fieldId) => {
            const field = FIELD_DEFINITIONS.find((candidate) => candidate.id === fieldId)!;
            const fact = card.facts[fieldId];
            const refs = sourceRefs(fact.sources, numbers);
            return (
              <View key={fieldId} style={styles.compactRow} wrap={false}>
                <Text style={styles.label}>{field.label}</Text>
                <Text style={styles.value}>{factDisplay(fact)}</Text>
                <Text style={styles.status}>{statusLabels[fact.status]}{refs ? ` | ${refs}` : ""}</Text>
              </View>
            );
          })}
          {costs.map((cost) => {
            const refs = sourceRefs([
              ...claimSources(cost.definition),
              ...claimSources(cost.amount),
              ...(cost.chargeBasis ? claimSources(cost.chargeBasis) : []),
            ], numbers);
            const scope = formatScope(cost.definition.value, labels);
            return (
              <View key={cost.id} style={styles.compactRow} wrap={false}>
                <Text style={styles.label}>{humanLabel(cost.definition.value.kind)} | {humanLabel(cost.definition.value.requirement)}</Text>
                <Text style={styles.value}>{cost.definition.displayValue}</Text>
                <Text style={styles.paragraph}>{cost.amount.displayValue ?? cost.amount.note}</Text>
                {scope ? <Text style={styles.paragraph}>Applies to: {scope}</Text> : null}
                {refs ? <Text style={styles.refs}>{refs}</Text> : null}
              </View>
            );
          })}
          {outcomes.map((outcome) => {
            const refs = sourceRefs([
              ...claimSources(outcome.definition),
              ...(outcome.amount ? claimSources(outcome.amount) : []),
            ], numbers);
            return (
              <View key={outcome.id} style={styles.compactRow} wrap={false}>
                <Text style={styles.label}>Outcome</Text>
                <Text style={styles.value}>{outcome.definition.displayValue}</Text>
                {outcome.amount?.displayValue ? <Text style={styles.paragraph}>{outcome.amount.displayValue}</Text> : null}
                {refs ? <Text style={styles.refs}>{refs}</Text> : null}
              </View>
            );
          })}
        </View>

        <SourceIndex card={card} compact includedUrls={getSummarySourceUrls(card)} />
      </Page>
    </Document>
  );
}

function FullProjectedSections({
  sections,
  report,
}: {
  sections: readonly OpportunitySection[];
  report: OpportunityPdfReportModel;
}) {
  return <>{sections.flatMap((section) => {
    const rows = report.projectedFacts.filter(({ fieldId }) =>
      FIELD_DEFINITIONS.find((field) => field.id === fieldId)?.section === section,
    );
    if (!rows.length) return [];
    return [
      <View key={`${section}-header`} style={styles.group} wrap={false}>
        <Text style={styles.groupTitle}>{sectionLabels[section]}</Text>
      </View>,
      ...rows.map(({ fieldId, label, fact }) => {
        const sources = fact.status === "conflicting"
          ? fact.conflictingValues.flatMap((candidate) => candidate.sources)
          : fact.sources;
        const refs = evidenceRefs(sources, report.evidenceLabelsByKey);
        return (
          <View key={fieldId} style={styles.factRow} wrap={false}>
            <View style={styles.factTop}>
              <Text style={styles.factLabel}>{label}</Text>
              <Text style={styles.factStatus}>{statusLabels[fact.status]}</Text>
            </View>
            <Text style={styles.valueRegular}>{factDisplay(fact)}</Text>
            {fact.note && fact.status !== "unclear" ? <Text style={styles.paragraph}>{fact.note}</Text> : null}
            {fact.status === "conflicting" ? fact.conflictingValues.map((candidate, index) => (
              <Text key={`${fieldId}-${index}`} style={styles.paragraph}>
                Supported value {index + 1}: {candidate.displayValue}
              </Text>
            )) : null}
            {refs ? <Text style={styles.refs}>Evidence {refs}</Text> : null}
          </View>
        );
      }),
    ];
  })}</>;
}

function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function paginateEvidence(entries: readonly EvidenceRegisterEntry[]): EvidenceRegisterEntry[][] {
  if (entries.length <= 14) return entries.length ? [entries.slice()] : [];
  return [entries.slice(0, 14), ...chunkItems(entries.slice(14), 15)];
}

function structuredRecordWeight(record: StructuredRecord): number {
  const textLength = record.title.length + record.context.length
    + record.claims.reduce((total, entry) => total + entry.label.length
      + (entry.claim.displayValue?.length ?? 0)
      + (entry.claim.note?.length ?? 0), 0);
  return 2 + record.claims.length * 1.25 + Math.ceil(textLength / 180);
}

function paginateStructuredGroups(groups: readonly StructuredGroup[]): StructuredGroup[][] {
  const pages: StructuredGroup[][] = [];
  let page: StructuredGroup[] = [];
  let pageWeight = 0;
  // React PDF can create silent continuation pages when a structured section is
  // allowed to grow too large. Keep a conservative deterministic page budget so
  // each page retains its own section context and running chrome.
  const maximumWeight = 36;

  const finishPage = () => {
    if (page.length) pages.push(page);
    page = [];
    pageWeight = 0;
  };

  for (const group of groups) {
    const headerWeight = 2 + Math.ceil((group.note?.length ?? 0) / 180);
    if (!group.records.length) {
      if (page.length && pageWeight + headerWeight > maximumWeight) finishPage();
      page.push({ ...group, records: [] });
      pageWeight += headerWeight;
      continue;
    }

    let segment: StructuredGroup | null = null;
    let continued = false;
    for (const record of group.records) {
      const recordWeight = structuredRecordWeight(record);
      const additionalWeight = (segment ? 0 : headerWeight) + recordWeight;
      if (page.length && pageWeight + additionalWeight > maximumWeight) {
        finishPage();
        segment = null;
        continued = true;
      }
      if (!segment) {
        segment = {
          ...group,
          label: continued ? `${group.label} continued` : group.label,
          records: [],
        };
        page.push(segment);
        pageWeight += headerWeight;
      }
      segment.records.push(record);
      pageWeight += recordWeight;
    }
  }
  finishPage();
  return pages;
}

function FullDocument({
  card,
  attentionItems,
  generatedAt,
  assessedFieldIds,
}: {
  card: OpportunityCard;
  attentionItems: readonly PdfAttentionItem[];
  generatedAt: string;
  assessedFieldIds?: readonly FieldId[];
}) {
  const name = card.facts.opportunity_name.displayValue ?? card.slug;
  const report = createOpportunityPdfReportModel(card, assessedFieldIds);
  const labels = buildEntityLabels(card);
  return (
    <Document title={`${name} - Opportunity Facts full evidence report`} author="Opportunity Facts">
      <Page size="LETTER" style={styles.page} wrap>
        <RunningChrome name={name} label="Full Evidence report" />
        <DocumentHeader card={card} generatedAt={generatedAt} reportLabel="Full Evidence report" />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>At a glance</Text>
          <View style={styles.glanceGrid}>
            {atAGlance.slice(0, 8).map((item) => (
              <SummaryCompoundFact
                key={item.label}
                card={card}
                label={item.label}
                fieldIds={item.fieldIds}
                includeAll={item.includeAll}
                numbers={report.sourceNumbers}
                assessedFieldIds={assessedFieldIds}
              />
            ))}
          </View>
        </View>

      </Page>

      <Page size="LETTER" style={styles.page} wrap>
        <RunningChrome name={name} label="Practical facts" />

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Standardized practical facts</Text>
          <Text style={styles.sectionLead}>
            Blank and not-applicable fields are omitted. Important unresolved core facts remain visible.
          </Text>
        </View>
        <FullProjectedSections sections={SECTIONS.slice(0, 2)} report={report} />

      </Page>

      <Page size="LETTER" style={styles.page} wrap>
        <RunningChrome name={name} label="Practical facts continued" />
        <FullProjectedSections sections={SECTIONS.slice(2, 3)} report={report} />

      </Page>

      <Page size="LETTER" style={styles.page} wrap>
        <RunningChrome name={name} label="Practical facts continued" />
        <FullProjectedSections sections={SECTIONS.slice(3, 6)} report={report} />

      </Page>

      <Page size="LETTER" style={styles.page} wrap>
        <RunningChrome name={name} label="Terms and privacy" />
        <FullProjectedSections sections={SECTIONS.slice(6)} report={report} />

      </Page>

      {paginateStructuredGroups(report.structuredGroups).map((groups, pageIndex) => (
        <Page key={`structured-${pageIndex}`} size="LETTER" style={styles.page} wrap>
          <RunningChrome name={name} label={pageIndex === 0 ? "Structured details" : "Structured details continued"} />

          {pageIndex === 0 ? (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Structured details</Text>
              <Text style={styles.sectionLead}>
                Material distinctions are retained without repeating projection metadata or evidence excerpts.
              </Text>
            </View>
          ) : null}
          {groups.flatMap((group) => [
            <View key={`${group.label}-header`} style={styles.group} wrap={false}>
              <Text style={styles.groupTitle}>{group.label}</Text>
              <Text style={styles.recordContext}>
                {humanLabel(group.status)}
                {group.completeness ? ` | ${humanLabel(group.completeness)} inventory` : ""}
                {group.note ? ` | ${group.note}` : ""}
              </Text>
            </View>,
            ...group.records.map((record) => {
                const definitionRefs = record.definitionClaim
                  ? evidenceRefs(claimSources(record.definitionClaim), report.evidenceLabelsByKey)
                  : "";
                return (
                  <View key={record.id} style={styles.record} wrap={false}>
                    <Text style={styles.recordTitle}>
                      {record.title}{definitionRefs ? ` [${definitionRefs}]` : ""}
                    </Text>
                    {record.context ? <Text style={styles.recordContext}>{record.context}</Text> : null}
                    {record.claims.map((entry) => {
                      const claim = entry.claim;
                      const value = claim.displayValue ?? claim.note ?? humanLabel(claim.status);
                      const refs = evidenceRefs(claimSources(claim), report.evidenceLabelsByKey);
                      const scope = formatScope(claim.value, labels);
                      return (
                        <View key={claim.claimId} wrap={false}>
                          <Text style={styles.claimLine}>
                            <Text style={styles.claimLabel}>{entry.label}: </Text>
                            {value}{refs ? ` [${refs}]` : ""}
                          </Text>
                          {scope ? <Text style={styles.recordContext}>Applies to: {scope}</Text> : null}
                          {claim.status === "conflicting" ? claim.conflictingValues.map((candidate, index) => (
                            <Text key={`${claim.claimId}-${index}`} style={styles.recordContext}>
                              Supported value {index + 1}: {candidate.displayValue}
                            </Text>
                          )) : null}
                        </View>
                      );
                    })}
                  </View>
                );
              }),
          ])}
        </Page>
      ))}

      {paginateEvidence(report.evidence).map((entries, pageIndex) => (
        <Page key={`evidence-${pageIndex}`} size="LETTER" style={styles.page} wrap>
          <RunningChrome name={name} label={pageIndex === 0 ? "Evidence register" : "Evidence register continued"} />

          {pageIndex === 0 ? (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Evidence register</Text>
              <Text style={styles.sectionLead}>
                Each exact excerpt appears once. Facts and structured claims above cite these evidence IDs.
              </Text>
            </View>
          ) : null}
          {entries.map((entry) => {
            const sourceNumber = report.sourceNumbers.get(entry.source.url);
            return (
              <View key={entry.label} style={styles.evidenceItem} wrap={false}>
                <Text style={styles.evidenceTitle}>
                  {entry.label}{sourceNumber ? ` | S${sourceNumber}` : ""} | evidence ID {entry.source.id}
                </Text>
                <Text style={styles.excerpt}>&quot;{entry.source.excerpt}&quot;</Text>
                <Link src={entry.source.url} style={styles.sourceLink}>{entry.source.title}</Link>
              </View>
            );
          })}
        </Page>
      ))}

      <Page size="LETTER" style={styles.page} wrap>
        <RunningChrome name={name} label="Sources and record boundary" />

        {attentionItems.length ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Needs attention</Text>
            {attentionItems.slice(0, 5).map((item) => (
              <View key={item.id} style={styles.factRow} wrap={false}>
                <Text style={styles.label}>{humanLabel(item.category)} | {item.priority}</Text>
                <Text style={styles.attentionTitle}>{item.title}</Text>
                <Text style={styles.paragraph}>{item.explanation}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <SourceIndex card={card} />
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Record metadata</Text>
          <Text style={styles.paragraph}>
            Review state: {reviewLabels[card.reviewState]} | Card revision: {card.cardVersion} | Schema: {card.schemaVersion}
          </Text>
          <Text style={styles.paragraph}>
            Generated: {formatDate(generatedAt)} | {reviewDateLabel(card)}: {formatDate(card.reviewedAt)}
          </Text>
        </View>
        <Disclaimer />
      </Page>
    </Document>
  );
}

export function OpportunityPdfDocument({
  card,
  mode,
  attentionItems = [],
  fontBaseUrl = "/fonts",
  generatedAt = new Date().toISOString(),
  assessedFieldIds,
}: {
  card: OpportunityCard;
  mode: OpportunityPdfMode;
  attentionItems?: readonly PdfAttentionItem[];
  fontBaseUrl?: string;
  generatedAt?: string;
  assessedFieldIds?: readonly FieldId[];
}) {
  Font.register({
    family: "Source Sans 3",
    fonts: [
      { src: `${fontBaseUrl}/SourceSans3-Regular.ttf`, fontWeight: 400 },
      { src: `${fontBaseUrl}/SourceSans3-Bold.ttf`, fontWeight: 700 },
    ],
  });
  return mode === "summary" ? (
    <SummaryDocument
      card={card}
      attentionItems={attentionItems}
      generatedAt={generatedAt}
      assessedFieldIds={assessedFieldIds}
    />
  ) : (
    <FullDocument
      card={card}
      attentionItems={attentionItems}
      generatedAt={generatedAt}
      assessedFieldIds={assessedFieldIds}
    />
  );
}
