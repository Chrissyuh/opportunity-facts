# Public V2 card review checklist

Use this checklist before adding or updating a public Opportunity Facts card. It complements [`research/disclosure-audit-guide.md`](../research/disclosure-audit-guide.md) and the schema contract in [`SCHEMA_AND_DATA.md`](./SCHEMA_AND_DATA.md).

Passing establishes source-to-card alignment at the recorded date. It does **not** certify the opportunity, audit organizer claims, give legal advice, or rate legitimacy, quality, prestige, admissions impact, or value.

## Review record

| Item | Record |
| --- | --- |
| Card slug | |
| Cycle-independent `opportunityId` | |
| Cycle ID and label | |
| Proposed card version | |
| Schema version | |
| Primary reviewer and date | |
| Independent alignment reviewer and date, if used | |
| Change type (`new`, `refresh`, `correction`, `migration`) | |
| Related correction packet/issue | |

Do not put participant, applicant, or other unnecessary personal information in this record.

## 1. Opportunity, cycle, and identity

- [ ] `schemaVersion` is the current exported version (`2.1.0`) and `opportunityId` excludes the cycle/year/cohort suffix.
- [ ] The modeled cycle has a stable ID and evidence-bearing label/status/year metadata.
- [ ] Cycle opening/closing/coverage references point to the correct disclosed stage timing claims.
- [ ] `cardVersion` describes only this record revision; it was not used as cycle identity.
- [ ] The slug is stable, neutral, lowercase kebab-case, and the filename is exactly `<slug>.json`.
- [ ] The primary official URL is public HTTP(S) and has no credentials or private token.
- [ ] Every named organization is separately recorded with source-backed name and kind.
- [ ] Operator, manager, administrator, academic partner, and other roles are not collapsed into one generic organizer.
- [ ] Institution operation/partnership/credit and founder/mentor/staff affiliations use only the relationship actually supported by evidence.
- [ ] Venue, branding, biography, alumni/faculty involvement, or email domain alone was not treated as operation, partnership, sponsorship, or endorsement.
- [ ] The short summary is neutral and contains no unsupported factual value or product verdict.

## 2. Source inventory

- [ ] Each source has one stable ID, title, canonical URL, provenance/page type, and RFC 3339 access timestamp.
- [ ] Sources cover the relevant program, FAQ/eligibility, cost/aid, schedule, rules, terms/refund/cancellation, privacy, relationship, and award pages when they exist.
- [ ] Every source is public and reviewable; no credentials, signed/private applications, student records, or unnecessary personal data were copied.
- [ ] Search snippets, AI summaries, testimonials, and unsourced directories were not used as primary evidence.
- [ ] Sources from different cycles are not silently combined.
- [ ] Attribution to the opportunity/operator is documented rather than inferred from visual branding.
- [ ] Every flat or structured evidence object exactly matches one `sourcePagesChecked` entry except for its excerpt.
- [ ] Automated excerpts passed deterministic matching to the acquired/pasted source text; failures were removed or downgraded.

## 3. Atomic claim evidence

- [ ] Every structured factual value has a globally unique `claimId`.
- [ ] Every independently reviewable cycle, organization, role/scope, relationship/scope, timing/scope, cost, pathway, and outcome assertion has its own claim kind and evidence; parent-record evidence was not used as a blanket substitute.
- [ ] Fields grouped inside one claim payload are inseparable parts of the same sourced assertion; values with different support or uncertainty were split into separate claims.
- [ ] Every excerpt preserves enough context for subject, unit, conditions, exceptions, and scope.
- [ ] No excerpt splices nonadjacent text or silently changes source wording.
- [ ] `unclear` claims present no settled value and include evidence plus an explanation.
- [ ] `not_found` means only that the finite inventory did not locate the disclosure and contains no hidden value/evidence.
- [ ] `not_applicable` has an affirmative reason and contains no hidden value/evidence.
- [ ] `conflicting` preserves at least two distinct supported candidates and selects no top-level value.
- [ ] Structured source claims use only `source_stated` or `organizer_stated`; `calculated` is reserved for supported flat-fact calculations.

## 4. Structured collection assessment

- [ ] Cycle and each of `organizations`, `organizationRoles`, `institutionRelationships`, `variants`, `stages`, `pathways`, `costItems`, and `outcomes` has an explicit assessment state.
- [ ] `modeled` collections contain at least one record.
- [ ] Empty assessed collections use `none_found` or `not_applicable` with a reason.
- [ ] `unassessed` is used only while the card remains a draft.
- [ ] A proposed `human_reviewed` or `organizer_confirmed` card has no unassessed structured section.
- [ ] Record IDs are globally unique; organization, variant, stage, pathway, cost-credit, and cycle-timing references resolve in the same card.

## 5. Scope, variants, stages, and pathways

- [ ] Every nonempty `variantIds`, `stageIds`, or `pathwayIds` scope contains known IDs.
- [ ] Empty scope dimensions are intended to mean unrestricted; no missing reference was accidentally represented as global.
- [ ] Tier/cohort/track differences are separate variants instead of semicolon text or cloned cards.
- [ ] Dates preserve year, timezone, precision, and `stated` versus `expected` certainty.
- [ ] Duration, commitment, format, location, selection rule, and travel obligation remain attached to the correct stage and scope.
- [ ] Every pathway has a source-backed name and ordered, nonrepeating references to known stages.
- [ ] Branch/entry conditions remain evidence-bearing text on the correct pathway step.
- [ ] Shared stages and branch-specific stages were not flattened into one universal route.

## 6. Cost items and totals

- [ ] Zero cost is supported and not confused with amount `not_found`.
- [ ] Application fees, deposits, tuition, travel, lodging, meals, materials, and other participant costs remain separate.
- [ ] Every amount preserves currency, exact/range semantics, payer/unit, required/optional/conditional status, and scope.
- [ ] A modeled `costItems` collection is marked `complete` only when the reviewed sources establish that no relevant required/conditional participant-cost item is missing; otherwise it remains `incomplete` with an explanation.
- [ ] Tier-specific prices each reference the correct variant.
- [ ] Deposit-to-tuition credit targets known cost items and is not added to the total twice.
- [ ] Refundability and reimbursement conditions were not inferred.
- [ ] Included/excluded items and conditions carry their own evidence.
- [ ] Financial aid/waiver outcomes remain scoped to the eligible variant and recipient.
- [ ] A calculated scalar mandatory total exists only when the cost inventory is `complete` and every included required amount is disclosed, same-currency, compatible, and universal.
- [ ] Conditional, unresolved, mixed-currency, or scoped costs block a misleading scalar total and explain why.

## 7. Selection and outcomes

- [ ] Applicant and acceptance/winner counts use the same population and cycle before a rate is calculated.
- [ ] A calculated acceptance rate preserves inputs/formula and is visibly calculated; a source-stated rate without counts is organizer-stated.
- [ ] “Selective,” “competitive,” or similar copy was not converted to a numerical rate.
- [ ] Each prize/benefit is a separate outcome when type, rank, track, recipient, amount, distribution, restriction, or condition differs.
- [ ] Cash prizes and stipends remain distinct from project budgets, reimbursement, waivers, seats, certificates, mentorship, credit, equipment, and other in-kind outcomes.
- [ ] Every outcome has an evidence-bearing recipient scope; team amounts were not divided per person without a disclosed distribution.
- [ ] Educator-, school-, and organization-scoped outcomes remain in rich details and do not project into participant cash or in-kind summary fields.
- [ ] Project budgets are classified as restricted funding and include a source-backed use restriction.
- [ ] Prize matrices preserve every source-supported track/rank amount and do not select one representative award.
- [ ] Unknown award amounts remain `not_found`; unsupported prize names or values were not recreated from legacy prose.
- [ ] Distribution payee/method/conditions and combinability are preserved when disclosed.

## 8. Flat facts, projections, and core assessment

- [ ] Every one of the 59 registry fields exists once in `facts`; no component-only field was added.
- [ ] Direct facts use one allowed status and preserve original/display/normalized values, sources, notes, claim kind, conflicts, and calculations.
- [ ] Fields marked “V2 projection” were generated from structured records rather than hand-edited.
- [ ] Fact-level projection rule/claim refs match top-level `projectionRefs`.
- [ ] Projection evidence is exactly the contributing claim evidence and no unrelated source was added.
- [ ] Legitimate tier/track/stage/path differences render as a matrix/list with no false scalar normalization.
- [ ] Same-scope incompatible values remain conflicts rather than being treated as scoped alternatives.
- [ ] `npm run validate:data` reports no deterministic projection drift.
- [ ] The meter headline is `X of Y applicable core facts disclosed`, not a percentage, rating, or trust score.
- [ ] Detail begins `X of 13 core areas assessed`, then includes each nonzero status count in order: not found, unclear, conflicting, not applicable, and unassessed.
- [ ] `not_applicable` is excluded from the applicable count; draft-unassessed is separate from `not_found`.

## 9. Terms, conflicts, and uncertainty

- [ ] Project ownership/license, publicity rights, privacy/data sharing, confidentiality, cancellation, refund, and modification language is summarized neutrally without a legal verdict.
- [ ] Every incompatible supported current flat value appears under `conflictingValues` with its own evidence.
- [ ] Card-level conflict metadata exactly matches conflicting flat fields.
- [ ] Cycle, population, unit, scope, and source recency were checked before declaring a conflict.
- [ ] Source precedence/supersession was not invented.
- [ ] Calculations do not depend on unresolved conflicting inputs.
- [ ] Notes distinguish finite source absence, ambiguity, conflict, source limitation, and reviewer limitation.

## 10. Migration, review state, and truthfulness

- [ ] If this began as V1, migration preserved legacy facts/evidence, advanced one revision, recorded the prior digest, cleared review attestation, and left new sections unassessed.
- [ ] No V1 prose was automatically classified as reviewed cycle, role, scope, pathway, recipient, or funding semantics.
- [ ] The card remained in `data/drafts/` until both flat and structured review were complete.
- [ ] Automated/pasted sources remain `user_supplied`; `official_*` or `public_record` was assigned only after publisher/document-kind review.
- [ ] Fictional data uses reserved `.example` URLs and remains visibly `demo` / Demo data.
- [ ] Automated, migrated, imported reviewed/confirmed, or incompletely checked real cards remain `draft`; imported V2 fictional cards retain `demo` provenance.
- [ ] `human_reviewed` means a human checked every displayed value, excerpt, source, scope, relationship, projection, conflict, and the full inventory.
- [ ] `organizer_confirmed` states organizer involvement and is not presented as independent verification.
- [ ] A non-demo reviewed state has a valid current `reviewedAt` timestamp.
- [ ] No real organization, response, endorsement, user count, accuracy/traffic figure, or research result was fabricated.
- [ ] The card contains no legitimacy, scam, prestige, worth, recommendation, admissions-impact, or value score/implication.

## 11. Privacy, safety, and presentation

- [ ] Excerpts contain no unnecessary applicant/participant/private-person information.
- [ ] URLs contain no credentials, session IDs, signed query/fragment tokens, or other secrets.
- [ ] Source text is rendered as text, never arbitrary HTML or executable markup.
- [ ] Link labels/destinations are understandable and use safe external-link behavior.
- [ ] Status meaning is conveyed in words, not color alone.
- [ ] The card header displays cycle, card revision, and schema version separately.
- [ ] “Explore structured details” exposes organizations, programs, process, costs, and outcomes without hiding the evidence state.
- [ ] Structured comparison preserves the selected cards’ distinctions without overflow at desktop, 200% zoom, and mobile widths.
- [ ] Evidence disclosures, tables/lists, correction controls, export, print, and comparison remain keyboard usable.
- [ ] The disclaimer says the card reports reviewed sources and does not rate the opportunity.

## 12. Version and file review

- [ ] `schemaVersion` matches the current exported schema.
- [ ] `cardVersion` advanced for migration, correction, refresh, or new attestation as required.
- [ ] `reviewedAt` and `sourcePagesChecked` reflect the current audit.
- [ ] JSON filename and slug follow repository conventions.
- [ ] No duplicate public slug or opportunity/cycle identity exists.
- [ ] The diff contains only intended changes and preserves unrelated work.
- [ ] Public schema/dataset artifacts were regenerated deterministically.

## 13. Verification commands

Run from the repository root and record actual outcomes:

```powershell
npm run export:data
npm run validate:data
npm run lint
npm run typecheck
npm test
npm run build
```

For any rendering, comparison, builder, import, or interaction change, also run:

```powershell
npm run test:e2e
```

- [ ] Public schema/dataset export was regenerated deterministically.
- [ ] Data validation passed, including reviewed structured assessment and projection parity.
- [ ] Lint passed.
- [ ] Strict typecheck passed.
- [ ] Deterministic unit/integration/security/data tests passed.
- [ ] Production build passed.
- [ ] Relevant desktop/mobile/keyboard/print/browser checks passed, or the exact unverified item is recorded.

## Sign-off and remaining limitations

Record concise evidence, not “looks good.”

| Check | Result/evidence |
| --- | --- |
| Source-to-card pass | |
| Card-to-source pass | |
| Structured scope/reference pass | |
| Projection parity pass | |
| Automated validation | |
| Browser/print verification | |
| Remaining uncertainty | |
| Decision (`draft`, `human_reviewed`, `organizer_confirmed`) | |
