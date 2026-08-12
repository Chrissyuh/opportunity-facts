"use client";

import { useState } from "react";
import {
  COST_KINDS,
  COST_REQUIREMENTS,
  CYCLE_STATUSES,
  INSTITUTION_RELATIONSHIP_TYPES,
  ORGANIZATION_KINDS,
  ORGANIZATION_ROLES,
  OUTCOME_TYPES,
  RECIPIENT_SCOPES,
  STAGE_KINDS,
  VARIANT_KINDS,
  type EvidenceSource,
  type OpportunityCard,
  type Scope,
  type SourcePage,
  createEmptyFact,
} from "@/lib/opportunity/schema";
import type { FieldId } from "@/lib/opportunity/fields";

type CollectionKey =
  | "organizations"
  | "organizationRoles"
  | "institutionRelationships"
  | "variants"
  | "stages"
  | "pathways"
  | "costItems"
  | "outcomes";

type EditTarget = { collectionKey: CollectionKey | "cycle"; recordId: string };

const COLLECTION_SUMMARY_FIELDS: Record<CollectionKey, readonly FieldId[]> = {
  organizations: ["operating_organization", "organization_type"],
  organizationRoles: ["operating_organization", "organization_type"],
  institutionRelationships: ["named_institution", "institution_relationship", "relationship_explanation"],
  variants: [],
  stages: ["application_deadline", "decision_date", "start_date", "end_date", "duration", "weekly_hours", "required_live_hours", "participation_format", "location", "selection_process"],
  pathways: ["selection_process"],
  costItems: ["application_fee", "deposit", "tuition", "other_mandatory_costs", "estimated_total_mandatory_cost"],
  outcomes: ["cash_award", "stipend", "tuition_waiver", "program_seat", "in_kind_value", "mentorship", "certificate", "college_credit", "other_benefits"],
};

type Commit = (card: OpportunityCard, message: string) => boolean;

function title(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function nextId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function evidenceFromForm(
  data: FormData,
  sourcePages: readonly SourcePage[],
  prefix = "",
): EvidenceSource {
  const sourceId = String(data.get(`${prefix}EvidenceSourceId`) ?? "");
  const page = sourcePages.find((candidate) => candidate.id === sourceId);
  const excerpt = String(data.get(`${prefix}EvidenceExcerpt`) ?? "").trim();
  if (!page || !excerpt) {
    throw new Error("Choose a checked page and copy the exact supporting excerpt.");
  }
  return { ...page, excerpt };
}

function evidenceForClaim(
  data: FormData,
  sourcePages: readonly SourcePage[],
  prefix: string,
  shared: EvidenceSource,
) {
  const sourceId = String(data.get(`${prefix}EvidenceSourceId`) ?? "");
  const excerpt = String(data.get(`${prefix}EvidenceExcerpt`) ?? "").trim();
  if (!sourceId && !excerpt) return shared;
  return evidenceFromForm(data, sourcePages, prefix);
}

function assertion<T>(
  claimId: string,
  value: T,
  displayValue: string,
  source: EvidenceSource,
) {
  return {
    claimId,
    status: "disclosed" as const,
    value,
    displayValue,
    claimKind: "source_stated" as const,
    sources: [source],
    note: null,
    conflictingValues: [],
  };
}

function notFound(claimId: string, note: string) {
  return {
    claimId,
    status: "not_found" as const,
    value: null,
    displayValue: null,
    claimKind: null,
    sources: [],
    note,
    conflictingValues: [],
  };
}

function unclear(claimId: string, note: string, source: EvidenceSource) {
  return {
    claimId,
    status: "unclear" as const,
    value: null,
    displayValue: null,
    claimKind: null,
    sources: [source],
    note,
    conflictingValues: [],
  };
}

function records<T>(collection: { status: string; records: T[] }): T[] {
  return collection.status === "modeled" ? collection.records : [];
}

function scopeFromForm(data: FormData): Scope {
  return {
    variantIds: data.getAll("scopeVariantIds").map(String),
    stageIds: data.getAll("scopeStageIds").map(String),
    pathwayIds: data.getAll("scopePathwayIds").map(String),
  };
}

function EvidenceFields({
  sourcePages,
  id,
  prefix = "",
  label = "Atomic evidence",
  optional = false,
  defaultSourceId = "",
  defaultExcerpt = "",
}: {
  sourcePages: readonly SourcePage[];
  id: string;
  prefix?: string;
  label?: string;
  optional?: boolean;
  defaultSourceId?: string;
  defaultExcerpt?: string;
}) {
  return (
    <fieldset className="structured-builder-evidence">
      <legend>{label}</legend>
      <div className="field">
        <label htmlFor={`${id}-source`}>Checked source page</label>
        <select id={`${id}-source`} name={`${prefix}EvidenceSourceId`} required={!optional} defaultValue={defaultSourceId}>
          <option value="">Select a recorded page</option>
          {sourcePages.map((page) => (
            <option key={page.id} value={page.id}>{page.title} — {new URL(page.url).hostname}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-excerpt`}>Exact excerpt supporting every value entered above</label>
        <textarea id={`${id}-excerpt`} name={`${prefix}EvidenceExcerpt`} required={!optional} defaultValue={defaultExcerpt} />
      </div>
      {optional ? (
        <p className="field-help">Leave both blank only when the primary excerpt above supports this claim too.</p>
      ) : null}
    </fieldset>
  );
}

function ClaimEvidenceFields({
  sourcePages,
  id,
  prefix,
  label,
  defaultSourceId = "",
  defaultExcerpt = "",
}: {
  sourcePages: readonly SourcePage[];
  id: string;
  prefix: string;
  label: string;
  defaultSourceId?: string;
  defaultExcerpt?: string;
}) {
  return (
    <details className="structured-claim-evidence">
      <summary>Use different evidence for {label.toLowerCase()}</summary>
      <EvidenceFields
        sourcePages={sourcePages}
        id={id}
        prefix={prefix}
        label={`${label} evidence`}
        optional
        defaultSourceId={defaultSourceId}
        defaultExcerpt={defaultExcerpt}
      />
    </details>
  );
}

function ScopeFields({
  card,
  id,
  defaultScope = { variantIds: [], stageIds: [], pathwayIds: [] },
}: {
  card: OpportunityCard;
  id: string;
  defaultScope?: Scope;
}) {
  const variants = records(card.variants);
  const stages = records(card.stages);
  const pathways = records(card.pathways);
  if (!variants.length && !stages.length && !pathways.length) {
    return <p className="field-help">Scope defaults to every program, stage, and pathway.</p>;
  }
  return (
    <fieldset className="structured-builder-scope">
      <legend>Applies to (optional)</legend>
      <p className="field-help">Empty means shared. Multiple choices are OR within a group and AND across groups.</p>
      <div className="field-grid">
        {variants.length ? (
          <div className="field">
            <label htmlFor={`${id}-variants`}>Programs/cohorts</label>
            <select id={`${id}-variants`} name="scopeVariantIds" multiple size={Math.min(4, variants.length)} defaultValue={defaultScope.variantIds}>
              {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.definition.value.label}</option>)}
            </select>
          </div>
        ) : null}
        {stages.length ? (
          <div className="field">
            <label htmlFor={`${id}-stages`}>Stages</label>
            <select id={`${id}-stages`} name="scopeStageIds" multiple size={Math.min(4, stages.length)} defaultValue={defaultScope.stageIds}>
              {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.definition.value.label}</option>)}
            </select>
          </div>
        ) : null}
        {pathways.length ? (
          <div className="field">
            <label htmlFor={`${id}-paths`}>Pathways</label>
            <select id={`${id}-paths`} name="scopePathwayIds" multiple size={Math.min(4, pathways.length)} defaultValue={defaultScope.pathwayIds}>
              {pathways.map((pathway) => <option key={pathway.id} value={pathway.id}>{pathway.definition.value.label}</option>)}
            </select>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function AssessmentControls({
  card,
  collectionKey,
  label,
  onCommit,
}: {
  card: OpportunityCard;
  collectionKey: CollectionKey;
  label: string;
  onCommit: Commit;
}) {
  const collection = card[collectionKey];
  if (collection.status !== "unassessed") {
    return <span className="structured-builder-state">{title(collection.status)}</span>;
  }
  const mark = (status: "none_found" | "not_applicable") => {
    const note = status === "none_found"
      ? `No ${label.toLowerCase()} were found in the checked sources.`
      : `${label} do not apply to this opportunity.`;
    const facts = { ...card.facts };
    for (const fieldId of COLLECTION_SUMMARY_FIELDS[collectionKey]) {
      facts[fieldId] = status === "not_applicable"
        ? createEmptyFact("not_applicable", note)
        : createEmptyFact("not_found");
    }
    onCommit(
      { ...card, facts, [collectionKey]: { status, records: [], note } } as OpportunityCard,
      `${label} marked ${title(status).toLowerCase()}.`,
    );
  };
  return (
    <div className="button-row structured-assessment-actions">
      <button className="button-quiet" type="button" onClick={() => mark("none_found")}>Reviewed: none found</button>
      <button className="button-quiet" type="button" onClick={() => mark("not_applicable")}>Not applicable</button>
    </div>
  );
}

function TaskSection({
  number,
  title: heading,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details className="structured-builder-task">
      <summary>
        <span>{number}</span>
        <strong>{heading}</strong>
        <small>{description}</small>
      </summary>
      <div className="structured-builder-task-body">{children}</div>
    </details>
  );
}

export function StructuredBuilder({
  card,
  onCommit,
}: {
  card: OpportunityCard;
  onCommit: Commit;
}) {
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const sourcePages = card.sourcePagesChecked;

  function submit(
    event: React.FormEvent<HTMLFormElement>,
    handler: (data: FormData, source: EvidenceSource) => OpportunityCard,
    message: string,
  ): boolean {
    event.preventDefault();
    try {
      const data = new FormData(event.currentTarget);
      const source = evidenceFromForm(data, sourcePages);
      if (onCommit(handler(data, source), message)) {
        event.currentTarget.reset();
        setError("");
        return true;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The structured record is incomplete.");
    }
    return false;
  }

  const removeRecord = (collectionKey: CollectionKey, recordId: string, label: string) => {
    const collection = card[collectionKey];
    if (collection.status !== "modeled") return;
    const remaining = collection.records.filter((record) => record.id !== recordId);
    let next = {
      ...card,
      [collectionKey]: remaining.length
        ? { ...collection, status: "modeled", records: remaining, note: collection.note }
        : { status: "unassessed", records: [], note: null },
    } as OpportunityCard;
    if (collectionKey === "stages" && card.stages.status === "modeled" && card.cycle.status === "modeled") {
      const removed = card.stages.records.find((stage) => stage.id === recordId);
      const timingIds = new Set(removed?.timings.map((timing) => timing.claimId) ?? []);
      next = {
        ...next,
        cycle: {
          ...card.cycle,
          value: {
            ...card.cycle.value,
            timingRefs: Object.fromEntries(
              Object.entries(card.cycle.value.timingRefs).map(([key, claimId]) => [
                key,
                claimId && timingIds.has(claimId) ? null : claimId,
              ]),
            ) as typeof card.cycle.value.timingRefs,
          },
        },
      };
    }
    onCommit(
      next,
      `${label} removed. Recheck every scope that referred to it.`,
    );
  };

  function recordSubmit(
    event: React.FormEvent<HTMLFormElement>,
    collectionKey: CollectionKey,
    handler: (data: FormData, source: EvidenceSource) => OpportunityCard,
    addedMessage: string,
    updatedMessage: string,
  ) {
    const isEditing = editing?.collectionKey === collectionKey;
    if (submit(event, handler, isEditing ? updatedMessage : addedMessage) && isEditing) {
      setEditing(null);
    }
  }

  function editRecord(collectionKey: CollectionKey, recordId: string) {
    setEditing({ collectionKey, recordId });
    setError("");
  }

  function replaceRecord<T extends { id: string }>(
    values: T[],
    collectionKey: CollectionKey,
    next: T,
  ) {
    return editing?.collectionKey === collectionKey
      ? values.map((record) => record.id === editing.recordId ? next : record)
      : [...values, next];
  }

  const organizations = records(card.organizations);
  const roles = records(card.organizationRoles);
  const relationships = records(card.institutionRelationships);
  const variants = records(card.variants);
  const stages = records(card.stages);
  const pathways = records(card.pathways);
  const costs = records(card.costItems);
  const outcomes = records(card.outcomes);
  const editingOrganization = editing?.collectionKey === "organizations"
    ? organizations.find((record) => record.id === editing.recordId)
    : undefined;
  const editingOrganizationRole = editingOrganization
    ? roles.find((role) => role.organizationId === editingOrganization.id)
    : undefined;
  const editingRelationship = editing?.collectionKey === "institutionRelationships"
    ? relationships.find((record) => record.id === editing.recordId)
    : undefined;
  const editingRelationshipValue = editingRelationship?.assertion.status === "disclosed"
    ? editingRelationship.assertion.value
    : undefined;
  const editingVariant = editing?.collectionKey === "variants"
    ? variants.find((record) => record.id === editing.recordId)
    : undefined;
  const editingStage = editing?.collectionKey === "stages"
    ? stages.find((record) => record.id === editing.recordId)
    : undefined;
  const editingPathway = editing?.collectionKey === "pathways"
    ? pathways.find((record) => record.id === editing.recordId)
    : undefined;
  const editingCost = editing?.collectionKey === "costItems"
    ? costs.find((record) => record.id === editing.recordId)
    : undefined;
  const editingOutcome = editing?.collectionKey === "outcomes"
    ? outcomes.find((record) => record.id === editing.recordId)
    : undefined;
  const editingCycle = editing?.collectionKey === "cycle" && card.cycle.status === "modeled"
    ? card.cycle.value
    : undefined;
  const retainedVariantClaims = editingVariant
    ? Math.max(0, editingVariant.eligibilityDifferences.length - 1) + Math.max(0, editingVariant.notes.length - 1)
    : 0;
  const retainedStageClaims = editingStage
    ? [editingStage.timings, editingStage.durations, editingStage.timeCommitments, editingStage.formats, editingStage.locations, editingStage.selectionRules, editingStage.advancement, editingStage.requirements, editingStage.travelRequirements]
        .reduce((total, claims) => total + Math.max(0, claims.length - 1), 0)
    : 0;
  const retainedCostClaims = editingCost
    ? Math.max(0, editingCost.includedItems.length - 1) + Math.max(0, editingCost.excludedItems.length - 1) + Math.max(0, editingCost.conditions.length - 1)
    : 0;
  const retainedOutcomeClaims = editingOutcome
    ? Math.max(0, editingOutcome.conditions.length - 1) + (editingOutcome.distribution?.status === "disclosed" ? Math.max(0, editingOutcome.distribution.value.length - 1) : 0)
    : 0;

  const editActions = (collectionKey: CollectionKey, recordId: string, remove: () => void) => (
    <div className="button-row">
      <button className="button-quiet" type="button" onClick={() => editRecord(collectionKey, recordId)}>Edit</button>
      <button className="button-quiet" type="button" onClick={remove}>Remove</button>
    </div>
  );

  const formActions = (isEditing: boolean, addLabel: string) => (
    <div className="button-row">
      <button className="button-secondary" type="submit">{isEditing ? "Save changes" : addLabel}</button>
      {isEditing ? <button className="button-quiet" type="button" onClick={() => setEditing(null)}>Cancel edit</button> : null}
    </div>
  );

  return (
    <section className="structured-builder" aria-labelledby="structured-builder-title">
      <div className="structured-builder-heading">
        <div>
          <p className="eyebrow">Schema v2 source model</p>
          <h2 id="structured-builder-title">Model the distinctions that affect a decision.</h2>
        </div>
        <p>These records generate the familiar summary facts. Projected facts below are read-only.</p>
      </div>
      {error ? <div className="error-summary" role="alert">{error}</div> : null}

      <TaskSection number="01" title="Cycle identity" description="Separate cycle from URL and card revision.">
        {card.cycle.status === "modeled" ? (
          <div className="structured-builder-current">
            <span><strong>{card.cycle.value.label.value}</strong><small>{card.cycle.value.cycleType.displayValue ?? card.cycle.value.cycleType.note}</small></span>
            <div className="button-row">
              <button className="button-quiet" type="button" onClick={() => setEditing({ collectionKey: "cycle", recordId: card.cycle.value!.id })}>Edit cycle</button>
              <button
                className="button-quiet"
                type="button"
                onClick={() => onCommit({ ...card, cycle: { status: "unassessed", value: null } }, "Cycle model cleared; review attestation was invalidated.")}
              >Clear cycle</button>
            </div>
          </div>
        ) : null}
        {card.cycle.status === "unassessed" || editingCycle ? (
          <form className="stack" key={editingCycle?.id ?? "new-cycle"} onSubmit={(event) => {
            const didSave = submit(event, (data, source) => {
            const label = String(data.get("cycleLabel") ?? "").trim();
            const cycleType = String(data.get("cycleType") ?? "other");
            const cycleStatus = String(data.get("cycleStatus") ?? "announced");
            const year = Number(data.get("cycleYear"));
            const startYear = Number(data.get("cycleStartYear"));
            const endYear = Number(data.get("cycleEndYear"));
            const season = String(data.get("cycleSeason") ?? "");
            const prefix = editingCycle?.id ?? nextId("cycle");
            const statusSource = evidenceForClaim(data, sourcePages, "cycleStatus", source);
            const typeSource = evidenceForClaim(data, sourcePages, "cycleType", source);
            const yearSource = evidenceForClaim(data, sourcePages, "cycleYear", source);
            const startYearSource = evidenceForClaim(data, sourcePages, "cycleStartYear", source);
            const endYearSource = evidenceForClaim(data, sourcePages, "cycleEndYear", source);
            const seasonSource = evidenceForClaim(data, sourcePages, "cycleSeason", source);
            return {
              ...card,
              cycle: {
                status: "modeled",
                value: {
                  id: prefix,
                  label: assertion(editingCycle?.label.claimId ?? `${prefix}-label`, label, label, source),
                  status: assertion(editingCycle?.status.claimId ?? `${prefix}-status`, cycleStatus, title(cycleStatus), statusSource),
                  year: Number.isInteger(year) && year > 0 ? assertion(editingCycle?.year?.claimId ?? `${prefix}-year`, year, String(year), yearSource) : null,
                  startYear: Number.isInteger(startYear) && startYear > 0 ? assertion(editingCycle?.startYear?.claimId ?? `${prefix}-start-year`, startYear, String(startYear), startYearSource) : null,
                  endYear: Number.isInteger(endYear) && endYear > 0 ? assertion(editingCycle?.endYear?.claimId ?? `${prefix}-end-year`, endYear, String(endYear), endYearSource) : null,
                  season: season ? assertion(editingCycle?.season?.claimId ?? `${prefix}-season`, season, title(season), seasonSource) : null,
                  cycleType: assertion(editingCycle?.cycleType.claimId ?? `${prefix}-type`, cycleType, title(cycleType), typeSource),
                  timingRefs: editingCycle?.timingRefs ?? { opens: null, closes: null, coverageStart: null, coverageEnd: null },
                },
              },
            } as OpportunityCard;
          }, editingCycle ? "Cycle identity updated." : "Cycle identity added.");
            if (didSave && editingCycle) setEditing(null);
          }}>
            <div className="field"><label htmlFor="v2-cycle-label">Cycle label</label><input id="v2-cycle-label" name="cycleLabel" placeholder="Fall 2026" defaultValue={editingCycle?.label.value ?? ""} required /></div>
            <div className="field-grid">
              <div className="field"><label htmlFor="v2-cycle-status">Current status</label><select id="v2-cycle-status" name="cycleStatus" defaultValue={editingCycle?.status.status === "disclosed" ? editingCycle.status.value : "announced"}>{CYCLE_STATUSES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
              <div className="field"><label htmlFor="v2-cycle-type">Cycle type</label><select id="v2-cycle-type" name="cycleType" defaultValue={editingCycle?.cycleType.status === "disclosed" ? editingCycle.cycleType.value : "cohort"}><option value="cohort">Cohort</option><option value="competition_cycle">Competition cycle</option><option value="academic_year">Academic year</option><option value="calendar_year">Calendar year</option><option value="seasonal">Seasonal</option><option value="rolling">Rolling</option><option value="current">Current</option><option value="other">Other</option></select></div>
            </div>
            <div className="field-grid">
              <div className="field"><label htmlFor="v2-cycle-year">Year (optional)</label><input id="v2-cycle-year" name="cycleYear" type="number" min="1900" max="2200" defaultValue={editingCycle?.year?.status === "disclosed" ? editingCycle.year.value : undefined} /></div>
              <div className="field"><label htmlFor="v2-cycle-start-year">Start year (optional)</label><input id="v2-cycle-start-year" name="cycleStartYear" type="number" min="1900" max="2200" defaultValue={editingCycle?.startYear?.status === "disclosed" ? editingCycle.startYear.value : undefined} /></div>
              <div className="field"><label htmlFor="v2-cycle-end-year">End year (optional)</label><input id="v2-cycle-end-year" name="cycleEndYear" type="number" min="1900" max="2200" defaultValue={editingCycle?.endYear?.status === "disclosed" ? editingCycle.endYear.value : undefined} /></div>
              <div className="field"><label htmlFor="v2-cycle-season">Season (optional)</label><select id="v2-cycle-season" name="cycleSeason" defaultValue={editingCycle?.season?.status === "disclosed" ? editingCycle.season.value : ""}><option value="">Not stated</option>{["winter", "spring", "summer", "fall"].map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            </div>
            <EvidenceFields sourcePages={sourcePages} id="v2-cycle" label="Cycle label evidence" defaultSourceId={editingCycle?.label.sources[0]?.id} defaultExcerpt={editingCycle?.label.sources[0]?.excerpt} />
            <ClaimEvidenceFields sourcePages={sourcePages} id="v2-cycle-status-evidence" prefix="cycleStatus" label="Cycle status" defaultSourceId={editingCycle?.status.sources[0]?.id} defaultExcerpt={editingCycle?.status.sources[0]?.excerpt} />
            <ClaimEvidenceFields sourcePages={sourcePages} id="v2-cycle-type-evidence" prefix="cycleType" label="Cycle type" defaultSourceId={editingCycle?.cycleType.sources[0]?.id} defaultExcerpt={editingCycle?.cycleType.sources[0]?.excerpt} />
            <ClaimEvidenceFields sourcePages={sourcePages} id="v2-cycle-year-evidence" prefix="cycleYear" label="Cycle year" defaultSourceId={editingCycle?.year?.sources[0]?.id} defaultExcerpt={editingCycle?.year?.sources[0]?.excerpt} />
            <ClaimEvidenceFields sourcePages={sourcePages} id="v2-cycle-start-year-evidence" prefix="cycleStartYear" label="Start year" defaultSourceId={editingCycle?.startYear?.sources[0]?.id} defaultExcerpt={editingCycle?.startYear?.sources[0]?.excerpt} />
            <ClaimEvidenceFields sourcePages={sourcePages} id="v2-cycle-end-year-evidence" prefix="cycleEndYear" label="End year" defaultSourceId={editingCycle?.endYear?.sources[0]?.id} defaultExcerpt={editingCycle?.endYear?.sources[0]?.excerpt} />
            <ClaimEvidenceFields sourcePages={sourcePages} id="v2-cycle-season-evidence" prefix="cycleSeason" label="Season" defaultSourceId={editingCycle?.season?.sources[0]?.id} defaultExcerpt={editingCycle?.season?.sources[0]?.excerpt} />
            {formActions(Boolean(editingCycle), "Add cycle identity")}
          </form>
        ) : null}
      </TaskSection>

      <TaskSection number="02" title="Organizations and relationships" description="Keep operation, administration, and affiliation distinct.">
        <div className="structured-builder-section-heading">
          <strong>Organizations and roles</strong>
          <div className="structured-assessment-pair">
            <AssessmentControls card={card} collectionKey="organizations" label="Organizations" onCommit={onCommit} />
            <AssessmentControls card={card} collectionKey="organizationRoles" label="Organization roles" onCommit={onCommit} />
          </div>
        </div>
        {organizations.length ? <ul className="structured-builder-records">{organizations.map((organization) => {
          const organizationRoles = roles.filter((role) => role.organizationId === organization.id);
          return (
            <li key={organization.id}>
              <span>
                <strong>{organization.name.value}</strong>
                <small>{organizationRoles.map((role) => title(role.role.value.role)).join(", ") || "No role yet"}</small>
              </span>
              <div className="button-row">
                {organizationRoles.map((role) => (
                  <button
                    className="button-quiet"
                    key={role.id}
                    type="button"
                    onClick={() => removeRecord("organizationRoles", role.id, `${title(role.role.value.role)} role`)}
                  >Remove {title(role.role.value.role).toLowerCase()} role</button>
                ))}
                <button className="button-quiet" type="button" onClick={() => editRecord("organizations", organization.id)}>Edit organization and primary role</button>
                <button
                  className="button-quiet"
                  type="button"
                  disabled={organizationRoles.length > 0}
                  onClick={() => removeRecord("organizations", organization.id, organization.name.value)}
                >Remove organization</button>
              </div>
            </li>
          );
        })}</ul> : null}
        <form className="stack" key={editingOrganization?.id ?? "new-organization"} onSubmit={(event) => recordSubmit(event, "organizations", (data, source) => {
          const organizationId = editingOrganization?.id ?? nextId("organization");
          const roleId = editingOrganizationRole?.id ?? nextId("role");
          const name = String(data.get("organizationName") ?? "").trim();
          const kind = String(data.get("organizationKind") ?? "education_provider") as (typeof ORGANIZATION_KINDS)[number];
          const role = String(data.get("organizationRole") ?? "operator") as (typeof ORGANIZATION_ROLES)[number];
          const roleLabel = String(data.get("organizationRoleLabel") ?? "").trim() || null;
          const kindSource = evidenceForClaim(data, sourcePages, "kind", source);
          const roleSource = evidenceForClaim(data, sourcePages, "role", source);
          const nextOrganization = { id: organizationId, name: assertion(editingOrganization?.name.claimId ?? `${organizationId}-name`, name, name, source), kind: assertion(editingOrganization?.kind.claimId ?? `${organizationId}-kind`, kind, title(kind), kindSource) };
          const nextRole = { id: roleId, organizationId, role: assertion(editingOrganizationRole?.role.claimId ?? `${roleId}-claim`, { role, roleLabel, scope: scopeFromForm(data) }, roleLabel ?? title(role), roleSource) };
          return {
            ...card,
            organizations: { status: "modeled", note: card.organizations.note, records: replaceRecord(organizations, "organizations", nextOrganization) },
            organizationRoles: { status: "modeled", note: card.organizationRoles.note, records: editingOrganizationRole ? roles.map((item) => item.id === editingOrganizationRole.id ? nextRole : item) : [...roles, nextRole] },
          } as OpportunityCard;
        }, "Organization and role added.", "Organization and role updated.")}>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-organization-name">Organization</label><input id="v2-organization-name" name="organizationName" defaultValue={editingOrganization?.name.value ?? ""} required /></div>
            <div className="field"><label htmlFor="v2-organization-kind">Organization type</label><select id="v2-organization-kind" name="organizationKind" defaultValue={editingOrganization?.kind.status === "disclosed" ? editingOrganization.kind.value : "education_provider"}>{ORGANIZATION_KINDS.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-organization-role">Role</label><select id="v2-organization-role" name="organizationRole" defaultValue={editingOrganizationRole?.role.value.role ?? "operator"}>{ORGANIZATION_ROLES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-organization-role-label">Precise role label (optional)</label><input id="v2-organization-role-label" name="organizationRoleLabel" placeholder="Challenge administrator" defaultValue={editingOrganizationRole?.role.value.roleLabel ?? ""} /></div>
          </div>
          <ScopeFields card={card} id="v2-organization-role-scope" defaultScope={editingOrganizationRole?.role.value.scope} />
          <EvidenceFields sourcePages={sourcePages} id="v2-organization" label="Organization name evidence" defaultSourceId={editingOrganization?.name.sources[0]?.id} defaultExcerpt={editingOrganization?.name.sources[0]?.excerpt} />
          <ClaimEvidenceFields sourcePages={sourcePages} id="v2-organization-kind" prefix="kind" label="Organization type" defaultSourceId={editingOrganization?.kind.sources[0]?.id} defaultExcerpt={editingOrganization?.kind.sources[0]?.excerpt} />
          <ClaimEvidenceFields sourcePages={sourcePages} id="v2-organization-role-claim" prefix="role" label="Organization role" defaultSourceId={editingOrganizationRole?.role.sources[0]?.id} defaultExcerpt={editingOrganizationRole?.role.sources[0]?.excerpt} />
          {formActions(Boolean(editingOrganization), "Add organization and role")}
        </form>
        <div className="divider" />
        <div className="structured-builder-section-heading"><strong>Institution relationships</strong><AssessmentControls card={card} collectionKey="institutionRelationships" label="Institution relationships" onCommit={onCommit} /></div>
        {relationships.length ? <ul className="structured-builder-records">{relationships.map((relationship) => <li key={relationship.id}><span><strong>{relationship.assertion.displayValue ?? relationship.assertion.note}</strong><small>{relationship.assertion.status}</small></span>{editActions("institutionRelationships", relationship.id, () => removeRecord("institutionRelationships", relationship.id, "Relationship"))}</li>)}</ul> : null}
        <form className="stack" key={editingRelationship?.id ?? "new-relationship"} onSubmit={(event) => recordSubmit(event, "institutionRelationships", (data, source) => {
          const id = editingRelationship?.id ?? nextId("relationship");
          const relationshipType = String(data.get("relationshipType") ?? "unclear") as (typeof INSTITUTION_RELATIONSHIP_TYPES)[number];
          const targetOrganizationId = String(data.get("relationshipTargetOrganization") ?? "") || null;
          const subjectOrganizationId = String(data.get("relationshipSubjectOrganization") ?? "") || null;
          const targetInstitutionName = String(data.get("relationshipTargetName") ?? "").trim() || null;
          if (!targetOrganizationId && !targetInstitutionName && relationshipType !== "independent") throw new Error("Identify the institution or organization this relationship concerns.");
          const subject = String(data.get("relationshipSubject") ?? "opportunity") as "opportunity" | "founders" | "mentors" | "staff";
          const description = String(data.get("relationshipDescription") ?? "").trim();
          const display = `${title(relationshipType)}${targetInstitutionName ? ` — ${targetInstitutionName}` : ""}`;
          const nextRelationship = { id, assertion: assertion(editingRelationship?.assertion.claimId ?? `${id}-claim`, { subject, subjectOrganizationId, targetOrganizationId, targetInstitutionName, relationshipType, description, scope: scopeFromForm(data) }, display, source) };
          return { ...card, institutionRelationships: { status: "modeled", note: card.institutionRelationships.note, records: replaceRecord(relationships, "institutionRelationships", nextRelationship) } } as OpportunityCard;
        }, "Institution relationship added without upgrading person affiliation.", "Institution relationship updated without upgrading person affiliation.")}>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-relationship-subject">Whose relationship?</label><select id="v2-relationship-subject" name="relationshipSubject" defaultValue={editingRelationshipValue?.subject ?? "opportunity"}><option value="opportunity">Opportunity</option><option value="founders">Founders</option><option value="mentors">Mentors</option><option value="staff">Staff</option></select></div>
            <div className="field"><label htmlFor="v2-relationship-subject-organization">Subject organization (optional)</label><select id="v2-relationship-subject-organization" name="relationshipSubjectOrganization" defaultValue={editingRelationshipValue?.subjectOrganizationId ?? ""}><option value="">Opportunity or people above</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name.value}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-relationship-type">Relationship type</label><select id="v2-relationship-type" name="relationshipType" defaultValue={editingRelationshipValue?.relationshipType ?? "unclear"}>{INSTITUTION_RELATIONSHIP_TYPES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-relationship-target-organization">Known target organization (optional)</label><select id="v2-relationship-target-organization" name="relationshipTargetOrganization" defaultValue={editingRelationshipValue?.targetOrganizationId ?? ""}><option value="">Use a name below</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name.value}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-relationship-target-name">Institution name (optional)</label><input id="v2-relationship-target-name" name="relationshipTargetName" defaultValue={editingRelationshipValue?.targetInstitutionName ?? ""} /></div>
          </div>
          <div className="field"><label htmlFor="v2-relationship-description">Exact limitation/explanation</label><textarea id="v2-relationship-description" name="relationshipDescription" defaultValue={editingRelationshipValue?.description ?? ""} required /></div>
          <ScopeFields card={card} id="v2-relationship-scope" defaultScope={editingRelationshipValue?.scope} />
          <EvidenceFields sourcePages={sourcePages} id="v2-relationship" defaultSourceId={editingRelationship?.assertion.sources[0]?.id} defaultExcerpt={editingRelationship?.assertion.sources[0]?.excerpt} />
          {formActions(Boolean(editingRelationship), "Add relationship")}
        </form>
      </TaskSection>

      <TaskSection number="03" title="Programs and cohorts" description="Represent tiers, cohorts, and tracks without cloned cards.">
        <div className="structured-builder-section-heading"><strong>{variants.length} program option{variants.length === 1 ? "" : "s"}</strong><AssessmentControls card={card} collectionKey="variants" label="Program variants" onCommit={onCommit} /></div>
        {variants.length ? <ul className="structured-builder-records">{variants.map((variant) => <li key={variant.id}><span><strong>{variant.definition.value.label}</strong><small>{title(variant.definition.value.kind)}</small></span>{editActions("variants", variant.id, () => removeRecord("variants", variant.id, variant.definition.value.label))}</li>)}</ul> : null}
        <form className="stack" key={editingVariant?.id ?? "new-variant"} onSubmit={(event) => recordSubmit(event, "variants", (data, source) => {
          const id = editingVariant?.id ?? nextId("variant");
          const label = String(data.get("variantLabel") ?? "").trim();
          const kind = String(data.get("variantKind") ?? "tier") as (typeof VARIANT_KINDS)[number];
          const parentVariantId = String(data.get("variantParent") ?? "") || null;
          const eligibility = String(data.get("variantEligibility") ?? "").trim();
          const note = String(data.get("variantNote") ?? "").trim();
          const eligibilitySource = evidenceForClaim(data, sourcePages, "eligibility", source);
          const noteSource = evidenceForClaim(data, sourcePages, "variantNote", source);
          const nextVariant = { id, definition: assertion(editingVariant?.definition.claimId ?? `${id}-definition`, { label, kind, parentVariantId }, label, source), eligibilityDifferences: [...(eligibility ? [assertion(editingVariant?.eligibilityDifferences[0]?.claimId ?? `${id}-eligibility`, eligibility, eligibility, eligibilitySource)] : []), ...(editingVariant?.eligibilityDifferences.slice(1) ?? [])], notes: [...(note ? [assertion(editingVariant?.notes[0]?.claimId ?? `${id}-note`, note, note, noteSource)] : []), ...(editingVariant?.notes.slice(1) ?? [])] };
          return { ...card, variants: { status: "modeled", note: card.variants.note, records: replaceRecord(variants, "variants", nextVariant) } } as OpportunityCard;
        }, "Program/cohort added.", "Program/cohort updated.")}>
          {retainedVariantClaims ? <p className="structured-retained-note">This compact editor changes the first claim in each category. {retainedVariantClaims} additional atomic claim{retainedVariantClaims === 1 ? " is" : "s are"} retained unchanged.</p> : null}
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-variant-label">Name</label><input id="v2-variant-label" name="variantLabel" defaultValue={editingVariant?.definition.value.label ?? ""} required /></div>
            <div className="field"><label htmlFor="v2-variant-kind">Kind</label><select id="v2-variant-kind" name="variantKind" defaultValue={editingVariant?.definition.value.kind ?? "tier"}>{VARIANT_KINDS.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-variant-parent">Parent option (optional)</label><select id="v2-variant-parent" name="variantParent" defaultValue={editingVariant?.definition.value.parentVariantId ?? ""}><option value="">None</option>{variants.filter((variant) => variant.id !== editingVariant?.id).map((variant) => <option key={variant.id} value={variant.id}>{variant.definition.value.label}</option>)}</select></div>
          </div>
          <div className="field"><label htmlFor="v2-variant-eligibility">Eligibility difference (optional)</label><textarea id="v2-variant-eligibility" name="variantEligibility" defaultValue={editingVariant?.eligibilityDifferences[0]?.displayValue ?? ""} /></div>
          <ClaimEvidenceFields sourcePages={sourcePages} id="v2-variant-eligibility-evidence" prefix="eligibility" label="Eligibility difference" defaultSourceId={editingVariant?.eligibilityDifferences[0]?.sources[0]?.id} defaultExcerpt={editingVariant?.eligibilityDifferences[0]?.sources[0]?.excerpt} />
          <div className="field"><label htmlFor="v2-variant-note">Relevant program note (optional)</label><textarea id="v2-variant-note" name="variantNote" defaultValue={editingVariant?.notes[0]?.value ?? ""} /></div>
          <ClaimEvidenceFields sourcePages={sourcePages} id="v2-variant-note-evidence" prefix="variantNote" label="Program note" defaultSourceId={editingVariant?.notes[0]?.sources[0]?.id} defaultExcerpt={editingVariant?.notes[0]?.sources[0]?.excerpt} />
          <EvidenceFields sourcePages={sourcePages} id="v2-variant" label="Program definition evidence" defaultSourceId={editingVariant?.definition.sources[0]?.id} defaultExcerpt={editingVariant?.definition.sources[0]?.excerpt} />
          {formActions(Boolean(editingVariant), "Add program/cohort")}
        </form>
      </TaskSection>

      <TaskSection number="04" title="Schedule and process" description="Ordered stages plus explicit branches where they matter.">
        <div className="structured-builder-section-heading"><strong>{stages.length} stage{stages.length === 1 ? "" : "s"}</strong><AssessmentControls card={card} collectionKey="stages" label="Process stages" onCommit={onCommit} /></div>
        {stages.length ? <ul className="structured-builder-records">{[...stages].sort((a, b) => a.order - b.order).map((stage) => <li key={stage.id}><span><strong>{stage.order}. {stage.definition.value.label}</strong><small>{title(stage.definition.value.kind)}</small></span>{editActions("stages", stage.id, () => removeRecord("stages", stage.id, stage.definition.value.label))}</li>)}</ul> : null}
        <form className="stack" key={editingStage?.id ?? "new-stage"} onSubmit={(event) => recordSubmit(event, "stages", (data, source) => {
          const id = editingStage?.id ?? nextId("stage");
          const label = String(data.get("stageLabel") ?? "").trim();
          const kind = String(data.get("stageKind") ?? "application") as (typeof STAGE_KINDS)[number];
          const order = Number(data.get("stageOrder"));
          const eventKind = String(data.get("stageEvent") ?? "") as "" | "opens" | "deadline" | "starts" | "ends" | "decision" | "notification";
          const timingPrecision = String(data.get("stageTimingPrecision") ?? "none");
          const eventDate = String(data.get("stageDate") ?? "");
          const eventMonth = String(data.get("stageMonth") ?? "");
          const certainty = String(data.get("stageTimingCertainty") ?? "stated") as "stated" | "expected";
          const cycleTimingRole = String(data.get("cycleTimingRole") ?? "");
          const format = String(data.get("stageFormat") ?? "") as "" | "online" | "in_person" | "hybrid" | "residential" | "commuter";
          const location = String(data.get("stageLocation") ?? "").trim();
          const durationMinimumText = String(data.get("stageDurationMinimum") ?? "").trim();
          const durationMaximumText = String(data.get("stageDurationMaximum") ?? "").trim();
          const durationUnit = String(data.get("stageDurationUnit") ?? "weeks") as "hours" | "days" | "weeks" | "months";
          const timeMinimumText = String(data.get("stageTimeMinimum") ?? "").trim();
          const timeMaximumText = String(data.get("stageTimeMaximum") ?? "").trim();
          const timePeriod = String(data.get("stageTimePeriod") ?? "week") as "total" | "day" | "week";
          const timeLabel = String(data.get("stageTimeLabel") ?? "").trim();
          const selectionRule = String(data.get("stageSelectionRule") ?? "").trim();
          const advancementCountText = String(data.get("stageAdvancementCount") ?? "").trim();
          const advancementDescription = String(data.get("stageAdvancementDescription") ?? "").trim();
          const requirement = String(data.get("stageRequirement") ?? "").trim();
          const travelRequirement = String(data.get("stageTravelRequirement") ?? "") as "" | "none" | "conditional" | "required";
          const stageScope = scopeFromForm(data);
          const timingId = editingStage?.timings[0]?.claimId ?? `${id}-timing`;
          const expectedEvent = {
            opens: "opens",
            closes: "deadline",
            coverageStart: "starts",
            coverageEnd: "ends",
          }[cycleTimingRole];
          if ((eventKind && timingPrecision === "none") || (!eventKind && timingPrecision !== "none")) {
            throw new Error("Choose both a date meaning and date precision, or leave both blank.");
          }
          if (timingPrecision === "date" && !eventDate) throw new Error("Enter the exact stage date.");
          if (timingPrecision === "month" && !/^\d{4}-\d{2}$/u.test(eventMonth)) throw new Error("Enter the stage month.");
          if (cycleTimingRole && (!eventKind || timingPrecision === "none" || eventKind !== expectedEvent)) {
            throw new Error(`Cycle ${title(cycleTimingRole)} must use a ${title(expectedEvent ?? "matching")} stage date.`);
          }
          if (cycleTimingRole && card.cycle.status !== "modeled") throw new Error("Add the cycle before linking a stage date to it.");
          const durationMinimum = durationMinimumText ? Number(durationMinimumText) : null;
          const durationMaximum = durationMaximumText ? Number(durationMaximumText) : null;
          if (durationMinimum !== null && (!Number.isFinite(durationMinimum) || durationMinimum < 0)) throw new Error("Enter a nonnegative duration minimum.");
          if (durationMaximum !== null && (durationMinimum === null || !Number.isFinite(durationMaximum) || durationMaximum < durationMinimum)) throw new Error("Enter a duration maximum at least as large as its minimum.");
          const timeMinimum = timeMinimumText ? Number(timeMinimumText) : null;
          const timeMaximum = timeMaximumText ? Number(timeMaximumText) : null;
          if (timeMinimum !== null && (!Number.isFinite(timeMinimum) || timeMinimum < 0 || !timeLabel)) throw new Error("Time commitment needs a nonnegative minimum and a source-stated label.");
          if (timeMaximum !== null && (timeMinimum === null || !Number.isFinite(timeMaximum) || timeMaximum < timeMinimum)) throw new Error("Enter a time maximum at least as large as its minimum.");
          const advancementCount = advancementCountText ? Number(advancementCountText) : null;
          if (advancementCount !== null && (!Number.isInteger(advancementCount) || advancementCount < 1 || !advancementDescription)) throw new Error("Advancement count needs a positive whole number and description.");
          const monthParts = eventMonth.split("-").map(Number);
          const timingValue = timingPrecision === "date"
            ? { precision: "date" as const, date: eventDate, certainty }
            : timingPrecision === "month"
              ? { precision: "month" as const, year: monthParts[0], month: monthParts[1], certainty }
              : null;
          const timingDisplay = timingPrecision === "month"
            ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(monthParts[0], monthParts[1] - 1, 1)))
            : eventDate;
          const nextTiming = eventKind && timingValue ? assertion(timingId, { event: eventKind, when: timingValue, scope: stageScope }, `${timingDisplay}${certainty === "expected" ? " (expected)" : ""}`, evidenceForClaim(data, sourcePages, "stageTiming", source)) : null;
          const firstFormat = editingStage?.formats[0];
          const firstLocation = editingStage?.locations[0];
          const firstDuration = editingStage?.durations[0];
          const firstCommitment = editingStage?.timeCommitments[0];
          const firstSelection = editingStage?.selectionRules[0];
          const firstAdvancement = editingStage?.advancement[0];
          const firstRequirement = editingStage?.requirements[0];
          const firstTravel = editingStage?.travelRequirements[0];
          const nextStage = {
            id,
            order,
            definition: assertion(editingStage?.definition.claimId ?? `${id}-definition`, { label, kind, scope: stageScope }, label, source),
            timings: [...(nextTiming ? [nextTiming] : []), ...(editingStage?.timings.slice(1) ?? [])],
            durations: [...(durationMinimum !== null ? [assertion(firstDuration?.claimId ?? `${id}-duration`, { duration: { minimum: durationMinimum, maximum: durationMaximum, unit: durationUnit }, scope: stageScope }, `${durationMinimum}${durationMaximum !== null ? `–${durationMaximum}` : ""} ${durationUnit}`, evidenceForClaim(data, sourcePages, "stageDuration", source))] : []), ...(editingStage?.durations.slice(1) ?? [])],
            timeCommitments: [...(timeMinimum !== null ? [assertion(firstCommitment?.claimId ?? `${id}-time`, { minimumHours: timeMinimum, maximumHours: timeMaximum, period: timePeriod, label: timeLabel, scope: stageScope }, timeLabel, evidenceForClaim(data, sourcePages, "stageTime", source))] : []), ...(editingStage?.timeCommitments.slice(1) ?? [])],
            formats: [...(format ? [assertion(firstFormat?.claimId ?? `${id}-format`, { formats: [format], scope: stageScope }, title(format), evidenceForClaim(data, sourcePages, "stageFormat", source))] : []), ...(editingStage?.formats.slice(1) ?? [])],
            locations: [...(location ? [assertion(firstLocation?.claimId ?? `${id}-location`, { location, scope: stageScope }, location, evidenceForClaim(data, sourcePages, "stageLocation", source))] : []), ...(editingStage?.locations.slice(1) ?? [])],
            selectionRules: [...(selectionRule ? [assertion(firstSelection?.claimId ?? `${id}-selection`, { rule: selectionRule, scope: stageScope }, selectionRule, evidenceForClaim(data, sourcePages, "stageSelection", source))] : []), ...(editingStage?.selectionRules.slice(1) ?? [])],
            advancement: [...(advancementDescription ? [assertion(firstAdvancement?.claimId ?? `${id}-advancement`, { count: advancementCount, description: advancementDescription, scope: stageScope }, advancementDescription, evidenceForClaim(data, sourcePages, "stageAdvancement", source))] : []), ...(editingStage?.advancement.slice(1) ?? [])],
            requirements: [...(requirement ? [assertion(firstRequirement?.claimId ?? `${id}-requirement`, { requirement, scope: stageScope }, requirement, evidenceForClaim(data, sourcePages, "stageRequirement", source))] : []), ...(editingStage?.requirements.slice(1) ?? [])],
            travelRequirements: [...(travelRequirement ? [assertion(firstTravel?.claimId ?? `${id}-travel`, { requirement: travelRequirement, scope: stageScope }, title(travelRequirement), evidenceForClaim(data, sourcePages, "stageTravel", source))] : []), ...(editingStage?.travelRequirements.slice(1) ?? [])],
          };
          let nextCycle = card.cycle;
          if (card.cycle.status === "modeled") {
            const timingRefs = Object.fromEntries(Object.entries(card.cycle.value.timingRefs).map(([key, claimId]) => [key, claimId === timingId ? null : claimId])) as typeof card.cycle.value.timingRefs;
            if (cycleTimingRole) timingRefs[cycleTimingRole as keyof typeof timingRefs] = timingId;
            nextCycle = { ...card.cycle, value: { ...card.cycle.value, timingRefs } };
          }
          return { ...card, cycle: nextCycle, stages: { status: "modeled", note: card.stages.note, records: replaceRecord(stages, "stages", nextStage) } } as OpportunityCard;
        }, "Process stage added.", "Process stage updated.")}>
          {retainedStageClaims ? <p className="structured-retained-note">This compact editor changes the first claim in each stage category. {retainedStageClaims} additional atomic claim{retainedStageClaims === 1 ? " is" : "s are"} retained unchanged.</p> : null}
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-stage-label">Stage label</label><input id="v2-stage-label" name="stageLabel" defaultValue={editingStage?.definition.value.label ?? ""} required /></div>
            <div className="field"><label htmlFor="v2-stage-kind">Kind</label><select id="v2-stage-kind" name="stageKind" defaultValue={editingStage?.definition.value.kind ?? "application"}>{STAGE_KINDS.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-stage-order">Order</label><input id="v2-stage-order" name="stageOrder" type="number" min="1" defaultValue={editingStage?.order ?? stages.length + 1} required /></div>
          </div>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-stage-event">Date meaning (optional)</label><select id="v2-stage-event" name="stageEvent" defaultValue={editingStage?.timings[0]?.status === "disclosed" ? editingStage.timings[0].value.event : ""}><option value="">No date</option>{["opens", "deadline", "starts", "ends", "decision", "notification"].map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-stage-timing-precision">Date precision</label><select id="v2-stage-timing-precision" name="stageTimingPrecision" defaultValue={editingStage?.timings[0]?.status === "disclosed" ? editingStage.timings[0].value.when.precision === "date_time" ? "date" : editingStage.timings[0].value.when.precision : "none"}><option value="none">No date</option><option value="date">Exact date</option><option value="month">Month only</option></select></div>
            <div className="field"><label htmlFor="v2-stage-date">Exact date</label><input id="v2-stage-date" name="stageDate" type="date" defaultValue={editingStage?.timings[0]?.status === "disclosed" && editingStage.timings[0].value.when.precision === "date" ? editingStage.timings[0].value.when.date : ""} /></div>
            <div className="field"><label htmlFor="v2-stage-month">Month</label><input id="v2-stage-month" name="stageMonth" type="month" defaultValue={editingStage?.timings[0]?.status === "disclosed" && editingStage.timings[0].value.when.precision === "month" ? `${editingStage.timings[0].value.when.year}-${String(editingStage.timings[0].value.when.month).padStart(2, "0")}` : ""} /></div>
            <div className="field"><label htmlFor="v2-stage-certainty">Date certainty</label><select id="v2-stage-certainty" name="stageTimingCertainty" defaultValue={editingStage?.timings[0]?.status === "disclosed" ? editingStage.timings[0].value.when.certainty : "stated"}><option value="stated">Stated</option><option value="expected">Expected</option></select></div>
            <div className="field"><label htmlFor="v2-stage-cycle-role">Cycle date role (optional)</label><select id="v2-stage-cycle-role" name="cycleTimingRole" defaultValue={card.cycle.status === "modeled" && editingStage?.timings[0] ? Object.entries(card.cycle.value.timingRefs).find(([, claimId]) => claimId === editingStage.timings[0]?.claimId)?.[0] ?? "" : ""}><option value="">Stage-only date</option><option value="opens">Cycle opens</option><option value="closes">Cycle closes</option><option value="coverageStart">Participation starts</option><option value="coverageEnd">Participation ends</option></select></div>
          </div>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-stage-duration-minimum">Duration minimum (optional)</label><input id="v2-stage-duration-minimum" name="stageDurationMinimum" type="number" min="0" step="0.1" defaultValue={editingStage?.durations[0]?.status === "disclosed" ? editingStage.durations[0].value.duration.minimum : undefined} /></div>
            <div className="field"><label htmlFor="v2-stage-duration-maximum">Duration maximum (optional)</label><input id="v2-stage-duration-maximum" name="stageDurationMaximum" type="number" min="0" step="0.1" defaultValue={editingStage?.durations[0]?.status === "disclosed" ? editingStage.durations[0].value.duration.maximum ?? undefined : undefined} /></div>
            <div className="field"><label htmlFor="v2-stage-duration-unit">Duration unit</label><select id="v2-stage-duration-unit" name="stageDurationUnit" defaultValue={editingStage?.durations[0]?.status === "disclosed" ? editingStage.durations[0].value.duration.unit : "weeks"}>{["hours", "days", "weeks", "months"].map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-stage-format">Format (optional)</label><select id="v2-stage-format" name="stageFormat" defaultValue={editingStage?.formats[0]?.status === "disclosed" ? editingStage.formats[0].value.formats[0] : ""}><option value="">Not stated</option>{["online", "in_person", "hybrid", "residential", "commuter"].map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-stage-location">Location (optional)</label><input id="v2-stage-location" name="stageLocation" defaultValue={editingStage?.locations[0]?.status === "disclosed" ? editingStage.locations[0].value.location : ""} /></div>
          </div>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-stage-time-minimum">Minimum hours (optional)</label><input id="v2-stage-time-minimum" name="stageTimeMinimum" type="number" min="0" step="0.1" defaultValue={editingStage?.timeCommitments[0]?.status === "disclosed" ? editingStage.timeCommitments[0].value.minimumHours : undefined} /></div>
            <div className="field"><label htmlFor="v2-stage-time-maximum">Maximum hours (optional)</label><input id="v2-stage-time-maximum" name="stageTimeMaximum" type="number" min="0" step="0.1" defaultValue={editingStage?.timeCommitments[0]?.status === "disclosed" ? editingStage.timeCommitments[0].value.maximumHours ?? undefined : undefined} /></div>
            <div className="field"><label htmlFor="v2-stage-time-period">Hours per</label><select id="v2-stage-time-period" name="stageTimePeriod" defaultValue={editingStage?.timeCommitments[0]?.status === "disclosed" ? editingStage.timeCommitments[0].value.period : "week"}><option value="total">Total</option><option value="day">Day</option><option value="week">Week</option></select></div>
            <div className="field"><label htmlFor="v2-stage-time-label">Source-stated commitment label</label><input id="v2-stage-time-label" name="stageTimeLabel" placeholder="5–10 hours per week" defaultValue={editingStage?.timeCommitments[0]?.status === "disclosed" ? editingStage.timeCommitments[0].value.label : ""} /></div>
          </div>
          <div className="field"><label htmlFor="v2-stage-selection-rule">Selection rule (optional)</label><textarea id="v2-stage-selection-rule" name="stageSelectionRule" defaultValue={editingStage?.selectionRules[0]?.status === "disclosed" ? editingStage.selectionRules[0].value.rule : ""} /></div>
          <div className="field-grid"><div className="field"><label htmlFor="v2-stage-advancement-count">Advancement count (optional)</label><input id="v2-stage-advancement-count" name="stageAdvancementCount" type="number" min="1" defaultValue={editingStage?.advancement[0]?.status === "disclosed" ? editingStage.advancement[0].value.count ?? undefined : undefined} /></div><div className="field"><label htmlFor="v2-stage-advancement-description">Advancement description</label><input id="v2-stage-advancement-description" name="stageAdvancementDescription" defaultValue={editingStage?.advancement[0]?.status === "disclosed" ? editingStage.advancement[0].value.description : ""} /></div></div>
          <div className="field"><label htmlFor="v2-stage-requirement">Participant requirement (optional)</label><textarea id="v2-stage-requirement" name="stageRequirement" defaultValue={editingStage?.requirements[0]?.value.requirement ?? ""} /></div>
          <div className="field"><label htmlFor="v2-stage-travel">Travel/attendance requirement</label><select id="v2-stage-travel" name="stageTravelRequirement" defaultValue={editingStage?.travelRequirements[0]?.status === "disclosed" ? editingStage.travelRequirements[0].value.requirement : ""}><option value="">Not stated</option><option value="none">None</option><option value="conditional">Conditional</option><option value="required">Required</option></select></div>
          <ScopeFields card={card} id="v2-stage-scope" defaultScope={editingStage?.definition.value.scope} />
          <EvidenceFields sourcePages={sourcePages} id="v2-stage" label="Stage definition evidence" defaultSourceId={editingStage?.definition.sources[0]?.id} defaultExcerpt={editingStage?.definition.sources[0]?.excerpt} />
          {[{ prefix: "stageTiming", label: "Stage timing", claim: editingStage?.timings[0] }, { prefix: "stageDuration", label: "Duration", claim: editingStage?.durations[0] }, { prefix: "stageTime", label: "Time commitment", claim: editingStage?.timeCommitments[0] }, { prefix: "stageFormat", label: "Format", claim: editingStage?.formats[0] }, { prefix: "stageLocation", label: "Location", claim: editingStage?.locations[0] }, { prefix: "stageSelection", label: "Selection rule", claim: editingStage?.selectionRules[0] }, { prefix: "stageAdvancement", label: "Advancement", claim: editingStage?.advancement[0] }, { prefix: "stageRequirement", label: "Requirement", claim: editingStage?.requirements[0] }, { prefix: "stageTravel", label: "Travel requirement", claim: editingStage?.travelRequirements[0] }].map(({ prefix, label: claimLabel, claim }) => <ClaimEvidenceFields key={prefix} sourcePages={sourcePages} id={`v2-${prefix}-evidence`} prefix={prefix} label={claimLabel} defaultSourceId={claim?.sources[0]?.id} defaultExcerpt={claim?.sources[0]?.excerpt} />)}
          {formActions(Boolean(editingStage), "Add stage")}
        </form>
        <div className="divider" />
        <div className="structured-builder-section-heading"><strong>{pathways.length} pathway{pathways.length === 1 ? "" : "s"}</strong><AssessmentControls card={card} collectionKey="pathways" label="Selection pathways" onCommit={onCommit} /></div>
        {pathways.length ? <ul className="structured-builder-records">{pathways.map((pathway) => <li key={pathway.id}><span><strong>{pathway.definition.value.label}</strong><small>{pathway.steps.length} ordered stages</small></span>{editActions("pathways", pathway.id, () => removeRecord("pathways", pathway.id, pathway.definition.value.label))}</li>)}</ul> : null}
        {stages.length ? (
          <form className="stack" key={editingPathway?.id ?? "new-pathway"} onSubmit={(event) => recordSubmit(event, "pathways", (data, source) => {
            const id = editingPathway?.id ?? nextId("pathway");
            const label = String(data.get("pathwayLabel") ?? "").trim();
            const stageIds = data.getAll("pathwayStageIds").map(String);
            if (!stageIds.length) throw new Error("Choose at least one stage for the pathway.");
            const orderedStageIds = [...stages].sort((a, b) => a.order - b.order).map((stage) => stage.id).filter((stageId) => stageIds.includes(stageId));
            const nextPathway = { id, definition: assertion(editingPathway?.definition.claimId ?? `${id}-definition`, { label, variantIds: data.getAll("pathwayVariantIds").map(String) }, label, source), steps: orderedStageIds.map((stageId, index) => {
              const existingStep = editingPathway?.steps.find((step) => step.value.stageId === stageId);
              const condition = String(data.get(`pathwayCondition-${stageId}`) ?? "").trim() || null;
              const stepSource = evidenceForClaim(data, sourcePages, `pathwayStep${stageId}`, source);
              return assertion(existingStep?.claimId ?? `${id}-step-${index + 1}`, { stageId, enterWhen: condition }, stages.find((stage) => stage.id === stageId)?.definition.value.label ?? stageId, stepSource);
            }) };
            return { ...card, pathways: { status: "modeled", note: card.pathways.note, records: replaceRecord(pathways, "pathways", nextPathway) } } as OpportunityCard;
          }, "Selection pathway added.", "Selection pathway updated.")}>
            <div className="field"><label htmlFor="v2-pathway-label">Pathway label</label><input id="v2-pathway-label" name="pathwayLabel" defaultValue={editingPathway?.definition.value.label ?? ""} required /></div>
            <fieldset className="structured-pathway-steps"><legend>Stages in this path</legend><p className="field-help">Check each stage in the branch. Conditions and evidence belong to that step only.</p>{[...stages].sort((a, b) => a.order - b.order).map((stage) => {
              const step = editingPathway?.steps.find((candidate) => candidate.value.stageId === stage.id);
              return <div className="structured-pathway-step-editor" key={stage.id}><label><input type="checkbox" name="pathwayStageIds" value={stage.id} defaultChecked={Boolean(step)} /> <strong>{stage.order}. {stage.definition.value.label}</strong></label><div className="field"><label htmlFor={`v2-pathway-condition-${stage.id}`}>Entry/advancement condition (optional)</label><textarea id={`v2-pathway-condition-${stage.id}`} name={`pathwayCondition-${stage.id}`} defaultValue={step?.value.enterWhen ?? ""} /></div><ClaimEvidenceFields sourcePages={sourcePages} id={`v2-pathway-step-${stage.id}-evidence`} prefix={`pathwayStep${stage.id}`} label={`${stage.definition.value.label} step`} defaultSourceId={step?.sources[0]?.id} defaultExcerpt={step?.sources[0]?.excerpt} /></div>;
            })}</fieldset>
            {variants.length ? <div className="field"><label htmlFor="v2-pathway-variants">Limited to program options (optional)</label><select id="v2-pathway-variants" name="pathwayVariantIds" multiple size={Math.min(4, variants.length)} defaultValue={editingPathway?.definition.value.variantIds ?? []}>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.definition.value.label}</option>)}</select></div> : null}
            <EvidenceFields sourcePages={sourcePages} id="v2-pathway" label="Pathway definition evidence" defaultSourceId={editingPathway?.definition.sources[0]?.id} defaultExcerpt={editingPathway?.definition.sources[0]?.excerpt} />
            {formActions(Boolean(editingPathway), "Add pathway")}
          </form>
        ) : <p className="field-help">Add stages before defining a pathway.</p>}
      </TaskSection>

      <TaskSection number="05" title="Costs and aid" description="Scoped charges, conditions, credits, and refund status.">
        <div className="structured-builder-section-heading"><strong>{costs.length} cost item{costs.length === 1 ? "" : "s"}</strong><AssessmentControls card={card} collectionKey="costItems" label="Cost items" onCommit={onCommit} /></div>
        {costs.length ? <ul className="structured-builder-records">{costs.map((cost) => <li key={cost.id}><span><strong>{cost.definition.value.label}</strong><small>{cost.amount.displayValue ?? cost.amount.note}</small></span>{editActions("costItems", cost.id, () => removeRecord("costItems", cost.id, cost.definition.value.label))}</li>)}</ul> : null}
        <form className="stack" key={editingCost?.id ?? "new-cost"} onSubmit={(event) => recordSubmit(event, "costItems", (data, source) => {
          const id = editingCost?.id ?? nextId("cost");
          const label = String(data.get("costLabel") ?? "").trim();
          const kind = String(data.get("costKind") ?? "tuition") as (typeof COST_KINDS)[number];
          const requirement = String(data.get("costRequirement") ?? "required") as (typeof COST_REQUIREMENTS)[number];
          const chargeBasis = String(data.get("costChargeBasis") ?? "") as "" | "per_application" | "per_participant" | "per_team" | "per_traveler";
          const amountKind = String(data.get("costAmountKind") ?? "not_found");
          const amountText = String(data.get("costAmount") ?? "").trim();
          const maximumText = String(data.get("costMaximum") ?? "").trim();
          const currency = String(data.get("costCurrency") ?? "USD").toUpperCase();
          const amount = amountKind !== "not_found" && amountText ? Number(amountText) : null;
          const maximum = amountKind === "range" && maximumText ? Number(maximumText) : null;
          const refund = String(data.get("costRefund") ?? "unknown");
          const creditedTargets = data.getAll("costCreditTargets").map(String);
          const refundCondition = String(data.get("costRefundCondition") ?? "").trim();
          const condition = String(data.get("costCondition") ?? "").trim();
          const included = String(data.get("costIncluded") ?? "").trim();
          const excluded = String(data.get("costExcluded") ?? "").trim();
          const completeness = String(data.get("costCompleteness") ?? "incomplete") as "complete" | "incomplete";
          if (amountKind !== "not_found" && (amount === null || !Number.isFinite(amount) || amount < 0)) throw new Error("Enter a nonnegative cost amount.");
          if (amountKind === "range" && (maximum === null || !Number.isFinite(maximum) || maximum < (amount ?? 0))) throw new Error("Enter a range maximum at least as large as the minimum.");
          if (refund === "conditional" && !refundCondition) throw new Error("A conditional refund needs its source-stated condition.");
          const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 });
          const amountSource = evidenceForClaim(data, sourcePages, "costAmount", source);
          const amountClaim = amountKind === "not_found" || amount === null
            ? notFound(editingCost?.amount.claimId ?? `${id}-amount`, "The checked source identifies this cost but does not state one amount.")
            : amountKind === "range" && maximum !== null
              ? assertion(editingCost?.amount.claimId ?? `${id}-amount`, { kind: "range" as const, minimum: amount, maximum, currency }, `${moneyFormat.format(amount)}–${moneyFormat.format(maximum)}`, amountSource)
              : assertion(editingCost?.amount.claimId ?? `${id}-amount`, { kind: "exact" as const, amount, currency }, moneyFormat.format(amount), amountSource);
          const nextCost = {
            id,
            definition: assertion(editingCost?.definition.claimId ?? `${id}-definition`, { label, kind, requirement, scope: scopeFromForm(data) }, label, source),
            amount: amountClaim,
            chargeBasis: chargeBasis ? assertion(editingCost?.chargeBasis?.claimId ?? `${id}-basis`, chargeBasis, title(chargeBasis), evidenceForClaim(data, sourcePages, "costBasis", source)) : null,
            treatment: creditedTargets.length ? assertion(editingCost?.treatment?.claimId ?? `${id}-treatment`, { kind: "credited_to_tuition" as const, targetCostItemIds: creditedTargets }, "Credited toward tuition", evidenceForClaim(data, sourcePages, "costTreatment", source)) : null,
            refundability: refund === "not_assessed" ? null : refund === "unknown" ? notFound(editingCost?.refundability?.claimId ?? `${id}-refund`, "Refundability was not found in the checked sources.") : assertion(editingCost?.refundability?.claimId ?? `${id}-refund`, { kind: refund as "refundable" | "nonrefundable" | "conditional", condition: refundCondition || null }, title(refund), evidenceForClaim(data, sourcePages, "costRefund", source)),
            includedItems: [...(included ? [assertion(editingCost?.includedItems[0]?.claimId ?? `${id}-included`, included, included, evidenceForClaim(data, sourcePages, "costIncluded", source))] : []), ...(editingCost?.includedItems.slice(1) ?? [])],
            excludedItems: [...(excluded ? [assertion(editingCost?.excludedItems[0]?.claimId ?? `${id}-excluded`, excluded, excluded, evidenceForClaim(data, sourcePages, "costExcluded", source))] : []), ...(editingCost?.excludedItems.slice(1) ?? [])],
            conditions: [...(condition ? [assertion(editingCost?.conditions[0]?.claimId ?? `${id}-condition`, condition, condition, evidenceForClaim(data, sourcePages, "costCondition", source))] : []), ...(editingCost?.conditions.slice(1) ?? [])],
          };
          return { ...card, costItems: { status: "modeled", note: card.costItems.note, completeness, records: replaceRecord(costs, "costItems", nextCost) } } as OpportunityCard;
        }, "Cost item added.", "Cost item updated.")}>
          {retainedCostClaims ? <p className="structured-retained-note">This compact editor changes the first included, excluded, and general-condition claim. {retainedCostClaims} additional atomic claim{retainedCostClaims === 1 ? " is" : "s are"} retained unchanged.</p> : null}
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-cost-label">Cost label</label><input id="v2-cost-label" name="costLabel" defaultValue={editingCost?.definition.value.label ?? ""} required /></div>
            <div className="field"><label htmlFor="v2-cost-kind">Type</label><select id="v2-cost-kind" name="costKind" defaultValue={editingCost?.definition.value.kind ?? "tuition"}>{COST_KINDS.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-cost-requirement">Requirement</label><select id="v2-cost-requirement" name="costRequirement" defaultValue={editingCost?.definition.value.requirement ?? "required"}>{COST_REQUIREMENTS.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-cost-basis">Charge basis (optional)</label><select id="v2-cost-basis" name="costChargeBasis" defaultValue={editingCost?.chargeBasis?.status === "disclosed" ? editingCost.chargeBasis.value : ""}><option value="">Not stated</option><option value="per_application">Per application</option><option value="per_participant">Per participant</option><option value="per_team">Per team</option><option value="per_traveler">Per traveler</option></select></div>
            <div className="field"><label htmlFor="v2-cost-completeness">Reviewed inventory</label><select id="v2-cost-completeness" name="costCompleteness" defaultValue={card.costItems.status === "modeled" ? card.costItems.completeness : "incomplete"}><option value="incomplete">Incomplete — more charges may exist</option><option value="complete">Complete — all applicable charges assessed</option></select></div>
          </div>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-cost-amount-kind">Amount status</label><select id="v2-cost-amount-kind" name="costAmountKind" defaultValue={editingCost?.amount.status === "disclosed" ? editingCost.amount.value.kind : "not_found"}><option value="not_found">Not found</option><option value="exact">Exact</option><option value="range">Range</option></select></div>
            <div className="field"><label htmlFor="v2-cost-amount">Amount or range minimum</label><input id="v2-cost-amount" name="costAmount" type="number" min="0" step="0.01" defaultValue={editingCost?.amount.status === "disclosed" ? editingCost.amount.value.kind === "exact" ? editingCost.amount.value.amount : editingCost.amount.value.minimum : undefined} /></div>
            <div className="field"><label htmlFor="v2-cost-maximum">Range maximum</label><input id="v2-cost-maximum" name="costMaximum" type="number" min="0" step="0.01" defaultValue={editingCost?.amount.status === "disclosed" && editingCost.amount.value.kind === "range" ? editingCost.amount.value.maximum : undefined} /></div>
            <div className="field"><label htmlFor="v2-cost-currency">Currency</label><input id="v2-cost-currency" name="costCurrency" defaultValue={editingCost?.amount.status === "disclosed" ? editingCost.amount.value.currency : "USD"} pattern="[A-Z]{3}" maxLength={3} /></div>
            <div className="field"><label htmlFor="v2-cost-refund">Refund status</label><select id="v2-cost-refund" name="costRefund" defaultValue={editingCost?.refundability ? editingCost.refundability.status === "disclosed" ? editingCost.refundability.value.kind : "unknown" : "not_assessed"}><option value="not_assessed">Not assessed</option><option value="unknown">Reviewed; not found</option><option value="refundable">Refundable</option><option value="nonrefundable">Nonrefundable</option><option value="conditional">Conditional</option></select></div>
          </div>
          <div className="field"><label htmlFor="v2-cost-refund-condition">Refund condition (only when stated)</label><textarea id="v2-cost-refund-condition" name="costRefundCondition" defaultValue={editingCost?.refundability?.status === "disclosed" ? editingCost.refundability.value.condition ?? "" : ""} /></div>
          <div className="field"><label htmlFor="v2-cost-condition">General condition (optional)</label><textarea id="v2-cost-condition" name="costCondition" defaultValue={editingCost?.conditions[0]?.value ?? ""} /></div>
          <div className="field-grid"><div className="field"><label htmlFor="v2-cost-included">Included item (optional)</label><textarea id="v2-cost-included" name="costIncluded" defaultValue={editingCost?.includedItems[0]?.value ?? ""} /></div><div className="field"><label htmlFor="v2-cost-excluded">Excluded item (optional)</label><textarea id="v2-cost-excluded" name="costExcluded" defaultValue={editingCost?.excludedItems[0]?.value ?? ""} /></div></div>
          {costs.some((cost) => cost.definition.value.kind === "tuition") ? <div className="field"><label htmlFor="v2-cost-credit-targets">Credited toward tuition items (optional)</label><select id="v2-cost-credit-targets" name="costCreditTargets" multiple size={Math.min(4, costs.length)} defaultValue={editingCost?.treatment?.status === "disclosed" ? editingCost.treatment.value.targetCostItemIds : []}>{costs.filter((cost) => cost.definition.value.kind === "tuition" && cost.id !== editingCost?.id).map((cost) => <option key={cost.id} value={cost.id}>{cost.definition.value.label}</option>)}</select></div> : null}
          <ScopeFields card={card} id="v2-cost-scope" defaultScope={editingCost?.definition.value.scope} />
          <EvidenceFields sourcePages={sourcePages} id="v2-cost" label="Cost definition evidence" defaultSourceId={editingCost?.definition.sources[0]?.id} defaultExcerpt={editingCost?.definition.sources[0]?.excerpt} />
          {[{ prefix: "costAmount", label: "Amount", claim: editingCost?.amount }, { prefix: "costBasis", label: "Charge basis", claim: editingCost?.chargeBasis }, { prefix: "costTreatment", label: "Credit treatment", claim: editingCost?.treatment }, { prefix: "costRefund", label: "Refundability", claim: editingCost?.refundability }, { prefix: "costIncluded", label: "Included item", claim: editingCost?.includedItems[0] }, { prefix: "costExcluded", label: "Excluded item", claim: editingCost?.excludedItems[0] }, { prefix: "costCondition", label: "General condition", claim: editingCost?.conditions[0] }].map(({ prefix, label: claimLabel, claim }) => <ClaimEvidenceFields key={prefix} sourcePages={sourcePages} id={`v2-${prefix}-evidence`} prefix={prefix} label={claimLabel} defaultSourceId={claim?.sources[0]?.id} defaultExcerpt={claim?.sources[0]?.excerpt} />)}
          {formActions(Boolean(editingCost), "Add cost item")}
        </form>
      </TaskSection>

      <TaskSection number="06" title="Outcomes and prizes" description="Separate cash, project funding, tuition, and in-kind benefits.">
        <div className="structured-builder-section-heading"><strong>{outcomes.length} outcome{outcomes.length === 1 ? "" : "s"}</strong><AssessmentControls card={card} collectionKey="outcomes" label="Outcomes" onCommit={onCommit} /></div>
        {outcomes.length ? <ul className="structured-builder-records">{outcomes.map((outcome) => <li key={outcome.id}><span><strong>{outcome.definition.value.label}</strong><small>{title(outcome.definition.value.outcomeType)} · {outcome.recipientScope.displayValue ?? outcome.recipientScope.note}</small></span>{editActions("outcomes", outcome.id, () => removeRecord("outcomes", outcome.id, outcome.definition.value.label))}</li>)}</ul> : null}
        <form className="stack" key={editingOutcome?.id ?? "new-outcome"} onSubmit={(event) => recordSubmit(event, "outcomes", (data, source) => {
          const id = editingOutcome?.id ?? nextId("outcome");
          const label = String(data.get("outcomeLabel") ?? "").trim();
          const outcomeType = String(data.get("outcomeType") ?? "other") as (typeof OUTCOME_TYPES)[number];
          const requestedRecipient = String(data.get("outcomeRecipient") ?? "");
          const recipientDefaults: Partial<Record<(typeof OUTCOME_TYPES)[number], (typeof RECIPIENT_SCOPES)[number]>> = { personal_cash_prize: "individual", team_cash_prize: "team", project_budget: "project" };
          const recipient = requestedRecipient || recipientDefaults[outcomeType] || "individual";
          const requestedNature = String(data.get("outcomeNature") ?? "");
          const nature = requestedNature || (outcomeType === "personal_cash_prize" || outcomeType === "team_cash_prize" || outcomeType === "stipend" ? "cash" : outcomeType === "project_budget" ? "restricted_funding" : outcomeType === "reimbursement" ? "reimbursement" : "not_monetized");
          const amountStatus = String(data.get("outcomeAmountStatus") ?? "none");
          const amountText = String(data.get("outcomeAmount") ?? "").trim();
          const maximumText = String(data.get("outcomeMaximum") ?? "").trim();
          const currency = String(data.get("outcomeCurrency") ?? "USD").toUpperCase();
          const amount = amountStatus === "exact" || amountStatus === "range" ? Number(amountText) : null;
          const maximum = amountStatus === "range" ? Number(maximumText) : null;
          const restriction = String(data.get("outcomeRestriction") ?? "").trim();
          const rankLabel = String(data.get("outcomeRankLabel") ?? "").trim();
          const rankOrdinalText = String(data.get("outcomeRankOrdinal") ?? "").trim();
          const track = String(data.get("outcomeTrack") ?? "").trim();
          const payee = String(data.get("outcomePayee") ?? "");
          const distributionMethod = String(data.get("outcomeDistributionMethod") ?? "");
          const distributionCondition = String(data.get("outcomeDistributionCondition") ?? "").trim() || null;
          const quantityMinimumText = String(data.get("outcomeQuantityMinimum") ?? "").trim();
          const quantityMaximumText = String(data.get("outcomeQuantityMaximum") ?? "").trim();
          const quantityUnit = String(data.get("outcomeQuantityUnit") ?? "items") as "sessions" | "credits" | "seats" | "flights" | "items";
          const combinability = String(data.get("outcomeCombinability") ?? "") as "" | "combinable" | "exclusive";
          const condition = String(data.get("outcomeCondition") ?? "").trim();
          if (outcomeType === "project_budget" && !restriction) throw new Error("Restricted project funding needs the source-stated use restriction.");
          if ((amountStatus === "exact" || amountStatus === "range") && (!Number.isFinite(amount) || amount === null || amount < 0)) throw new Error("Enter a nonnegative monetary amount.");
          if (amountStatus === "range" && (!Number.isFinite(maximum) || maximum === null || maximum < (amount ?? 0))) throw new Error("Enter an outcome range maximum at least as large as the minimum.");
          const quantityMinimum = quantityMinimumText ? Number(quantityMinimumText) : null;
          const quantityMaximum = quantityMaximumText ? Number(quantityMaximumText) : null;
          if (quantityMinimum !== null && (!Number.isFinite(quantityMinimum) || quantityMinimum < 0)) throw new Error("Enter a nonnegative outcome quantity.");
          if (quantityMaximum !== null && (quantityMinimum === null || !Number.isFinite(quantityMaximum) || quantityMaximum < quantityMinimum)) throw new Error("Enter a quantity maximum at least as large as the minimum.");
          const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 });
          const amountClaim = amountStatus === "not_found"
            ? notFound(editingOutcome?.amount?.claimId ?? `${id}-amount`, "An outcome is stated, but its monetary amount was not found.")
            : amountStatus === "range" && amount !== null && maximum !== null
              ? assertion(editingOutcome?.amount?.claimId ?? `${id}-amount`, { kind: "range" as const, minimum: amount, maximum, currency }, `${moneyFormat.format(amount)}–${moneyFormat.format(maximum)}`, evidenceForClaim(data, sourcePages, "outcomeAmount", source))
              : amountStatus === "exact" && amount !== null
                ? assertion(editingOutcome?.amount?.claimId ?? `${id}-amount`, { kind: "exact" as const, amount, currency }, moneyFormat.format(amount), evidenceForClaim(data, sourcePages, "outcomeAmount", source))
                : null;
          const recipientSource = evidenceForClaim(data, sourcePages, "outcomeRecipient", source);
          const recipientClaim = recipient === "unclear" ? unclear(editingOutcome?.recipientScope.claimId ?? `${id}-recipient`, "The checked source does not make the recipient scope precise.", recipientSource) : assertion(editingOutcome?.recipientScope.claimId ?? `${id}-recipient`, recipient as (typeof RECIPIENT_SCOPES)[number], title(recipient), recipientSource);
          const rankOrdinal = rankOrdinalText ? Number(rankOrdinalText) : null;
          if (rankOrdinal !== null && (!Number.isInteger(rankOrdinal) || rankOrdinal < 1 || !rankLabel)) throw new Error("A rank number needs a positive whole number and placement label.");
          const existingDistribution = editingOutcome?.distribution?.status === "disclosed" ? editingOutcome.distribution.value : [];
          const nextOutcome = {
            id,
            definition: assertion(editingOutcome?.definition.claimId ?? `${id}-definition`, { label, outcomeType, scope: scopeFromForm(data) }, label, source),
            recipientScope: recipientClaim,
            monetaryNature: assertion(editingOutcome?.monetaryNature?.claimId ?? `${id}-nature`, nature as "cash" | "restricted_funding" | "reimbursement" | "source_stated_estimated_value" | "not_monetized", title(nature), evidenceForClaim(data, sourcePages, "outcomeNature", source)),
            amount: amountClaim,
            distribution: payee && distributionMethod ? assertion(editingOutcome?.distribution?.claimId ?? `${id}-distribution`, [{ payee: payee as "participant" | "team" | "registered_venture" | "service_provider", method: distributionMethod as "direct" | "equal_split" | "shared", condition: distributionCondition }, ...existingDistribution.slice(1)], `${title(distributionMethod)} to ${title(payee)}${distributionCondition ? ` — ${distributionCondition}` : ""}`, evidenceForClaim(data, sourcePages, "outcomeDistribution", source)) : null,
            rank: rankLabel ? assertion(editingOutcome?.rank?.claimId ?? `${id}-rank`, { ordinal: rankOrdinal, label: rankLabel }, rankLabel, evidenceForClaim(data, sourcePages, "outcomeRank", source)) : null,
            track: track ? assertion(editingOutcome?.track?.claimId ?? `${id}-track`, track, track, evidenceForClaim(data, sourcePages, "outcomeTrack", source)) : null,
            quantity: quantityMinimum !== null ? assertion(editingOutcome?.quantity?.claimId ?? `${id}-quantity`, { minimum: quantityMinimum, maximum: quantityMaximum, unit: quantityUnit }, `${quantityMinimum}${quantityMaximum !== null ? `–${quantityMaximum}` : ""} ${title(quantityUnit).toLowerCase()}`, evidenceForClaim(data, sourcePages, "outcomeQuantity", source)) : null,
            useRestriction: restriction ? assertion(editingOutcome?.useRestriction?.claimId ?? `${id}-restriction`, restriction, restriction, evidenceForClaim(data, sourcePages, "outcomeRestriction", source)) : null,
            combinability: combinability ? assertion(editingOutcome?.combinability?.claimId ?? `${id}-combinability`, combinability, title(combinability), evidenceForClaim(data, sourcePages, "outcomeCombinability", source)) : null,
            conditions: [...(condition ? [assertion(editingOutcome?.conditions[0]?.claimId ?? `${id}-condition`, condition, condition, evidenceForClaim(data, sourcePages, "outcomeCondition", source))] : []), ...(editingOutcome?.conditions.slice(1) ?? [])],
          };
          return { ...card, outcomes: { status: "modeled", note: card.outcomes.note, records: replaceRecord(outcomes, "outcomes", nextOutcome) } } as OpportunityCard;
        }, "Outcome added with recipient and monetary type kept explicit.", "Outcome updated with recipient and monetary type kept explicit.")}>
          {retainedOutcomeClaims ? <p className="structured-retained-note">This compact editor changes the first distribution and general-condition entry. {retainedOutcomeClaims} additional atomic entr{retainedOutcomeClaims === 1 ? "y is" : "ies are"} retained unchanged.</p> : null}
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-outcome-label">Outcome label</label><input id="v2-outcome-label" name="outcomeLabel" defaultValue={editingOutcome?.definition.value.label ?? ""} required /></div>
            <div className="field"><label htmlFor="v2-outcome-type">Outcome type</label><select id="v2-outcome-type" name="outcomeType" defaultValue={editingOutcome?.definition.value.outcomeType ?? "other"}>{OUTCOME_TYPES.map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div>
            <div className="field"><label htmlFor="v2-outcome-recipient">Recipient</label><select id="v2-outcome-recipient" name="outcomeRecipient" defaultValue={editingOutcome?.recipientScope.status === "disclosed" ? editingOutcome.recipientScope.value : editingOutcome ? "unclear" : ""}><option value="">Use outcome-type default</option>{RECIPIENT_SCOPES.map((value) => <option key={value} value={value}>{title(value)}</option>)}<option value="unclear">Unclear</option></select></div>
            <div className="field"><label htmlFor="v2-outcome-nature">Monetary nature</label><select id="v2-outcome-nature" name="outcomeNature" defaultValue={editingOutcome?.monetaryNature?.status === "disclosed" ? editingOutcome.monetaryNature.value : ""}><option value="">Use outcome-type default</option><option value="cash">Cash</option><option value="restricted_funding">Restricted funding</option><option value="reimbursement">Reimbursement</option><option value="source_stated_estimated_value">Source-stated estimated value</option><option value="not_monetized">Not monetized</option></select></div>
          </div>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-outcome-amount-status">Amount</label><select id="v2-outcome-amount-status" name="outcomeAmountStatus" defaultValue={editingOutcome?.amount ? editingOutcome.amount.status === "disclosed" ? editingOutcome.amount.value.kind : "not_found" : "none"}><option value="none">No monetary amount</option><option value="exact">Exact amount</option><option value="range">Amount range</option><option value="not_found">Outcome stated; amount not found</option></select></div>
            <div className="field"><label htmlFor="v2-outcome-amount">Amount or range minimum</label><input id="v2-outcome-amount" name="outcomeAmount" type="number" min="0" step="0.01" defaultValue={editingOutcome?.amount?.status === "disclosed" ? editingOutcome.amount.value.kind === "exact" ? editingOutcome.amount.value.amount : editingOutcome.amount.value.minimum : undefined} /></div>
            <div className="field"><label htmlFor="v2-outcome-maximum">Range maximum</label><input id="v2-outcome-maximum" name="outcomeMaximum" type="number" min="0" step="0.01" defaultValue={editingOutcome?.amount?.status === "disclosed" && editingOutcome.amount.value.kind === "range" ? editingOutcome.amount.value.maximum : undefined} /></div>
            <div className="field"><label htmlFor="v2-outcome-currency">Currency</label><input id="v2-outcome-currency" name="outcomeCurrency" defaultValue={editingOutcome?.amount?.status === "disclosed" ? editingOutcome.amount.value.currency : "USD"} pattern="[A-Z]{3}" maxLength={3} /></div>
          </div>
          <div className="field"><label htmlFor="v2-outcome-restriction">Use restriction (required for project funding)</label><textarea id="v2-outcome-restriction" name="outcomeRestriction" defaultValue={editingOutcome?.useRestriction?.status === "disclosed" ? editingOutcome.useRestriction.value : ""} /></div>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-outcome-rank-label">Rank/placement (optional)</label><input id="v2-outcome-rank-label" name="outcomeRankLabel" placeholder="1st place" defaultValue={editingOutcome?.rank?.status === "disclosed" ? editingOutcome.rank.value.label : ""} /></div>
            <div className="field"><label htmlFor="v2-outcome-rank-ordinal">Rank number (optional)</label><input id="v2-outcome-rank-ordinal" name="outcomeRankOrdinal" type="number" min="1" defaultValue={editingOutcome?.rank?.status === "disclosed" ? editingOutcome.rank.value.ordinal ?? undefined : undefined} /></div>
            <div className="field"><label htmlFor="v2-outcome-track">Track/category label (optional)</label><input id="v2-outcome-track" name="outcomeTrack" defaultValue={editingOutcome?.track?.status === "disclosed" ? editingOutcome.track.value : ""} /></div>
          </div>
          <div className="field-grid">
            <div className="field"><label htmlFor="v2-outcome-payee">Distribution payee (optional)</label><select id="v2-outcome-payee" name="outcomePayee" defaultValue={editingOutcome?.distribution?.status === "disclosed" ? editingOutcome.distribution.value[0]?.payee ?? "" : ""}><option value="">Not stated</option><option value="participant">Participant</option><option value="team">Team</option><option value="registered_venture">Registered venture</option><option value="service_provider">Service provider</option></select></div>
            <div className="field"><label htmlFor="v2-outcome-distribution-method">Distribution method</label><select id="v2-outcome-distribution-method" name="outcomeDistributionMethod" defaultValue={editingOutcome?.distribution?.status === "disclosed" ? editingOutcome.distribution.value[0]?.method ?? "" : ""}><option value="">Not stated</option><option value="direct">Direct</option><option value="equal_split">Equal split</option><option value="shared">Shared</option></select></div>
          </div>
          <div className="field"><label htmlFor="v2-outcome-distribution-condition">Distribution condition (optional)</label><textarea id="v2-outcome-distribution-condition" name="outcomeDistributionCondition" defaultValue={editingOutcome?.distribution?.status === "disclosed" ? editingOutcome.distribution.value[0]?.condition ?? "" : ""} /></div>
          <div className="field-grid"><div className="field"><label htmlFor="v2-outcome-quantity-minimum">Quantity minimum (optional)</label><input id="v2-outcome-quantity-minimum" name="outcomeQuantityMinimum" type="number" min="0" step="0.1" defaultValue={editingOutcome?.quantity?.status === "disclosed" ? editingOutcome.quantity.value.minimum : undefined} /></div><div className="field"><label htmlFor="v2-outcome-quantity-maximum">Quantity maximum (optional)</label><input id="v2-outcome-quantity-maximum" name="outcomeQuantityMaximum" type="number" min="0" step="0.1" defaultValue={editingOutcome?.quantity?.status === "disclosed" ? editingOutcome.quantity.value.maximum ?? undefined : undefined} /></div><div className="field"><label htmlFor="v2-outcome-quantity-unit">Quantity unit</label><select id="v2-outcome-quantity-unit" name="outcomeQuantityUnit" defaultValue={editingOutcome?.quantity?.status === "disclosed" ? editingOutcome.quantity.value.unit : "items"}>{["sessions", "credits", "seats", "flights", "items"].map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></div><div className="field"><label htmlFor="v2-outcome-combinability">Can combine with other awards?</label><select id="v2-outcome-combinability" name="outcomeCombinability" defaultValue={editingOutcome?.combinability?.status === "disclosed" ? editingOutcome.combinability.value : ""}><option value="">Not stated</option><option value="combinable">Combinable</option><option value="exclusive">Exclusive</option></select></div></div>
          <div className="field"><label htmlFor="v2-outcome-condition">General award condition (optional)</label><textarea id="v2-outcome-condition" name="outcomeCondition" defaultValue={editingOutcome?.conditions[0]?.value ?? ""} /></div>
          <ScopeFields card={card} id="v2-outcome-scope" defaultScope={editingOutcome?.definition.value.scope} />
          <EvidenceFields sourcePages={sourcePages} id="v2-outcome" label="Outcome definition evidence" defaultSourceId={editingOutcome?.definition.sources[0]?.id} defaultExcerpt={editingOutcome?.definition.sources[0]?.excerpt} />
          {[{ prefix: "outcomeRecipient", label: "Recipient", claim: editingOutcome?.recipientScope }, { prefix: "outcomeNature", label: "Monetary nature", claim: editingOutcome?.monetaryNature }, { prefix: "outcomeAmount", label: "Amount", claim: editingOutcome?.amount }, { prefix: "outcomeDistribution", label: "Distribution", claim: editingOutcome?.distribution }, { prefix: "outcomeRank", label: "Rank", claim: editingOutcome?.rank }, { prefix: "outcomeTrack", label: "Track", claim: editingOutcome?.track }, { prefix: "outcomeQuantity", label: "Quantity", claim: editingOutcome?.quantity }, { prefix: "outcomeRestriction", label: "Use restriction", claim: editingOutcome?.useRestriction }, { prefix: "outcomeCombinability", label: "Combinability", claim: editingOutcome?.combinability }, { prefix: "outcomeCondition", label: "General condition", claim: editingOutcome?.conditions[0] }].map(({ prefix, label: claimLabel, claim }) => <ClaimEvidenceFields key={prefix} sourcePages={sourcePages} id={`v2-${prefix}-evidence`} prefix={prefix} label={claimLabel} defaultSourceId={claim?.sources[0]?.id} defaultExcerpt={claim?.sources[0]?.excerpt} />)}
          {formActions(Boolean(editingOutcome), "Add outcome")}
        </form>
      </TaskSection>
    </section>
  );
}
