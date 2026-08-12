# Reality stress test resolution: Schema V2

Date: August 11, 2026

Original decision record: [`REALITY_STRESS_TEST.md`](./REALITY_STRESS_TEST.md)

Resolution schema: Opportunity Card `2.0.0`
Cards re-reviewed and migrated: NASA TechRise Student Challenge 2026–2027, Lumiere Research Scholar Program Fall 2026, and Diamond Challenge 2027

## Outcome

All nine P1 comparison-model failures demonstrated by the first three real cards are closed in the authoritative schema, canonical repository data, deterministic summary projections, builder, card detail, comparison UI, and focused regressions.

This was not a license to infer missing facts. The V2 repair preserves the existing 59 facts and 13 core assessment areas while adding only the record families needed by the three cards:

- opportunity/cycle identity separate from card revision;
- organizations, organization roles, and institution relationships;
- cohort/tier/track variants;
- stages and ordered pathways;
- scoped cost items;
- scoped outcomes, recipient type, monetary nature, distribution, and restrictions.

The age-range limitation identified as P2 remains deferred. No score, verdict, generalized entity graph, workflow language, recurrence engine, currency-conversion engine, or legal-status model was added.

## Authoritative V2 invariants

### Evidence belongs to the atomic claim

A structured record is not one evidence blob. Each independently reviewable semantic assertion—cycle label/status, organization name/kind, scoped role or relationship, stage timing, cost amount, refund condition, recipient scope, prize distribution, and similar value—has a globally unique `claimId`, an evidence status, and its own evidence behavior. A claim payload may bind inseparable typed fields supported by the same assertion, such as role + scope, relationship target + type + scope, or outcome type + scope; it cannot cite one parent passage as blanket support for separate assertions.

- `disclosed` requires a value, display value, claim kind, and at least one source excerpt.
- `unclear` requires cited ambiguity and an explanation but cannot present a settled value.
- `not_found` and `not_applicable` carry no hidden value or evidence and require a reason.
- `conflicting` preserves at least two distinct evidence-bearing candidates and selects no top-level value.
- Structured source evidence must reuse metadata from `sourcePagesChecked`; automated excerpts still pass deterministic source-text matching.

Record IDs and claim IDs are globally unique within a card. Organization, variant, stage, pathway, cost-credit, cycle-timing, scope, and projection references must resolve inside that card.

### Assessment and scope are explicit

Every structured collection is one of:

- `unassessed`: draft work remains;
- `modeled`: at least one record exists;
- `none_found`: the reviewed inventory did not disclose a record;
- `not_applicable`: the family affirmatively does not apply.

`human_reviewed` and `organizer_confirmed` V2 cards require a cycle-independent `opportunityId`, a modeled cycle, and no unassessed structured collection. Demo cards may intentionally retain unassessed structures because their purpose is fictional product demonstration rather than a real-card source audit.

A scope contains `variantIds`, `stageIds`, and `pathwayIds`. IDs are OR alternatives within one dimension and nonempty dimensions apply together. An empty dimension is unrestricted. Free-text conditions remain evidence-bearing claims; they do not replace references.

### The 59 facts are deterministic projections

The 59-field map remains the stable renderer, search, import/export, and baseline comparison contract. For fields covered by structured records, it is a materialized projection rather than a second editable truth source.

- Each projected fact records a projection rule and contributing claim IDs.
- `projectionRefs` and fact-level claim references must match.
- Validation recomputes every mapped projection and rejects value, evidence, normalization, or reference drift.
- One universal value may retain scalar normalization.
- Legitimate values that differ by tier, track, stage, or pathway produce a disclosed matrix/list such as “Varies by program/cohort,” with no false scalar normalization.
- Incompatible values for the same scope remain `conflicting`; scoped differences are not mislabeled as conflicts.
- A mandatory-cost total is calculated only when `costItems.completeness` is `complete` and the required items are disclosed, compatible, same-currency, and unscoped. An incomplete ledger or conditional cost blocks a scalar calculation, and deposits credited toward tuition are not counted twice.
- Restricted project funding is never projected as participant cash.

The disclosure meter now leads with `X of Y applicable core facts disclosed`. Its detail begins `X of 13 core areas assessed`, then appends nonzero `not found`, `unclear`, `conflicting`, `not applicable`, and `unassessed` counts in that order. It is not a trust or quality score, and `not_applicable` is excluded from the applicable denominator.

## Disposition of the nine P1 findings

### P1-1 — Multiple organizations and institution relationships: closed

**Structures:** `organizations`, `organizationRoles`, and `institutionRelationships`, all with stable IDs, atomic evidence, and scope.

**Canonical examples:**

- TechRise stores NASA Flight Opportunities as `manager` and Future Engineers as `administrator`; neither is flattened into a fabricated single operator.
- Lumiere stores Lumiere Education as operator, UC San Diego Extended Studies as an academic/credit relationship, two founder affiliations, and four mentor affiliations. None becomes a generic university partnership or university operation claim.
- Diamond stores Horn Entrepreneurship separately from the University of Delaware and preserves the supported institution-operated relationship. The V2 relationship scope can represent a named local delivery partner when evidence identifies one. The migrated card does not fabricate names for affiliated pitch-event organizations that its stored excerpts do not identify.

**UI:** “Organizations and relationships” renders roles and relationship types separately on cards and in structured comparison.

**Regression:** `tests/unit/schema-v2.test.ts` rejects relationship conflation and dangling scope; `tests/unit/v2-card-population.test.ts` checks the real Lumiere and TechRise records; `tests/e2e/structured-v2.spec.ts` verifies visible credit/founder/mentor distinctions.

### P1-2 — Conditional and tiered pricing: closed

**Structures:** `variants` plus scoped `costItems`, with atomic amount, charge basis, tuition-credit treatment, refundability, inclusions/exclusions, and conditions.

**Canonical example:** Lumiere has four tier records and four separately scoped tuition records: $3,190, $6,450, $9,900, and $9,900. The shared $200 conditional-acceptance deposit points to all four tuition records as credited amounts and preserves its conditional reimbursement rule. Need-based aid remains scoped to the Individual Research Program.

**Projection behavior:** tuition displays “Varies by program/cohort” with no misleading normalized scalar. The cost ledger remains explicitly incomplete, so the estimated total is not calculated; the deposit is not added to tuition twice.

**UI:** “Programs and cohorts” and “Costs” show the tier/price binding instead of one prose aggregate.

**Regression:** schema tests exercise a two-tier price matrix and block a scalar total; canonical-card and browser tests assert Lumiere’s four prices and deposit treatment.

### P1-3 — Multiple cohorts, dates, formats, and locations: closed

**Structures:** modeled `cycle`, scoped stage timing/duration/commitment/format/location/travel claims, and cycle timing references.

**Canonical examples:**

- TechRise is an announced 2026–2027 competition cycle with proposal, selection, build, and flight stages. The stored source inventory did not support exact current-cycle stage dates, so V2 does not invent them.
- Lumiere preserves the Fall 2026 cycle, August 23 application deadline, September 14 start, online worldwide program stage, and tier-scoped commitments.
- Diamond preserves the September 2026 submission opening, January deadline with time and timezone, February and March notifications, two pitch formats, affiliated live-pitch locations, and the April 29–30 in-person final.

**UI:** the card header separates cycle label from card revision; “Schedule and selection paths” renders stage-bound timing, format, place, and travel details.

**Regression:** cycle/revision independence, stage deadline references, real-card population, and rendered pathway checks are covered by the focused V2 suites.

### P1-4 — Prize matrices and multiple outcomes: closed

**Structures:** one `outcomes` record per supported prize/benefit with scope, amount, rank, track, recipient, distribution, quantity, restriction, combinability, and conditions as separate claims where applicable.

**Canonical examples:** Diamond stores six source-supported track/rank team prizes: $12,000, $8,000, and $4,500 in each of Business Innovation and Social Innovation. The flat cash field says “Multiple cash awards — see prize details” and has no scalar normalization. Five topical-prize names mentioned in the V1 prose were not recreated because the retained excerpts did not support those names; the migration records that limitation instead of fabricating evidence.

TechRise stores build funding, technical support, and the flight opportunity as three different outcomes. Lumiere stores program admission, aid, tier-scoped mentoring, credit eligibility, and paper/publication support separately.

**UI:** “Outcomes and prizes” groups participant cash, project funding/reimbursement, tuition support, and non-cash outcomes instead of totaling unlike benefits.

**Regression:** unit and canonical-data tests require the six-item Diamond matrix; browser tests verify both track rows.

### P1-5 — Project funding versus personal cash: closed

**Structures:** outcome type and monetary nature distinguish cash prizes, stipends, project budgets, reimbursement, tuition support, and non-monetized benefits. A project budget requires source-backed restricted-funding classification and a use restriction.

**Canonical example:** TechRise’s $1,500 is a team-scoped `project_budget` restricted to experiment construction. It is not emitted as personal or team cash to spend freely.

**UI:** TechRise appears under “Project funding and reimbursement,” with no “Cash to participant(s)” region.

**Regression:** schema and population tests explicitly assert that the $1,500 cannot project into `cash_award`; the browser test verifies the visible category and restriction.

### P1-6 — Team versus individual benefits: closed

**Structures:** every outcome requires an atomic `recipientScope`; optional distribution claims preserve payee, method, and conditions.

**Canonical examples:** TechRise funding/support/flight records apply to a team or selected experiment. Lumiere mentoring, program admission, and credit eligibility apply to an individual applicant/participant/completer. Diamond prizes apply to teams and preserve payment to a registered venture or equal division among registered team members.

**UI:** recipient labels appear on outcome rows. No UI divides a team amount per participant without an explicit distribution claim.

**Regression:** schema rules enforce individual scope for personal prizes and team scope for team prizes; canonical Diamond and TechRise tests assert recipient/distribution behavior.

### P1-7 — Several simultaneous selection pathways: closed

**Structures:** stable stage records plus named pathways containing evidence-bearing ordered steps and entry conditions. This is deliberately not a general workflow engine.

**Canonical examples:** Diamond has separate live-pitch and virtual/pre-recorded pathways that share submission/review and converge on the Summit final. Stage-specific format, location, notification, and travel obligations remain attached to the correct route. TechRise and Lumiere each preserve their supported common ordered path without inventing extra branches.

**UI:** “Schedule and selection paths” shows both Diamond routes; structured comparison reveals them on demand.

**Regression:** schema tests reject repeated/dangling steps and preserve branches; browser tests require both named Diamond paths.

### P1-8 — Applicability and the core metric: closed

**Structures:** collection assessment states and builder-side unassessed flat fields distinguish “not reviewed yet” from `not_found` and `not_applicable`.

**Metric behavior:** the headline is `X of Y applicable core facts disclosed`. The detail begins `X of 13 core areas assessed`, then appends nonzero not-found, unclear, conflicting, not-applicable, and draft-unassessed counts in that order. The following line says explicitly that the result is disclosure/assessment coverage, not trust, quality, or independent verification. `not_applicable` reduces the applicable count; `not_found`, `unclear`, and `conflicting` remain assessed but are not disclosed.

The current reviewed-card triples are: TechRise 13 assessed / 12 applicable / 6 disclosed; Lumiere 13 / 13 / 11; Diamond 13 / 13 / 10. These are transparent status counts, not comparative scores.

**UI:** the segmented status track exposes each core area’s state in text for assistive technology and does not use one success-colored completion bar.

**Regression:** `tests/unit/registry.test.ts` verifies assessed/applicable/disclosed/not-found/unclear/conflicting/not-applicable/unassessed counts and neutral labels; the TechRise browser test checks that the status track is not visually collapsed to one state.

### P1-9 — Cycle identity versus `cardVersion`: closed

**Structures:** `opportunityId` identifies the continuing opportunity; modeled `cycle.id` and evidence-bearing cycle label/status/year fields identify the reviewed cycle; `cardVersion` remains only the record revision.

**Canonical examples:** the stable opportunity IDs are `nasa-techrise-student-challenge`, `lumiere-research-scholar-program`, and `diamond-challenge`, while cycle records identify 2026–2027, Fall 2026, and the 2027 competition cycle. All migrated repository cards advanced from revision 1 to revision 2 without treating that revision as a year or cohort.

**Publication behavior:** public artifacts reject duplicate slugs and duplicate opportunity/cycle identities. Reviewed cards require both opportunity and cycle identity.

**UI:** every card header shows cycle, card revision, and schema version as separate labels.

**Regression:** schema tests change slug/revision while asserting stable opportunity/cycle identity; canonical population tests check all three IDs and cycles.

## V1 migration and publication boundary

V1 compatibility is import-only. `migrateV1ToV2`:

1. validates the V1 input strictly;
2. copies the complete legacy fact map, source inventory, conflicts, slug, and summary;
3. increments `cardVersion` once;
4. sets `opportunityId` to `null` and cycle/record collections to `unassessed`;
5. resets `reviewState` to `draft` and `reviewedAt` to `null`;
6. records the V1 schema version, revision, review timestamp, and canonical SHA-256 digest;
7. performs no prose splitting or semantic role, scope, pathway, recipient, or funding inference.

The migration is deterministic and rejects an attempted second migration of a V2 card. The three real cards were then manually populated from their retained reviewed evidence, projected, and freshly attested. Demo cards were migrated to canonical V2 but may keep structured sections unassessed.

Repository/publication parsing accepts only canonical V2. It fails closed on drafts in public directories, stale projections, unknown/dangling references, duplicate IDs, source-metadata mismatch, reviewed unassessed sections, duplicate slugs, and duplicate opportunity/cycle pairs. Browser import may accept a valid V1 file only by converting it into the conservative draft described above.

## UI disposition

The 59 summary rows remain available for scanning and baseline comparison. Structured detail is progressive disclosure, not a replacement hidden from users:

- cards expose “Explore structured details” with organizations/relationships, programs/cohorts, schedule/paths, costs, and outcomes/prizes;
- comparison exposes the same five groups under “Compare distinctions the summary rows cannot hold”;
- the builder edits source-backed structured records and labels mapped flat fields “V2 projection”;
- changing structured data regenerates projections, validates all references, invalidates prior review attestation, and autosaves only a valid card;
- V1 import messaging states that the result is a draft V2 revision requiring structured review.

## Regression gate

The focused regression set is:

- `tests/unit/schema-v2.test.ts`
- `tests/unit/v2-card-population.test.ts`
- `tests/unit/v2-p1-regressions.test.ts`
- `tests/unit/serialization.test.ts`
- `tests/unit/registry.test.ts`
- `tests/integration/v2-extraction-p1-regressions.test.ts`
- `tests/e2e/builder-v2.spec.ts`
- `tests/e2e/structured-v2.spec.ts`
- `npm run export:data`
- `npm run validate:data`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

The ordinary full release gate still applies. Passing schema validation proves internal contract consistency, not real-world truth; the reviewed source alignment and limitations recorded for each card remain authoritative.

## Intentionally rejected expansion

The three cards did not justify:

- a general organization/person knowledge graph;
- a BPMN/workflow or arbitrary condition language;
- arbitrary scope predicates beyond variant/stage/pathway references;
- multiple cycles inside one public reviewed card;
- recurrence/calendar automation;
- currency conversion, tax, or general accounting;
- a generalized credential, legal-status, endorsement, legitimacy, or value ontology;
- automatic parsing of V1 prose into reviewed V2 semantics;
- a new age-band model as part of this P1 repair.

Those ideas require a separate evidence sample and product decision. They are not hidden TODOs in the completed nine-P1 resolution.
