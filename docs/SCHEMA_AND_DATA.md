# Schema and data guide

Opportunity Facts uses one strict schema `2.0.0` card contract with two complementary layers:

1. a stable 59-field fact map for scanning, search, baseline comparison, completeness reporting, and compatibility;
2. evidence-bearing structured records for distinctions that cannot be represented truthfully as one scalar.

The schema and typed field registry are authoritative for repository JSON, rendering, comparison, builder import/export, analysis output, public artifacts, and tests. A component must not invent its own field list, structured record, or looser data shape.

## Authoritative files

| Concern | Authority |
| --- | --- |
| Public schema export and compatibility entrypoint | `lib/opportunity/schema.ts` |
| V2 card and cross-record invariants | `lib/opportunity/schema-v2.ts` |
| Atomic claims, scopes, and structured records | `lib/opportunity/structured-schema.ts` |
| V1 import schema | `lib/opportunity/schema-v1.ts` |
| Conservative V1-to-V2 migration | `lib/opportunity/migration.ts` |
| Deterministic V2-to-fact projections | `lib/opportunity/projection.ts` |
| Enumerations and field definitions | `lib/opportunity/fields.ts` |
| Formatted/comparable registry and core assessment count | `lib/opportunity/registry.ts` |
| Opportunity helpers and public TypeScript imports | `lib/opportunity/index.ts` |
| Fictional cards | `data/demo/*.json` |
| Work in progress, never public | `data/drafts/*.json` |
| Human-reviewed/organizer-confirmed cards | `data/opportunities/*.json` |
| Machine-readable JSON Schema | `public/schema/opportunity-card.schema.json` |
| Downloadable public dataset | `public/data/opportunities.json` |
| Exporter | `scripts/export-public-data.ts` / `npm run export:data` |
| Validator | `scripts/validate-data.ts` / `npm run validate:data` |
| Draft generator | `scripts/create-card.ts` / `npm run create:card -- <slug>` |

The exported JSON Schema and dataset are build artifacts and consumer interfaces. Change the TypeScript/Zod authority first, then regenerate them. Do not hand-edit competing schemas.

JSON Schema can express structure but not every Zod cross-field rule. Repository cards and application imports must pass `opportunityCardSchema`, which additionally verifies evidence inventory reuse, globally unique IDs, reference integrity, review-state completeness, and deterministic projection parity.

## Versions and identity

- `schemaVersion` is `2.0.0`. It defines the interpretation and allowed card structure.
- `opportunityId` identifies the continuing opportunity independently of one cycle or public URL slug.
- `cycle.id` plus its source-backed label/status/year claims identifies the reviewed application/cohort/competition cycle.
- `cardVersion` is only the positive-integer revision of that card.
- `slug` is the cycle-specific public record/route key and may change without changing opportunity identity.

A reviewed card requires a non-null cycle-independent `opportunityId` and a modeled cycle. Public artifacts reject duplicate slugs and duplicate normalized `(opportunityId, cycle label)` pairs.

A substantive source, fact, structured-record, or attestation change advances `cardVersion` under the builder/version policy. A schema migration also advances the revision once; it does not turn a revision number into a year or cohort.

## Top-level V2 card

The strict shape is conceptually:

```ts
interface OpportunityCardV2 {
  schemaVersion: "2.0.0";
  opportunityId: string | null;       // required for reviewed/confirmed cards
  cycle: CycleContainer;
  cardVersion: number;
  slug: string;
  summary: string;
  reviewState: ReviewState;
  reviewedAt: string | null;
  sourcePagesChecked: SourcePage[];
  conflicts: CardConflict[];

  organizations: RecordCollection<OrganizationRecord>;
  organizationRoles: RecordCollection<OrganizationRoleRecord>;
  institutionRelationships: RecordCollection<InstitutionRelationshipRecord>;
  variants: RecordCollection<VariantRecord>;
  stages: RecordCollection<StageRecord>;
  pathways: RecordCollection<PathwayRecord>;
  costItems: RecordCollection<CostItemRecord>;
  outcomes: RecordCollection<OutcomeRecord>;

  facts: Record<FieldId, Fact>;        // all 59 fields exactly once
  projectionRefs: Partial<Record<FieldId, ClaimId[]>>;
  migratedFrom: MigrationMetadata | null;
}
```

Zod objects are strict. Unknown top-level or nested keys are rejected rather than silently treated as supported fields.

## Sources and evidence

A checked page contains:

```ts
interface SourcePage {
  id: string;          // lowercase kebab-case, unique within the card
  url: string;         // bounded public HTTP(S), no credentials/sensitive token
  title: string;
  pageType: PageType;
  accessedAt: string;  // RFC 3339 timestamp with offset
}
```

Evidence repeats that metadata and adds an exact `excerpt`. The repeated metadata must exactly match the `sourcePagesChecked` entry with the same ID. Each canonical URL appears once in the inventory under one stable ID.

Allowed page types remain:

- `official_program_page`
- `official_faq`
- `official_cost_page`
- `official_financial_aid_page`
- `official_rules`
- `official_terms`
- `official_privacy_policy`
- `public_record`
- `user_supplied`

Automated URL and pasted-text analysis records `user_supplied`. URL path, branding, or same-origin discovery does not establish official provenance. Human/organizer review may classify attributable sources into an `official_*` category; review state still describes process rather than truth.

Stored URLs must be public HTTP(S), at most 2,048 characters, and free of credentials or token/key/signature/session-like query/fragment parameters. The stored-link check rejects literal non-public/service addresses and obvious local/metadata hostnames. Server acquisition separately applies DNS/address, redirect, timeout, byte, and content-type controls described in [`THREAT_MODEL.md`](./THREAT_MODEL.md).

Every displayed factual value requires evidence. Automated candidates have an additional gate: the excerpt must match normalized acquired source text before the value can be shown as supported.

## Atomic structured claims

Structured evidence belongs to each independently reviewable semantic assertion, not merely to a parent object. Each claim has a globally unique `claimId` and one of the same five evidence states. Its typed payload may bind inseparable fields supported by the same assertion—for example role + scope, relationship target + type + scope, stage event + time + scope, or outcome type + scope. Independent assertions with different support remain separate claims; a record has no blanket evidence field.

```ts
type TypedClaim<T> =
  | {
      claimId: ClaimId;
      status: "disclosed";
      value: T;
      displayValue: string;
      claimKind: "source_stated" | "organizer_stated";
      sources: EvidenceSource[];       // at least one
      note: string | null;
      conflictingValues: [];
    }
  | UnclearClaim
  | NotFoundClaim
  | NotApplicableClaim
  | ConflictingClaim<T>;
```

| Status | Structured-claim behavior |
| --- | --- |
| `disclosed` | Requires value, display value, source/organizer claim kind, and evidence. |
| `unclear` | Has no settled value; requires evidence and a note explaining the ambiguity. |
| `not_found` | Has no value/evidence and requires a finite-review explanation. |
| `not_applicable` | Has no value/evidence and requires an affirmative domain reason. |
| `conflicting` | Selects no top-level value and preserves at least two distinct evidence-bearing candidates. |

Structured claims cannot use `calculated`. Calculated values remain limited to deterministic, whitelisted flat-fact calculations with visible inputs and formulas.

Claims may cite only pages in `sourcePagesChecked`, and their repeated source metadata must match. Record IDs and claim IDs are globally unique within a card.

## Collection assessment states

An empty array is ambiguous, so every structured record family uses an explicit envelope:

```ts
type RecordCollection<T> =
  | { status: "unassessed"; records: []; note: null }
  | { status: "modeled"; records: [T, ...T[]]; note: string | null }
  | { status: "none_found"; records: []; note: string }
  | { status: "not_applicable"; records: []; note: string };
```

- `unassessed` means draft work remains. It is not equivalent to `not_found`.
- `none_found` means the finite reviewed inventory did not disclose a record.
- `not_applicable` requires an affirmative reason.
- `modeled` requires at least one record.

`human_reviewed` and `organizer_confirmed` cards cannot leave cycle or any structured collection unassessed. Demo cards may retain unassessed structured sections because they are explicitly fictional product fixtures rather than real-card source audits.

`costItems` uses the same four states, with one additional requirement on `modeled`: `completeness` is `complete` or `incomplete`. This records whether the reviewer established that the ledger contains every relevant participant cost, not merely whether each listed item is well formed. Lumiere and Diamond intentionally remain `incomplete` because the retained sources do not establish a complete general refund/participant-cost inventory.

## Scope

Structured values can be bound to one or more variants, stages, and pathways:

```ts
interface Scope {
  variantIds: string[];
  stageIds: string[];
  pathwayIds: string[];
}
```

IDs are OR alternatives within one dimension; nonempty dimensions apply together. An empty dimension means unrestricted. Every ID must resolve to a record in the same card. Scope is evidence-bearing when it determines where a role, timing, cost, requirement, or outcome applies.

This intentionally avoids an arbitrary predicate or workflow language. Source conditions remain neutral evidence-bearing text attached to a typed record/reference.

## Structured record families

### Cycle

The modeled cycle preserves a stable cycle ID plus atomic label, status, year/start-year/end-year, season, and cycle-type claims. Optional timing references point to disclosed stage timing claims for opening, deadline, coverage start, and coverage end; each reference must resolve and use the expected event kind.

The allowed cycle statuses are `announced`, `applications_open`, `applications_closed`, `active`, and `complete`. Date precision remains month, date, or RFC 3339 date-time, with `stated` versus `expected` certainty.

### Organizations, roles, and institution relationships

- `organizations` preserves each named entity and its source-backed kind.
- `organizationRoles` binds one known organization to a role and scope.
- `institutionRelationships` preserves subject, target, relationship type, explanation, and scope without converting founder/mentor affiliation into operation, partnership, or endorsement.

The first three cards require distinct operator, manager, administrator, academic/credit partner, institution-operated, founder-affiliation, and mentor-affiliation representations. A relationship to an unidentified local delivery organization is not fabricated; the model can add a scoped record later when evidence identifies it.

### Variants

Variants represent source-supported `cohort`, `tier`, or `track` distinctions with a stable ID, label, kind, optional parent, eligibility differences, and notes. A pathway is not a variant; delivery branches belong under `pathways`.

### Stages and pathways

A stage has stable order/identity plus an evidence-bearing definition and separate claims for timings, durations, time commitments, formats, locations, selection rules, advancement, requirements, and travel requirements. Each claim can carry its scope inside the same supported assertion.

A pathway contains an evidence-bearing definition and ordered evidence-bearing steps. Each step references one known stage and may preserve an entry condition. A pathway cannot repeat a stage. This represents the live versus virtual Diamond routes without introducing a general workflow engine.

### Cost items

Each cost item preserves:

- label, type, required/optional/conditional status, and scope;
- exact or ranged ISO-currency amount, including `not_found` or `unclear` amount states;
- per-application/participant/team/traveler basis where supported;
- a deposit-to-tuition credit reference;
- collection-level `complete` versus `incomplete` inventory status;
- refundability and its condition;
- included/excluded items and other conditions.

Application fee, deposit, tuition, travel, lodging, meals, materials, and other costs remain separate. A shared deposit can reference multiple tier tuition items. Zero is not `not_found`, and an incomplete, conditional, unresolved, mixed-currency, or scoped inventory cannot become one universal calculated total.

### Outcomes

Each outcome preserves source-backed outcome type and scope, recipient scope, monetary nature, optional amount, distribution, rank, track, quantity, use restriction, combinability, and conditions.

Cash, stipends, restricted project budgets, reimbursements, waivers/scholarships, program seats, mentorship, credit, equipment, travel support, flight/experiment opportunities, and other in-kind benefits remain distinct. Project budgets require restricted-funding classification and a cited use restriction. Personal cash prizes require individual scope; team cash prizes require team scope.

## Stable flat facts and projections

The seven flat-fact sections remain `identity`, `eligibility`, `commitment`, `money`, `selection`, `outcomes`, and `terms`. All 59 fields are present exactly once.

```ts
interface Fact {
  status: EvidenceStatus;
  value: string | number | boolean | string[] | null;
  displayValue: string | null;
  normalizedValue: NormalizedValue | null;
  sources: EvidenceSource[];
  note: string | null;
  confidence: number | null;
  claimKind: ClaimKind | null;
  conflictingValues: ConflictingValue[];
  calculation: Calculation | null;
  projection: {
    schemaVersion: "2.0.0";
    rule: string;
    claimRefs: ClaimId[];
  } | null;
}
```

`confidence` is extraction metadata, not truth probability, a reviewer score, or a legitimacy signal.

For structured projection fields:

- the builder edits the structured record, never the flat fact;
- the projector stores the rule and exact contributing claim IDs;
- top-level `projectionRefs` must match fact-level `claimRefs`;
- evidence is the deterministic deduplicated union of contributing claim evidence;
- validation recomputes the projection and rejects any stored value/reference drift;
- a universal single value may keep a normalized scalar;
- legitimate scoped differences produce a visible matrix/list and `normalizedValue: null`;
- same-scope incompatible claims remain conflicts;
- calculated totals require complete, compatible, same-currency inputs and exclude credited deposits from double counting.

Unmapped facts retain their direct evidence/state behavior. V2 does not delete a flat field merely because no structured family projects it.

## Normalized values

Original `value` and `displayValue` are never overwritten by normalization. The tagged union supports:

- text and text lists;
- ISO date without invented time/timezone;
- nonnegative money with currency and fee/deposit/cash/in-kind/tuition-waiver classification;
- numbers and units;
- explicit booleans;
- percentages;
- durations and hour ranges;
- institution-relationship categories;
- participation format.

The registry restricts normalized kinds per field. Scoped matrices intentionally have no scalar normalization.

## Exactly 13 core assessment areas

The registry enforces these core IDs:

1. `operating_organization`
2. `institution_relationship`
3. `grade_levels`
4. `application_deadline`
5. `duration`
6. `participation_format`
7. `estimated_total_mandatory_cost`
8. `financial_aid`
9. `refund_policy`
10. `selection_process`
11. `selection_evidence`
12. `other_benefits`
13. `material_terms`

The headline is `X of 13 core areas assessed`; a fully assessed card therefore leads with `13 of 13 core areas assessed`. The detail begins `X of Y applicable disclosed`, then appends each nonzero count in this exact order: `not found`, `unclear`, `conflicting`, `not applicable`, and `unassessed`.

- Assessed includes every core field not still marked unassessed by the builder.
- Applicable equals assessed minus `not_applicable`.
- Disclosed counts only `disclosed` fields.
- `not_found`, `unclear`, and `conflicting` remain assessed but not disclosed.

This is assessment coverage, never quality, legitimacy, safety, prestige, admissions impact, or value. An organizer-stated fact can count as disclosed while remaining unverified in the real world.

## Review states

| State | Meaning |
| --- | --- |
| `demo` | Obviously fictional `.example` card, persistently labeled Demo data. |
| `draft` | Automated, imported, migrated, incomplete, or not fully aligned by a human. |
| `human_reviewed` | A reviewer checked value/excerpt/source/scope/projection alignment; not an independent audit. |
| `organizer_confirmed` | The organizer supplied or confirmed information; not independent verification. |

Reviewed/confirmed cards require `reviewedAt`, modeled cycle identity, and assessed structured collections. Passing schema validation alone does not qualify a card for review attestation.

## Conservative V1 import

V1 compatibility is import-only. Repository and public artifact readers accept canonical V2 files; browser import dispatches by exact schema version.

`migrateV1ToV2`:

1. strictly validates the V1 input;
2. preserves all legacy facts, evidence, conflicts, summary, slug, and source inventory;
3. increments the card revision once;
4. clears review attestation (`draft`, `reviewedAt: null`);
5. leaves `opportunityId`, cycle, and every structured collection unassessed;
6. records prior schema/revision/review time plus a canonical SHA-256 digest;
7. performs no semantic inference from flat prose.

The same input produces the same migrated draft. A V2 card cannot be migrated again. A reviewer must assign cycle-independent identity, populate every structured section, regenerate projections, and re-attest the result before publication.

## Adding or updating a card

1. Create a draft:

   ```powershell
   npm run create:card -- fictional-opportunity-slug
   ```

2. Follow [`research/disclosure-audit-guide.md`](../research/disclosure-audit-guide.md). Add each checked page once and reuse its metadata.
3. Establish opportunity and cycle identity. Assess every structured collection; do not leave an empty array with ambiguous meaning.
4. Add evidence to each independently reviewable role/scope, relationship/scope, timing/scope, amount, condition, recipient, and distribution assertion. Split claims whenever the supporting passages or uncertainty differ.
5. Let the shared projector create mapped flat facts. Do not hand-edit a “V2 projection” field.
6. Preserve uncertainty/conflicts and avoid unsupported classifications.
7. Complete [`REVIEW_CHECKLIST.md`](./REVIEW_CHECKLIST.md), re-attest only after card-to-source and source-to-card passes, and move reviewed data from `data/drafts/` to `data/opportunities/`.
8. Run:

   ```powershell
   npm run export:data
   npm run validate:data
   npm run lint
   npm run typecheck
   npm test
   npm run test:e2e
   npm run build
   ```

The exporter and validator fail closed on drafts in public data, filename/slug mismatch, duplicate public identity, invalid review state, stale artifacts, schema errors, and projection/reference drift. Structural validation still does not prove source alignment.

## Public exports and imports

The downloadable dataset contains only repository demo/reviewed cards. It never includes browser drafts, comparison choices, pasted pages, prompts, or failed analysis output. Demo and reviewed records remain distinguishable.

Imports are version-dispatched before rendering or browser persistence. Unknown versions, malformed V1/V2 structures, and future versions fail with a readable error. V1 import returns only the conservative draft described above; it never enters a public artifact automatically.

Use the supported artifact sequence:

```powershell
npm run export:data
npm run validate:data
```

Verify deterministic order/timestamp, schema/data parity, demo labels, version metadata, no secrets/private URLs/student data, and Git-based correction history.

## Changing the model safely

For a new structured value, record family, field, or normalization:

1. demonstrate the need with reviewed cards rather than speculation;
2. change the shared schema/registry/projector authority;
3. decide schema and migration compatibility explicitly;
4. update builder, rendering, comparison, extraction, and evidence behavior through shared helpers;
5. migrate and re-review every affected demo/reviewed card;
6. regenerate artifacts;
7. add unit, data, integration, and browser regressions;
8. update this guide, methodology, review checklist, and decision record;
9. run the full release gate.

Do not add component-only JSON fields, parse legacy prose into reviewed semantics, or broaden enums with unreviewed abstractions. See [`REALITY_STRESS_TEST_RESOLUTION.md`](../REALITY_STRESS_TEST_RESOLUTION.md) for the evidence behind the current V2 boundary.
