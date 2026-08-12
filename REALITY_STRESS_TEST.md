# Reality stress test: first three human-reviewed cards

> Resolution status: all nine P1 comparison-model findings below are resolved in schema `2.0.0`, the three canonical reviewed cards, deterministic projections, and structured card/comparison UI. The original findings remain here as the decision record; see [`REALITY_STRESS_TEST_RESOLUTION.md`](./REALITY_STRESS_TEST_RESOLUTION.md) for the implemented disposition and regressions. The age-range P2 remains intentionally deferred.

Date: August 11, 2026  
Schema tested: Opportunity Card `1.0.0` without modification  
Cards: NASA TechRise Student Challenge 2026–2027, Lumiere Research Scholar Program Fall 2026, and Diamond Challenge 2027

## Verdict

The schema survived as a truthful, evidence-carrying review envelope. All three cards can validate without a false disclosed fact because arrays, notes, and conservative statuses provide escape hatches.

It did **not** survive as a lossless comparison model. Repeated organizations, variants, stages, prices, locations, and awards collapse into prose inside scalar fields. That prose remains auditable, but the important relationships are no longer machine-comparable. There are no P0 failures in this sample; there are nine P1 failures and one P2 limitation.

The repair should occur before adding more heterogeneous real cards. The existing 59 fields and 13 core dimensions should remain as stable summary projections while a small number of scoped record families are added for cycle, organizations, variants, stages, and outcomes.

## P1-1 — Multiple organizations and institution relationships

- **Affected fields:** `operating_organization`, `organization_type`, `named_institution`, `institution_relationship`, `relationship_explanation`.
- **TechRise example:** NASA Flight Opportunities manages the challenge while Future Engineers administers it. One operator field can retain both only as a semicolon-delimited sentence; the roles are not independently queryable.
- **Lumiere example:** Lumiere Education operates the program; UC San Diego Extended Studies is the stated credit partner; Harvard/Oxford are founder affiliations; Harvard/Stanford/Oxford/MIT and others are mentor affiliations. The single institution slot can represent UCSD, but every other affiliation must be excluded from structure and explained in prose.
- **Diamond example:** Horn Entrepreneurship at the University of Delaware operates the competition, while many affiliated organizations execute live pitch events. The card can represent UD/Horn, but not the separate local delivery relationships.
- **Information lost or distorted:** entity identity, entity type, role, relationship target, source, scope, and whether a relationship applies globally or only to one stage/site.
- **Can a note represent it?** Truthfully, yes. Comparably, no.
- **Frequency:** repeated across all three cards.
- **Severity:** **P1** — important identity and legitimacy information is materially flattened.
- **Smallest robust fix:** add `organizations[]` and `relationships[]` records with stable entity IDs, role/relationship enums, scope, and evidence. Keep the five current identity fields as derived summaries.
- **Migration impact:** moderate and backward-compatible if arrays are optional in a schema-v2 transition; migrate the three real cards and derive existing display fields.
- **Before more real cards?** Yes. Institution and operator claims are high-risk and will recur.

## P1-2 — Conditional and tiered pricing

- **Affected fields:** `application_fee`, `deposit`, `tuition`, `other_mandatory_costs`, `estimated_total_mandatory_cost`, `financial_aid`, `refund_policy`, `tuition_waiver`.
- **TechRise example:** there is no tuition matrix, but the absence of a published participant-cost total cannot be turned into a zero-cost claim merely because teams receive build funding.
- **Lumiere example:** four current tiers cost $3,190, $6,450, $9,900, and $9,900; durations and support differ; the $200 deposit is credited to tuition; financial aid is restricted to one tier and income bands. A single normalized tuition or total would be wrong.
- **Diamond example:** entry-path cost is unpublished, while travel exposure depends on live/virtual selection, advancement, origin, and finalist attendance. There is no single mandatory-cost total.
- **Information lost or distorted:** which price belongs to which variant, deposit interaction, aid eligibility by variant, included services, and stage-dependent travel exposure.
- **Can a note represent it?** It can preserve the facts, but comparison and calculation are lost.
- **Frequency:** material in Lumiere and Diamond; the same uncertainty boundary matters for TechRise.
- **Severity:** **P1**.
- **Smallest robust fix:** add `variants[]` with scoped `costItems[]`, deposit treatment, aid eligibility, and explicit inclusions/exclusions. Do not replace the existing money fields; derive them only when one unambiguous value exists.
- **Migration impact:** moderate; existing single-price cards map to one default variant.
- **Before more real cards?** Yes, before another paid or multi-path opportunity.

## P1-3 — Multiple cohorts, dates, formats, and locations

- **Affected fields:** `application_deadline`, `decision_date`, `start_date`, `end_date`, `duration`, `weekly_hours`, `required_live_hours`, `participation_format`, `location`, `travel_requirements`.
- **TechRise example:** the announced cycle had no source-backed application, build, or flight dates retained in the V1 card. The current fields cannot express an announced cycle state separately from missing dates.
- **Lumiere example:** Fall 2026 has one start date, but four tier-specific durations and session counts. Other cohorts exist on the same official page. One duration/end-date pair cannot preserve tier or cohort scope.
- **Diamond example:** the cycle has submission, live/virtual pitching, finalist notification, and in-person Summit stages. Dates, formats, locations, and travel requirements change by stage and chosen pathway.
- **Information lost or distorted:** the binding between a date/duration/location and its cohort, tier, stage, or pathway; several decision dates also become one unnormalized text list.
- **Can a note represent it?** Truthfully, yes; operational comparison and reminders, no.
- **Frequency:** repeated in all three cards.
- **Severity:** **P1**.
- **Smallest robust fix:** introduce `cycle` plus `stages[]`; allow a variant/stage reference on dates, duration, format, location, and travel requirements. Preserve flat fields as a primary-cycle summary.
- **Migration impact:** moderate; current dates map to the default cycle/stage, with no data loss.
- **Before more real cards?** Yes.

## P1-4 — Prize matrices and multiple outcomes

- **Affected fields:** `cash_award`, `program_seat`, `in_kind_value`, `mentorship`, `other_benefits`, `material_terms`.
- **TechRise example:** selected teams receive restricted experiment-build funding, technical assistance, and a balloon-flight spot; those are distinct outcomes with different types and conditions.
- **Lumiere example:** the purchased program yields tier-dependent mentoring/writing/publication support, a research paper, and conditional UCSD Extended Studies credit eligibility. Outcomes vary by tier and successful completion.
- **Diamond example:** $12,000/$8,000/$4,500 is repeated across two tracks, five topical prizes exist with unpublished 2027 amounts, and finalists receive a Summit place. One `cash_award` cell holds the entire matrix as prose.
- **Information lost or distorted:** outcome identity, track/tier/stage, ranking, amount, conditions, whether amount is unknown, and whether outcomes can be combined.
- **Can a note represent it?** It preserves human meaning, but eliminates sorting, filtering, and reliable comparison.
- **Frequency:** repeated across all three cards.
- **Severity:** **P1**.
- **Smallest robust fix:** add `outcomes[]` with type, label, amount/value, currency, recipient scope, distribution, conditions, and optional variant/stage/track references.
- **Migration impact:** moderate; existing outcome fields become derived summaries and can seed one or more outcome records.
- **Before more real cards?** Yes.

## P1-5 — Project funding versus personal cash

- **Affected fields:** `cash_award`, `stipend`, `in_kind_value`, `other_benefits`.
- **TechRise example:** the $1,500 is “to build their experiment.” The current `cash_award` definition says cash paid to a participant or winner, so the card must mark it `unclear` and move the source-backed amount into `other_benefits` to avoid calling it a personal prize.
- **Lumiere example:** no award funding applies; tuition aid is a waiver/scholarship, not cash.
- **Diamond example:** award money can be paid to a registered team venture or split among team members. The same award therefore changes economic recipient and permitted use.
- **Information lost or distorted:** funding purpose, permitted use, payee, reimbursement versus advance/grant/prize, and whether funds are personal or project-restricted.
- **Can a note represent it?** Truthfully, but not in the normalized money model.
- **Frequency:** material in TechRise and Diamond; the Lumiere negative case confirms that tuition aid is a third distinct class.
- **Severity:** **P1**. The safe workaround avoids a P0 falsehood but sacrifices machine-readable amount/classification.
- **Smallest robust fix:** extend outcome/funding records with `fundingType` (`personal_prize`, `project_grant`, `reimbursement`, `stipend`, `tuition_aid`, `in_kind`), `payee`, and `useRestriction`.
- **Migration impact:** low-to-moderate for existing cash facts; ambiguous records require manual migration.
- **Before more real cards?** Yes.

## P1-6 — Team-level versus individual benefits

- **Affected fields:** all outcome fields, especially `cash_award`, `program_seat`, `in_kind_value`, and `other_benefits`.
- **TechRise example:** funding, technical support, and the flight slot belong to the selected team/project, not automatically to each student.
- **Lumiere example:** mentoring, the paper, and credit eligibility are individual-student outcomes.
- **Diamond example:** prizes are awarded to teams, then either paid to a registered venture or evenly split among registered members; only one finalist team member must attend, while the team holds the competition place.
- **Information lost or distorted:** recipient unit, per-person versus per-team value, allocation method, and minimum attendance versus award ownership.
- **Can a note represent it?** Yes for reading, no for value comparison.
- **Frequency:** repeated across all three cards.
- **Severity:** **P1**.
- **Smallest robust fix:** require `recipientScope` and optional `distribution` on each outcome/funding record.
- **Migration impact:** low once `outcomes[]` exists; current cards require manual scope assignment.
- **Before more real cards?** Yes.

## P1-7 — Several simultaneous selection pathways

- **Affected fields:** `entry_format`, `selection_process`, `decision_date`, `selection_evidence`, `participation_format`, `location`, `travel_requirements`.
- **TechRise example:** the current announced balloon cycle is one primary pathway, but selection, build, and flight are distinct stages whose dates are not yet all published.
- **Lumiere example:** applicants select a program tier, may be shortlisted for interview, then undergo mentor matching before final logistics; aid eligibility branches on the selected tier.
- **Diamond example:** teams choose one of two competition tracks and independently choose live-event or virtual/pre-recorded pitching; both feed an in-person final. Pathway choice affects deadlines, location, forfeiture, and travel.
- **Information lost or distorted:** branching, stage order, transition criteria, branch-specific dates and obligations, and the distinction between track and delivery pathway.
- **Can a note represent it?** It explains the process but cannot power pathway-specific comparison or alerts.
- **Frequency:** repeated; acute in Diamond.
- **Severity:** **P1**.
- **Smallest robust fix:** `stages[]` plus `pathways[]`, with explicit transitions and references from scoped facts. Avoid a general workflow engine; only model named stages, branches, dates, and conditions.
- **Migration impact:** moderate.
- **Before more real cards?** Yes.

## P1-8 — Applicability and the 13 core disclosure dimensions

- **Affected fields:** all 13 core fields and `getDisclosureCount`, especially `institution_relationship`, `estimated_total_mandatory_cost`, `financial_aid`, and `refund_policy`.
- **TechRise example:** institution relationship, financial aid, and refund policy are legitimately not applicable to a free school-team competition, while cost/date information is not yet published. The card displays only 6 of 13 core facts disclosed despite all 59 fields being reviewed.
- **Lumiere example:** 11 of 13 core fields disclose, but tiered cost and incomplete refund terms prevent scalar core disclosure even though the underlying pricing research is detailed.
- **Diamond example:** 10 of 13 core fields disclose; financial aid/refund are poor fit for a prize competition, while conditional travel prevents a single total cost.
- **Information lost or distorted:** review completeness is conflated with source disclosure and field applicability. `not_applicable` receives no credit, so the count can make a fully reviewed competition look incomplete.
- **Can a note represent it?** No; the misleading aggregate is computed outside fact notes.
- **Frequency:** repeated across all three cards.
- **Severity:** **P1**.
- **Smallest robust fix:** report three numbers: assessed core fields, applicable core fields, and disclosed applicable core fields. Preserve the 13 dimensions; do not change which fields are core in this repair.
- **Implemented display:** the meter leads with `X of 13 core areas assessed` (`13 of 13 core areas assessed` when complete); detail begins `X of Y applicable disclosed`, followed by nonzero not-found, unclear, conflicting, not-applicable, and unassessed counts.
- **Migration impact:** low; no card-data migration, only registry/count/UI logic.
- **Before more real cards?** Yes, because it affects every public comparison.

### Core-dimension applicability conclusion

The 13 dimensions remain useful review prompts for all three opportunities. They are not all meaningful as positive disclosures for every opportunity type. Identity, eligibility, participation, selection, benefits, and material terms transfer well. Institution relationship, total mandatory cost, financial aid, and refund policy are often valid `not_applicable` or structurally conditional results. Keep the dimensions; repair the completeness metric and add scoped records rather than dropping them.

## P1-9 — Cycle identity and card version are separate concepts

- **Affected fields:** top-level `slug`, `summary`, `cardVersion`, `reviewedAt`, plus all cycle dates.
- **TechRise example:** “2026–2027” exists only in the slug/summary and evidence; the cycle is announced but not yet open.
- **Lumiere example:** Fall 2026 is one cohort among others on the same product page; it is encoded in the slug/summary, not as queryable cycle metadata.
- **Diamond example:** the 2027 cycle begins in September 2026 and ends in April 2027; card version `1` is unrelated to competition year.
- **Information lost or distorted:** cycle label, cycle status, coverage dates, and distinction between annual-cycle replacement and a revision to the same reviewed record.
- **Can a note represent it?** Human-readable only; filtering and stale-cycle detection are lost.
- **Frequency:** repeated across all three cards.
- **Severity:** **P1**.
- **Smallest robust fix:** add a top-level `cycle` object with stable opportunity ID, cycle label, status, and optional coverage/open/close dates. Keep `cardVersion` solely for revisions.
- **Migration impact:** low-to-moderate; populate manually for current real cards and optionally leave null for evergreen demos.
- **Before more real cards?** Yes.

## P2-1 — Age ranges lack a normalized representation

- **Affected fields:** `ages` and normalized-value vocabulary.
- **TechRise example:** grade eligibility is primary; no numeric age range was published.
- **Lumiere example:** grades are published, but no numeric age range is available.
- **Diamond example:** ages 14–18 are exact, but `ages` accepts only untyped text because there is no age-range normalized kind.
- **Information lost or distorted:** numeric range filtering for the one card that supplies an exact age range.
- **Can a note represent it?** Yes, fully enough for reading.
- **Frequency:** one observed positive case; likely recurring.
- **Severity:** **P2**.
- **Smallest robust fix:** add a generic inclusive numeric-range normalized kind or an age-range kind.
- **Migration impact:** low.
- **Before more real cards?** No; include opportunistically in schema v2.

## Recommended smallest repair phase

Do not redesign every fact. Make one schema-v2 additive pass with five narrowly scoped structures:

1. `cycle` metadata, separate from `cardVersion`.
2. `organizations[]` and `relationships[]` for role-safe identity claims.
3. `variants[]` for tier/cohort-bound costs, durations, formats, and locations.
4. `stages[]`/`pathways[]` for selection chronology and conditional obligations.
5. `outcomes[]` for prize/funding/benefit type, amount, recipient scope, distribution, and conditions.

Keep the existing 59 facts as reviewed summary projections for UI continuity and migration. Update the core counter to distinguish assessed, applicable, and disclosed. This is the smallest repair that addresses every observed P1 without turning the card into an unrestricted graph or changing the 13 core review prompts.
