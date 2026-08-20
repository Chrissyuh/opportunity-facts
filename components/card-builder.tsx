"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  EVIDENCE_STATUSES,
  FIELD_DEFINITIONS,
  FIELD_IDS,
  PAGE_TYPES,
  SECTIONS,
  type EvidenceStatus,
  type FieldId,
  type OpportunitySection,
  type ReviewState,
} from "@/lib/opportunity/fields";
import {
  createEmptyCard,
  createEmptyFact,
  evidenceSourceSchema,
  factSchema,
  LEGACY_V2_SCHEMA_VERSION,
  opportunityCardSchema,
  SCHEMA_VERSION,
  sourcePageSchema,
  type EvidenceSource,
  type Fact,
  type OpportunityCard,
  type SourcePage,
} from "@/lib/opportunity/schema";
import {
  OpportunityCardImportError,
  importOpportunityCardJson,
  parseOpportunityCard,
} from "@/lib/opportunity/serialization";
import {
  applyOpportunityProjections,
} from "@/lib/opportunity/projection";
import {
  BUILDER_STORAGE_EVENT,
  BUILDER_STORAGE_KEY,
  BUILDER_TOUCHED_STORAGE_KEY,
  writeBuilderDraftStorage,
} from "@/lib/opportunity/browser-storage";
import { FactsCard } from "./facts-card";
import { StructuredBuilder } from "./structured-builder";

const initialCard = createEmptyCard({ slug: "untitled-opportunity" });
const initialSerialized = JSON.stringify(initialCard);
const MAX_IMPORT_BYTES = 1_000_000;
const sectionLabels: Record<OpportunitySection, string> = {
  identity: "Identity",
  eligibility: "Eligibility",
  commitment: "Commitment",
  money: "Money",
  selection: "Selection",
  outcomes: "Outcomes",
  terms: "Terms",
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(BUILDER_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(BUILDER_STORAGE_EVENT, callback);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(BUILDER_STORAGE_KEY) ?? initialSerialized;
  } catch {
    return initialSerialized;
  }
}

function getServerSnapshot() {
  return initialSerialized;
}

function parseStoredCard(value: string) {
  try {
    return parseOpportunityCard(JSON.parse(value) as unknown);
  } catch {
    return initialCard;
  }
}

function getTouchedSnapshot() {
  try {
    const stored = localStorage.getItem(BUILDER_TOUCHED_STORAGE_KEY);
    if (stored !== null) return stored;
    const storedCard = localStorage.getItem(BUILDER_STORAGE_KEY);
    if (storedCard === null) return "[]";
    try {
      return JSON.stringify(inferredAssessedFields(parseOpportunityCard(JSON.parse(storedCard) as unknown)));
    } catch {
      return "[]";
    }
  } catch {
    return "[]";
  }
}

function inferredAssessedFields(card: OpportunityCard): FieldId[] {
  if (
    card.reviewState !== "draft" ||
    (card.migratedFrom !== null && card.migratedFrom.reviewedAt !== null)
  ) return FIELD_IDS;
  return FIELD_IDS.filter((fieldId) => card.facts[fieldId].status !== "not_found");
}

function getTouchedServerSnapshot() {
  return "[]";
}

function parseTouched(value: string): FieldId[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return FIELD_IDS.filter((fieldId) => parsed.includes(fieldId));
  } catch {
    return [];
  }
}

function writeCard(card: OpportunityCard, touched: readonly FieldId[]) {
  if (
    writeBuilderDraftStorage(
      localStorage,
      JSON.stringify(card),
      JSON.stringify(touched),
    )
  ) {
    window.dispatchEvent(new Event(BUILDER_STORAGE_EVENT));
    return true;
  }
  return false;
}

function downloadCard(card: OpportunityCard) {
  const blob = new Blob([`${JSON.stringify(card, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${card.slug}.opportunity-facts.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sourcePageFromEvidence(source: EvidenceSource) {
  return {
    id: source.id,
    url: source.url,
    title: source.title,
    pageType: source.pageType,
    accessedAt: source.accessedAt,
  };
}

function sourceOptionLabel(page: SourcePage): string {
  const url = new URL(page.url);
  return `${page.title} — ${url.hostname}${url.pathname}`;
}

function invalidateReview(card: OpportunityCard): OpportunityCard {
  return opportunityCardSchema.parse({
    ...card,
    cardVersion: card.reviewState === "draft" ? card.cardVersion : card.cardVersion + 1,
    reviewState: "draft",
    reviewedAt: null,
  });
}

function structuredAssessmentComplete(card: OpportunityCard): boolean {
  return card.cycle.status === "modeled" && [
    card.organizations,
    card.organizationRoles,
    card.institutionRelationships,
    card.variants,
    card.stages,
    card.pathways,
    card.costItems,
    card.outcomes,
  ].every((collection) => collection.status !== "unassessed");
}

function replaceFact(card: OpportunityCard, fieldId: FieldId, fact: Fact) {
  if (card.facts[fieldId].projection !== null) {
    throw new Error("Structured summary facts are read-only projections in schema v2.");
  }
  const draft = invalidateReview(card);
  const facts = { ...card.facts, [fieldId]: fact };
  const sources = Object.values(facts).flatMap((item) => [
    ...item.sources,
    ...item.conflictingValues.flatMap((candidate) => candidate.sources),
  ]);
  const pages = new Map(card.sourcePagesChecked.map((page) => [page.id, page]));
  for (const source of sources) pages.set(source.id, sourcePageFromEvidence(source));
  const conflicts = card.conflicts.filter((conflict) => conflict.fieldId !== fieldId);
  if (fact.status === "conflicting") {
    conflicts.push({ fieldId, summary: fact.note ?? "Reviewed sources support different values." });
  }
  return opportunityCardSchema.parse({
    ...draft,
    facts,
    sourcePagesChecked: Array.from(pages.values()),
    conflicts,
  });
}

interface EvidenceDraft {
  value: string;
  sourceId: string;
  excerpt: string;
}

function draftFromFact(fact: Fact, candidateIndex?: number): EvidenceDraft {
  const candidate = candidateIndex === undefined ? undefined : fact.conflictingValues[candidateIndex];
  const source = candidate?.sources[0] ?? fact.sources[0];
  return {
    value: candidate?.displayValue ?? fact.displayValue ?? "",
    sourceId: source?.id ?? "",
    excerpt: source?.excerpt ?? "",
  };
}

function parseEvidence(draft: EvidenceDraft, sourcePages: readonly SourcePage[]) {
  const source = sourcePages.find((page) => page.id === draft.sourceId);
  return evidenceSourceSchema.safeParse({
    ...source,
    excerpt: draft.excerpt.trim(),
  });
}

export function CardBuilder() {
  const serialized = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const touchedSerialized = useSyncExternalStore(
    subscribe,
    getTouchedSnapshot,
    getTouchedServerSnapshot,
  );
  const card = parseStoredCard(serialized);
  const touched = parseTouched(touchedSerialized);
  const unassessedFields = new Set(FIELD_IDS.filter((fieldId) => !touched.includes(fieldId)));
  const unassessedNotFoundFields = FIELD_IDS.filter(
    (fieldId) =>
      card.facts[fieldId].projection === null &&
      unassessedFields.has(fieldId) &&
      card.facts[fieldId].status === "not_found",
  );
  const hasUngroundedNotFound =
    card.sourcePagesChecked.length === 0 &&
    FIELD_IDS.some((fieldId) => touched.includes(fieldId) && card.facts[fieldId].status === "not_found");
  const canExport =
    touched.length === FIELD_IDS.length &&
    !hasUngroundedNotFound &&
    structuredAssessmentComplete(card);
  const [message, setMessage] = useState("Draft autosaves on this device after each valid change.");
  const [metadataError, setMetadataError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function updateMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reviewState = String(data.get("reviewState") ?? "draft") as ReviewState;
    if (reviewState !== "draft" && !canExport) {
      setMetadataError(
        "Human-reviewed and organizer-confirmed cards require every field to be explicitly assessed against the checked source inventory.",
      );
      return;
    }
    const slug = String(data.get("slug") ?? "").trim().toLowerCase();
    const opportunityId = String(data.get("opportunityId") ?? "").trim().toLowerCase() || null;
    const summary = String(data.get("summary") ?? "").trim();
    const createsRevision =
      card.reviewState !== "draft" &&
      (slug !== card.slug ||
        opportunityId !== card.opportunityId ||
        summary !== card.summary ||
        reviewState !== card.reviewState ||
        reviewState === "human_reviewed" ||
        reviewState === "organizer_confirmed");
    const result = opportunityCardSchema.safeParse({
      ...card,
      slug,
      opportunityId,
      summary,
      cardVersion: createsRevision ? card.cardVersion + 1 : card.cardVersion,
      reviewState,
      reviewedAt:
        reviewState === "human_reviewed" || reviewState === "organizer_confirmed"
          ? new Date().toISOString()
          : null,
    });
    if (!result.success) {
      setMetadataError(result.error.issues[0]?.message ?? "Metadata is not valid.");
      return;
    }
    if (!writeCard(result.data, touched)) {
      setMetadataError("This browser could not save the draft. Export JSON to preserve your work.");
      return;
    }
    setMetadataError("");
    setMessage("Card metadata saved locally.");
  }

  function applyFact(fieldId: FieldId, fact: Fact) {
    if (card.sourcePagesChecked.length === 0) {
      setMessage("Record at least one checked source page before assessing any fact.");
      return false;
    }
    try {
      const persistedCard = parseStoredCard(getSnapshot());
      const baseCard =
        persistedCard.slug === card.slug && persistedCard.cardVersion >= card.cardVersion
          ? persistedCard
          : card;
      const nextTouched = [...new Set([...touched, fieldId])];
      if (!writeCard(replaceFact(baseCard, fieldId, fact), nextTouched)) {
        setMessage("The browser could not autosave this fact. Export JSON to preserve the current card.");
        return false;
      }
      setMessage(`${FIELD_DEFINITIONS.find((field) => field.id === fieldId)?.label ?? fieldId} updated and saved locally.`);
      return true;
    } catch {
      setMessage("That fact could not be applied because it would make the card invalid.");
      return false;
    }
  }

  function applyStructuredCard(nextCard: OpportunityCard, successMessage: string) {
    try {
      // Structured edits necessarily make the materialized summary stale. Recompute
      // before schema validation; validating first would reject the intended edit as
      // projection drift.
      const draftRevision = {
        ...nextCard,
        cardVersion:
          nextCard.reviewState === "draft" ? nextCard.cardVersion : nextCard.cardVersion + 1,
        reviewState: "draft" as const,
        reviewedAt: null,
      } as OpportunityCard;
      const projected = applyOpportunityProjections(draftRevision);
      const result = opportunityCardSchema.safeParse(projected);
      if (!result.success) {
        setMessage(
          `Structured change rejected: ${result.error.issues[0]?.message ?? "invalid structured record"}`,
        );
        return false;
      }
      const projectedFields = Object.keys(result.data.projectionRefs) as FieldId[];
      const nextTouched = [...new Set([...touched, ...projectedFields])];
      if (!writeCard(result.data, nextTouched)) {
        setMessage("The browser could not autosave this structured change.");
        return false;
      }
      setMessage(successMessage);
      return true;
    } catch {
      setMessage("That structured change could not be applied without breaking a source or scope reference.");
      return false;
    }
  }

  async function importCard(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage("Import rejected: card JSON must be 1 MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      const json = await file.text();
      const input = JSON.parse(json) as { schemaVersion?: unknown; reviewState?: unknown };
      const wasV1 = input.schemaVersion === "1.0.0";
      const wasV2 =
        input.schemaVersion === LEGACY_V2_SCHEMA_VERSION ||
        input.schemaVersion === SCHEMA_VERSION;
      const wasAttestedV2 =
        wasV2 &&
        (input.reviewState === "human_reviewed" || input.reviewState === "organizer_confirmed");
      const wasDemoV2 = wasV2 && input.reviewState === "demo";
      const imported = importOpportunityCardJson(json);
      const importedAssessment = wasAttestedV2 ? FIELD_IDS : inferredAssessedFields(imported);
      setMessage(
        writeCard(imported, importedAssessment)
          ? wasV1
            ? `Schema v1 card migrated to draft schema v2 revision ${imported.cardVersion} and saved locally. Structured sections require review before publication.`
            : wasAttestedV2
              ? `Attested card imported as draft revision ${imported.cardVersion} and saved locally. Review status does not transfer through a local file.`
              : wasDemoV2
                ? "Demo card imported and retained its Demo data label."
                : "Valid schema v2 card imported and saved locally."
          : "The card is valid, but this browser could not save it.",
      );
    } catch (error) {
      setMessage(
        error instanceof OpportunityCardImportError
          ? `Import rejected: ${error.message}`
          : "Import rejected: the selected file is not valid JSON.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function reset() {
    if (!window.confirm("Clear this local draft and start a new blank card? This cannot be undone.")) return;
    setMessage(
      writeCard(initialCard, [])
        ? "Local builder draft cleared."
        : "The browser could not clear local storage.",
    );
    setMetadataError("");
  }

  function addCheckedPage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = sourcePageSchema.safeParse({
      id: `builder-${crypto.randomUUID()}`,
      url: String(data.get("url") ?? "").trim(),
      title: String(data.get("title") ?? "").trim(),
      pageType: String(data.get("pageType") ?? "user_supplied"),
      accessedAt: new Date().toISOString(),
    });
    if (!result.success) {
      setMessage(`Checked page not added: ${result.error.issues[0]?.message ?? "invalid page"}`);
      return;
    }
    const next = opportunityCardSchema.safeParse({
      ...invalidateReview(card),
      sourcePagesChecked: [...card.sourcePagesChecked, result.data],
    });
    if (!next.success || !writeCard(next.data, [])) {
      setMessage("The checked page could not be added to this local draft.");
      return;
    }
    event.currentTarget.reset();
    setMessage("Checked source page added. This records review scope; facts still need explicit statuses.");
  }

  function removeCheckedPage(sourceId: string) {
    const referenced = Object.values(card.facts).some(
      (fact) =>
        fact.sources.some((source) => source.id === sourceId) ||
        fact.conflictingValues.some((candidate) =>
          candidate.sources.some((source) => source.id === sourceId),
        ),
    );
    if (referenced) {
      setMessage("That page supports a fact and cannot be removed until its evidence is changed.");
      return;
    }
    const next = opportunityCardSchema.safeParse({
      ...invalidateReview(card),
      sourcePagesChecked: card.sourcePagesChecked.filter((page) => page.id !== sourceId),
    });
    if (!next.success || !writeCard(next.data, [])) {
      setMessage("The checked page could not be removed.");
      return;
    }
    setMessage("Checked source page removed. Reassess every field for the changed source scope.");
  }

  function markRemainingNotFound() {
    if (card.sourcePagesChecked.length === 0) {
      setMessage("Add at least one checked source page before marking remaining fields not found.");
      return;
    }
    if (!window.confirm("Mark every unassessed field as not found after reviewing the listed source pages?")) return;
    const nextTouched = FIELD_IDS.filter(
      (fieldId) =>
        touched.includes(fieldId) ||
        (card.facts[fieldId].projection === null && card.facts[fieldId].status === "not_found"),
    );
    if (writeCard(invalidateReview(card), nextTouched)) {
      setMessage("All currently not-found fields are now assessed for the listed review scope; other changed fields still require individual review.");
    } else {
      setMessage("The browser could not save the completed field assessment.");
    }
  }

  function reaffirmStructuredReview() {
    if (!structuredAssessmentComplete(card)) {
      setMessage("Assess the cycle and every structured section before reaffirming the structured review.");
      return;
    }
    if (card.sourcePagesChecked.length === 0) {
      setMessage("Record the checked source inventory before reaffirming structured claims.");
      return;
    }
    if (!window.confirm("Confirm that every structured record and excerpt was rechecked against the current source inventory?")) return;
    const projectedFields = Object.keys(card.projectionRefs) as FieldId[];
    if (writeCard(invalidateReview(card), [...new Set([...touched, ...projectedFields])])) {
      setMessage("Structured projections reaffirmed for the current source inventory. Unprojected summary fields still require individual review.");
    } else {
      setMessage("The browser could not save the structured-review attestation.");
    }
  }

  return (
    <div className="builder-layout">
      <div className="builder-form-column">
        <section className="builder-controls panel panel-pad stack" aria-labelledby="builder-controls-title">
          <div>
            <p className="eyebrow">Local draft controls</p>
            <h2 id="builder-controls-title">Card record</h2>
          </div>
          <form
            className="stack"
            key={`${card.opportunityId ?? ""}|${card.slug}|${card.summary}|${card.reviewState}`}
            onSubmit={updateMetadata}
          >
            {metadataError ? (
              <div className="error-summary" role="alert"><strong>Metadata not saved.</strong> {metadataError}</div>
            ) : null}
            <div className="field-grid">
              <div className="field">
                <label htmlFor="builder-slug">Slug</label>
                <input id="builder-slug" name="slug" defaultValue={card.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
                <p className="field-help">Lowercase letters, numbers, and hyphens.</p>
              </div>
              <div className="field">
                <label htmlFor="builder-opportunity-id">Opportunity identity</label>
                <input
                  id="builder-opportunity-id"
                  name="opportunityId"
                  defaultValue={card.opportunityId ?? ""}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="cycle-independent-id"
                />
                <p className="field-help">Stable across cycles; blank is allowed only for drafts.</p>
              </div>
              <div className="field">
                <label htmlFor="builder-review-state">Review state</label>
                <select id="builder-review-state" name="reviewState" defaultValue={card.reviewState === "demo" ? "draft" : card.reviewState}>
                  <option value="draft">Draft</option>
                  <option value="human_reviewed">Human reviewed</option>
                  <option value="organizer_confirmed">Organizer confirmed</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="builder-summary">Short neutral summary</label>
              <textarea id="builder-summary" name="summary" defaultValue={card.summary} required />
            </div>
            <div className="notice">
              <strong>Review-state warning.</strong> Do not select human reviewed unless a person actually checked every displayed value and excerpt against its cited source. Organizer confirmation is not independent verification.
            </div>
            <button className="button-secondary" type="submit">Save card metadata</button>
          </form>
          <div className="divider" />
          <section className="stack" aria-labelledby="checked-pages-title">
            <div>
              <h3 id="checked-pages-title">Checked source pages</h3>
              <p className="field-help">Record every page reviewed, including pages that supplied no excerpt.</p>
            </div>
            {card.sourcePagesChecked.length ? (
              <ul className="builder-source-list">
                {card.sourcePagesChecked.map((page) => (
                  <li key={page.id}>
                    <span><strong>{page.title}</strong><small>{page.url}</small></span>
                    <button className="button-quiet" type="button" onClick={() => removeCheckedPage(page.id)}>Remove</button>
                  </li>
                ))}
              </ul>
            ) : <p>No pages recorded yet.</p>}
            <form className="stack" onSubmit={addCheckedPage}>
              <div className="field-grid">
                <div className="field"><label htmlFor="builder-source-url">Page URL</label><input id="builder-source-url" name="url" type="url" required /></div>
                <div className="field"><label htmlFor="builder-source-title">Page title</label><input id="builder-source-title" name="title" required /></div>
              </div>
              <div className="field">
                <label htmlFor="builder-source-type">Page type</label>
                <select id="builder-source-type" name="pageType" defaultValue="user_supplied">
                  {PAGE_TYPES.map((pageType) => <option key={pageType} value={pageType}>{pageType.replaceAll("_", " ")}</option>)}
                </select>
              </div>
              <button className="button-secondary" type="submit">Add checked page</button>
            </form>
            <button className="button-quiet" type="button" onClick={markRemainingNotFound} disabled={card.sourcePagesChecked.length === 0 || unassessedNotFoundFields.length === 0}>
              Mark remaining fields not found after review
            </button>
            <button className="button-quiet" type="button" onClick={reaffirmStructuredReview} disabled={card.sourcePagesChecked.length === 0 || !structuredAssessmentComplete(card)}>
              Reaffirm structured records for this source scope
            </button>
          </section>
          <div className="divider" />
          <div className="button-row">
            <button className="button" type="button" disabled={!canExport} onClick={() => downloadCard(card)}>Export JSON</button>
            <input
              className="sr-only"
              ref={fileRef}
              id="builder-import"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCard(file);
              }}
            />
            <label className="button-secondary" htmlFor="builder-import">Import JSON</label>
            <button className="button-danger" type="button" onClick={reset}>Reset draft</button>
          </div>
          {!canExport ? (
            <p className="field-help">Export unlocks after every field is assessed. A not-found assessment also requires at least one checked source page.</p>
          ) : null}
          <p className="action-message" role="status" aria-live="polite">{message}</p>
        </section>

        <StructuredBuilder card={card} onCommit={applyStructuredCard} />

        <div className="builder-sections">
          {SECTIONS.map((section, sectionIndex) => (
            <details key={section} open={sectionIndex === 0}>
              <summary>
                <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
                <strong>{sectionLabels[section]}</strong>
                <small>{FIELD_DEFINITIONS.filter((field) => field.section === section).length} facts</small>
              </summary>
              <div className="builder-section-fields">
                {FIELD_DEFINITIONS.filter((field) => field.section === section).map((field) => {
                  const projection = card.facts[field.id].projection;

                  return projection !== null ? (
                    <div className="fact-editor projected-fact-editor" key={field.id}>
                      <div className="fact-editor-heading">
                        <div>
                          <h3>{field.label} {field.core ? <span>Core fact</span> : null}</h3>
                          <p>{field.description}</p>
                        </div>
                        <span className="tag">V2 projection</span>
                      </div>
                      <div className="notice">
                        <strong>Read-only summary.</strong>{" "}
                        {projection
                          ? `Generated by ${projection.rule}. Edit the structured source record above.`
                          : "Complete the relevant structured section above; the projector will produce a conservative summary."}
                      </div>
                    </div>
                  ) : (
                    <FactEditor
                      key={`${field.id}-${JSON.stringify(card.facts[field.id])}`}
                      fieldId={field.id}
                      label={field.label}
                      description={field.description}
                      core={field.core}
                      fact={card.facts[field.id]}
                      sourcePages={card.sourcePagesChecked}
                      onApply={applyFact}
                    />
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </div>

      <aside className="builder-preview" aria-labelledby="preview-title">
        <div className="builder-preview-heading">
          <div>
            <p className="eyebrow">Live preview</p>
            <h2 id="preview-title">Current local card</h2>
          </div>
          <span className="tag">Autosaved</span>
        </div>
        <FactsCard card={card} embedded preview unassessedFields={unassessedFields} />
      </aside>
    </div>
  );
}

function FactEditor({
  fieldId,
  label,
  description,
  core,
  fact,
  sourcePages,
  onApply,
}: {
  fieldId: FieldId;
  label: string;
  description: string;
  core: boolean;
  fact: Fact;
  sourcePages: readonly SourcePage[];
  onApply: (fieldId: FieldId, fact: Fact) => boolean;
}) {
  const [status, setStatus] = useState<EvidenceStatus>(fact.status);
  const [note, setNote] = useState(fact.note ?? "");
  const [primary, setPrimary] = useState(() => draftFromFact(fact));
  const [secondary, setSecondary] = useState(() => draftFromFact(fact, 1));
  const [claimKind, setClaimKind] = useState<"source_stated" | "organizer_stated">(
    fact.claimKind === "organizer_stated" ? "organizer_stated" : "source_stated",
  );
  const [error, setError] = useState("");
  const preservesExistingCalculation =
    status === "disclosed" &&
    fact.status === "disclosed" &&
    fact.claimKind === "calculated" &&
    fact.calculation !== null;
  const unsupportedNewCalculatedRate =
    status === "disclosed" &&
    fieldId === "calculated_acceptance_rate" &&
    !preservesExistingCalculation;

  function constructFact() {
    if (status === "not_found") {
      return factSchema.safeParse(createEmptyFact());
    }
    if (status === "not_applicable") {
      return factSchema.safeParse({
        status,
        note: note.trim(),
      });
    }
    if (status === "disclosed") {
      if (preservesExistingCalculation) return factSchema.safeParse(fact);
      const source = parseEvidence(primary, sourcePages);
      if (!source.success) return source;
      return factSchema.safeParse({
        status,
        value: primary.value.trim(),
        displayValue: primary.value.trim(),
        normalizedValue: null,
        sources: [source.data],
        note: note.trim() || null,
        confidence: null,
        claimKind:
          fieldId === "acceptance_rate_claim"
            ? "organizer_stated"
            : claimKind,
        conflictingValues: [],
        calculation: null,
      });
    }
    if (status === "unclear") {
      const hasEvidence = Boolean(primary.sourceId || primary.excerpt);
      const source = hasEvidence ? parseEvidence(primary, sourcePages) : null;
      if (source && !source.success) return source;
      return factSchema.safeParse({
        status,
        value: null,
        displayValue: null,
        normalizedValue: null,
        sources: source?.success ? [source.data] : [],
        note: note.trim() || "Relevant source wording is not precise enough to state one value.",
        confidence: null,
        claimKind: source?.success ? "source_stated" : null,
        conflictingValues: [],
        calculation: null,
      });
    }
    const firstSource = parseEvidence(primary, sourcePages);
    if (!firstSource.success) return firstSource;
    const secondSource = parseEvidence(secondary, sourcePages);
    if (!secondSource.success) return secondSource;
    return factSchema.safeParse({
      status: "conflicting",
      value: null,
      displayValue: null,
      normalizedValue: null,
      sources: [],
      note: note.trim() || "Reviewed sources support different values.",
      confidence: null,
      claimKind: null,
      conflictingValues: [
        { value: primary.value.trim(), displayValue: primary.value.trim(), normalizedValue: null, sources: [firstSource.data], note: null },
        { value: secondary.value.trim(), displayValue: secondary.value.trim(), normalizedValue: null, sources: [secondSource.data], note: null },
      ],
      calculation: null,
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unsupportedNewCalculatedRate) {
      setError(
        "A calculated acceptance rate requires a dedicated human review of matching applicant and acceptance counts, population, cycle, formula, and evidence. Record the source-stated rate under Published acceptance-rate claim, or choose an uncertainty status here.",
      );
      return;
    }
    const result = constructFact();
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "This fact is incomplete.");
      return;
    }
    if (onApply(fieldId, result.data)) setError("");
  }

  return (
    <form className="fact-editor" onSubmit={submit}>
      <div className="fact-editor-heading">
        <div>
          <h3>{label} {core ? <span>Core fact</span> : null}</h3>
          <p>{description}</p>
        </div>
        <div className="field fact-status-field">
          <label htmlFor={`builder-status-${fieldId}`}>Evidence status</label>
          <select id={`builder-status-${fieldId}`} value={status} onChange={(event) => setStatus(event.target.value as EvidenceStatus)}>
            {EVIDENCE_STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </div>
      </div>
      {error ? <div className="error-summary" role="alert">{error}</div> : null}
      {preservesExistingCalculation ? (
        <div className="notice">
          <strong>Calculated record preserved.</strong> This generic editor will not rewrite its normalized output, formula, inputs, or evidence. Change the status to withdraw it; create a new calculation only after the dedicated count/population/cycle review documented in the methodology.
        </div>
      ) : unsupportedNewCalculatedRate ? (
        <div className="notice">
          <strong>Calculation workflow required.</strong> The generic fact editor cannot create a calculated acceptance rate. Use Published acceptance-rate claim for an organizer-stated rate, or choose not found, unclear, conflicting, or not applicable.
        </div>
      ) : status === "disclosed" ? (
        <>
          <EvidenceFields id={`${fieldId}-primary`} draft={primary} onChange={setPrimary} sourcePages={sourcePages} includeValue />
          {fieldId === "acceptance_rate_claim" ? (
            <p className="field-help"><strong>Claim attribution:</strong> Organizer-stated, because this field records a rate directly claimed by the organizer.</p>
          ) : (
            <div className="field">
              <label htmlFor={`builder-claim-kind-${fieldId}`}>Claim attribution</label>
              <select
                id={`builder-claim-kind-${fieldId}`}
                value={claimKind}
                onChange={(event) => setClaimKind(event.target.value as "source_stated" | "organizer_stated")}
              >
                <option value="source_stated">Directly stated by the cited source</option>
                <option value="organizer_stated">Organizer-stated claim</option>
              </select>
            </div>
          )}
        </>
      ) : null}
      {status === "not_applicable" ? <NoteField id={fieldId} label="Why this fact does not apply" value={note} onChange={setNote} required /> : null}
      {status === "unclear" ? (
        <>
          <NoteField id={fieldId} label="Why the source is unclear" value={note} onChange={setNote} />
          <EvidenceFields id={`${fieldId}-primary`} draft={primary} onChange={setPrimary} sourcePages={sourcePages} optional />
        </>
      ) : null}
      {status === "conflicting" ? (
        <>
          <NoteField id={fieldId} label="Conflict summary" value={note} onChange={setNote} />
          <fieldset className="evidence-fieldset">
            <legend>Source-backed value 1</legend>
            <EvidenceFields id={`${fieldId}-a`} draft={primary} onChange={setPrimary} sourcePages={sourcePages} includeValue />
          </fieldset>
          <fieldset className="evidence-fieldset">
            <legend>Source-backed value 2</legend>
            <EvidenceFields id={`${fieldId}-b`} draft={secondary} onChange={setSecondary} sourcePages={sourcePages} includeValue />
          </fieldset>
        </>
      ) : null}
      {status === "disclosed" && !preservesExistingCalculation && !unsupportedNewCalculatedRate ? <NoteField id={fieldId} label="Neutral note (optional)" value={note} onChange={setNote} /> : null}
      <button className="button-secondary" type="submit" disabled={unsupportedNewCalculatedRate}>Apply {label.toLocaleLowerCase()}</button>
    </form>
  );
}

function NoteField({ id, label, value, onChange, required = false }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={`builder-note-${id}`}>{label}</label>
      <textarea id={`builder-note-${id}`} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

function EvidenceFields({
  id,
  draft,
  onChange,
  sourcePages,
  includeValue = false,
  optional = false,
}: {
  id: string;
  draft: EvidenceDraft;
  onChange: (draft: EvidenceDraft) => void;
  sourcePages: readonly SourcePage[];
  includeValue?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="stack evidence-fields">
      {includeValue ? (
        <div className="field">
          <label htmlFor={`${id}-value`}>Displayed value or source wording</label>
          <textarea id={`${id}-value`} value={draft.value} onChange={(event) => onChange({ ...draft, value: event.target.value })} required />
        </div>
      ) : null}
      {optional ? <p className="field-help">Evidence is optional as a complete group. If one field is entered, complete both.</p> : null}
      <div className="field">
        <label htmlFor={`${id}-source`}>Checked source page</label>
        <select id={`${id}-source`} value={draft.sourceId} onChange={(event) => onChange({ ...draft, sourceId: event.target.value })} required={!optional}>
          <option value="">Select a recorded page</option>
          {sourcePages.map((page) => <option key={page.id} value={page.id}>{sourceOptionLabel(page)}</option>)}
        </select>
        {!sourcePages.length ? <p className="field-help">Add the page to Checked source pages before attaching evidence.</p> : null}
      </div>
      <div className="field">
        <label htmlFor={`${id}-excerpt`}>Exact supporting excerpt</label>
        <textarea id={`${id}-excerpt`} value={draft.excerpt} onChange={(event) => onChange({ ...draft, excerpt: event.target.value })} required={!optional} />
      </div>
    </div>
  );
}
