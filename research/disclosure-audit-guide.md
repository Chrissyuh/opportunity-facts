# Disclosure audit guide

This guide is for reviewers creating or checking an Opportunity Facts card. The task is to report what a finite set of cited sources discloses. It is not an investigation of legitimacy, a legal review, an endorsement, or a recommendation.

## 1. Freeze the review scope

Record before reviewing:

- exact opportunity name and application cycle;
- cycle-independent opportunity ID, cycle ID/label, and current schema version;
- official starting URL;
- pages in scope and why each is attributable to the opportunity or operator;
- access date in UTC;
- schema version and card version;
- reviewer identifier that does not need to be publicly personal;
- whether this is a new card, correction, or scheduled refresh.

A card is time-bounded. Do not mix dates, fees, or rules from different cycles unless the card explicitly preserves and explains that conflict.

## 2. Build the source inventory

Review the opportunity's own materials deliberately. A typical inventory includes:

1. official program/application page;
2. FAQ and eligibility page;
3. cost, tuition, fee, scholarship, or financial-aid page;
4. schedule, dates, location, and travel page;
5. selection or award rules;
6. terms, refund, and cancellation policy;
7. privacy policy and publicity/project-rights terms;
8. an official operator page explaining institutional relationships;
9. relevant public records, clearly labeled as such.

Do not treat a search-result snippet, social-media repost, testimonial, unsourced directory, AI summary, or professional-looking design as evidence. A cached or archived copy may document historical wording, but label its provenance and date; do not present it as current without a current source.

For every source record, capture:

- canonical public HTTP(S) URL;
- page title;
- provenance/page type;
- UTC access date;
- exact, context-sufficient excerpt;
- stable source ID used by facts and conflicts.

Schema V2 evidence is attached to each independently reviewable semantic claim, not only the surrounding record. A tier price, stage timing, scoped role, scoped relationship, pathway step, recipient scope, distribution rule, or use restriction needs a claim ID and supporting excerpt when displayed. One claim payload may bind inseparable typed fields supported by the same assertion, such as role + scope; split the claim whenever values have different support or uncertainty. A parent record has no blanket evidence.

Never capture account credentials, private application pages, student records, or personal contact data not necessary to the public disclosure.

## 3. Apply the status decision tree

Evaluate every field defined by the authoritative registry. Use this order:

1. **Is the field inapplicable for an affirmative, documented reason?** Use `not_applicable` and record the reason. Absence alone is not non-applicability.
2. **Do in-scope sources support two or more incompatible current values?** Use `conflicting`, preserve every supported value, and cite each one.
3. **Does an in-scope source state a determinate value?** Use `disclosed`, preserve its wording, normalize only through documented rules, and cite it.
4. **Do the sources discuss the topic but remain ambiguous or insufficient for one value?** Use `unclear`, cite the ambiguity when useful, and explain it neutrally.
5. **Was no usable disclosure located after the recorded source review?** Use `not_found` and list the relevant pages checked at card level.

`not_found` never means the fact does not exist. `disclosed` never means the statement was independently proven. If evidence cannot be matched to the source, the value cannot remain displayed as supported.

## 4. Evidence standard

A supporting excerpt must be an exact passage from the cited source after safe whitespace normalization. It must include enough surrounding context to identify the subject, units, conditions, and exceptions. A keyword hit is not enough.

Good evidence answers:

- who or what the sentence refers to;
- whether the statement applies to applicants, finalists, winners, or all participants;
- amount, currency, unit, frequency, and mandatory/optional status for money;
- year, timezone, and application cycle for dates;
- whether a benefit is cash, waiver, service, seat, mentorship, or organizer-assigned in-kind value;
- who owns or may use a project, name, image, or recording.

Do not splice nonadjacent fragments into a quotation. Use multiple source entries instead. Do not silently correct a source's wording inside the excerpt. Put a neutral explanation in the fact note.

Evidence may state an organizer claim without establishing real-world truth. For example, an official page can support “the organizer states that 500 people applied”; it does not independently audit the count.

## 5. Structured scope before flat summaries

For a real V2 card, assess cycle and every structured collection before review attestation: organizations, organization roles, institution relationships, variants, stages, pathways, cost items, and outcomes.

- Use `unassessed` only while review remains incomplete.
- Use `none_found` when the finite inventory did not disclose a record.
- Use `not_applicable` only for an affirmative domain reason.
- Use `modeled` only with one or more source-supported records.

Bind a value to the known `variantIds`, `stageIds`, and `pathwayIds` where it applies. An empty dimension means unrestricted, so never omit a scope reference merely because it is inconvenient. Distinct scoped values are not conflicts; incompatible values for the same scope are.

After structured review, let the deterministic projector create covered flat facts. Do not select one tier, track, stage, or pathway value as the universal normalized summary. A matrix/list can be disclosed and comparable without a scalar normalization.

## 6. Field-specific rules

### Operator and institution relationship

Identify the legal or operating organization only from explicit source language or an appropriate public record. Distinguish:

- `institution-operated`;
- `institution-sponsored`;
- `institution-partnered`;
- `hosted-at-institution`;
- `founded-by-affiliates`;
- `independent`;
- `unclear`.

Physical location, venue rental, alumni/faculty involvement, email domain, logo placement, or a founder's biography does not by itself prove operation, sponsorship, partnership, or endorsement. Cite both the relationship label and a concise explanation. If the source supports only “held at,” use hosted-at rather than a stronger category.

Create a separate organization record for each named entity and a separate role/relationship assertion for each supported link. Do not flatten manager, administrator, academic/credit partner, founder affiliation, mentor affiliation, or local delivery role into one operator. Scope a delivery relationship to its stage/pathway when it does not apply to the whole opportunity.

### Eligibility and commitment

Preserve conjunctions and exceptions. “Grades 9-12 and age 15 by June 1” is not equivalent to either condition alone. Record timezone and year for dates when disclosed. Do not invent a timezone or convert a date-only deadline into a timestamp. Keep required live hours separate from estimated weekly work.

Model dates, durations, formats, locations, requirements, and travel obligations on the stage/variant/pathway they describe. Preserve `expected` month precision instead of promoting it to an exact date. Use ordered pathway steps for supported branches; do not convert a pathway condition into a global rule.

### Money

For every amount, record currency, amount/range, unit, recipient/payer, and whether it is mandatory, optional, refundable, conditional, or estimated. Keep these distinct:

- application fee;
- deposit;
- tuition or mandatory program fee;
- other mandatory costs;
- travel, lodging, and meals;
- financial aid;
- cash award or stipend;
- tuition waiver;
- organizer-assigned in-kind value.

Zero and `not_found` are different. A deposit is not refundable unless the policy says so. “Up to” is a maximum, not a promised amount. An in-kind value is not cash. Calculate total mandatory cost only when every included term, unit, and arithmetic operation is visible; preserve the inputs and identify exclusions.

Create one scoped cost item per distinct price/condition. Record charge basis, tuition-credit treatment, inclusions/exclusions, and conditional refund/reimbursement separately. Mark the modeled ledger `complete` only when the review established that every relevant required/conditional participant cost was captured; otherwise mark it `incomplete`. Do not calculate one total from an incomplete ledger or across scoped tiers, conditional travel, unresolved amounts, or currencies; never add a deposit that is credited toward tuition twice.

### Selection

Use published applicant and acceptance/winner counts only for the same pool and cycle. A calculated rate must display the formula and “Calculated from published counts.” Do not calculate when denominators, populations, or years differ. A rate stated without counts is an organizer-stated acceptance-rate claim. Words such as “competitive,” “selective,” or “limited” are descriptive selection evidence, not a numerical rate.

### Outcomes

State who receives each outcome and any conditions. Separate participant benefits from finalist/winner benefits. Do not combine cash, tuition waiver, program seat, mentorship, certificate, college credit, and in-kind value into one total.

Create separate outcome records when rank, track, recipient, amount, distribution, restriction, stage, or pathway differs. A project budget is restricted funding, not personal cash, and requires a cited use restriction. Team outcomes stay team-level unless an explicit distribution says otherwise. Unknown prize amounts remain `not_found`; unsupported legacy labels are not reconstructed without evidence.

### Terms

Summarize neutrally and retain precise evidence for:

- personal information requested;
- sharing, advertising, and tracking language;
- project ownership and licenses granted to the organizer;
- name, image, video, and publicity rights;
- confidentiality;
- refunds and cancellation;
- organizer cancellation or modification rights;
- other material terms requiring attention.

Do not declare a term fair, unfair, legal, illegal, standard, or predatory. If legal interpretation is needed, say it is outside the card's scope.

## 7. Conflicts, ambiguity, and calculations

When current in-scope sources disagree:

1. verify that both refer to the same cycle, population, amount type, and unit;
2. preserve each supported value and source;
3. set status to `conflicting`;
4. explain the conflict without guessing which page controls;
5. avoid a calculation that depends on an unresolved input.

If a later dated source explicitly supersedes an older one, retain the rationale and version history rather than silently deleting the earlier record. If precedence is not explicit, keep the conflict.

A calculation is allowed only when:

- all inputs are disclosed and cited;
- units and populations align;
- the formula is deterministic and visible;
- the original inputs remain in the card;
- the result is labeled `calculated`, not source-stated.

## 8. Review-state and migration rules

- `demo`: obviously fictional `.example` data, persistently labeled Demo data.
- `draft`: incomplete, automated, imported, or not yet source-aligned by a human reviewer.
- `human_reviewed`: a reviewer checked every displayed value, excerpt, URL, provenance, normalization, status, conflict, and calculation against the recorded sources.
- `organizer_confirmed`: the organizer confirmed or supplied the information. This is not independent verification and does not replace evidence.

A V1 import is recovery input, not reviewed V2 data. Conservative migration preserves legacy facts/evidence, advances one revision, clears review attestation, records the prior digest, and leaves cycle and structured collections unassessed. Never infer V2 roles, scopes, pathways, recipients, or funding types from V1 prose. Re-review and re-attest the populated V2 card before publication.

Do not select `human_reviewed` merely because a card passed schema validation. Do not convert `organizer_confirmed` into an endorsement badge. Record review date and version for either state.

## 9. Two-pass audit

### Pass A: source-to-card completeness

- Review every in-scope source, not only model-selected excerpts.
- Confirm that material disclosed fees, dates, eligibility limits, outcomes, and terms appear in the appropriate fields.
- Confirm that all five statuses remain available and that uncertainty was not smoothed into a value.
- Confirm that conflicts and calculation inputs were preserved.
- Confirm every material structured distinction was represented and every empty collection has the correct assessment state.

### Pass B: card-to-source support

- Check every displayed value against its cited exact excerpt and URL.
- Check subject, population, year, units, qualifiers, and exceptions.
- Re-run deterministic evidence matching.
- Confirm normalization did not overwrite source wording or change meaning.
- Confirm `not_found` fields have an adequate page inventory and do not overclaim absence.
- Confirm the completeness count uses only the 13 registry-defined core dimensions and is described as completeness, not trust.
- Confirm structured claim IDs/evidence, references, scopes, and generated flat projections align with the source-backed records.

A different reviewer should perform Pass B for a public `human_reviewed` card when practical. Record disagreements and resolution; do not hide them.

## 10. Version and correction handling

Treat corrections as evidence changes, not reputation disputes. A correction packet should identify card/version, field, current value, proposed status/value, exact supporting excerpt, source URL, access date, and explanation. Validate the source before changing the card.

On any substantive change:

- increment the card version under the repository's version policy;
- update the review date and source inventory;
- retain a reviewable Git history;
- rerun schema/data validation and relevant tests;
- avoid carrying forward `human_reviewed` if the affected value/source alignment has not been rechecked.

## 11. Using card audits as a disclosure study

A multi-card disclosure audit requires a sampling protocol in addition to accurate cards. Before collecting study data:

1. define the target population, geography, opportunity types, cycle, discovery source, and collection dates;
2. publish exact inclusion/exclusion rules and a deduplication rule;
3. choose a census or reproducible sampling method; do not substitute a convenience set after seeing disclosure patterns;
4. freeze the schema/registry version, source-search procedure, status rules, and primary summary fields;
5. train at least two reviewers on a pilot set that is not part of a held-out reliability check;
6. double-code a prespecified portion or all cards and adjudicate disagreements without consulting desired results;
7. record the finite source inventory so `not_found` remains scoped to what was checked;
8. lock the reviewed dataset before aggregation.

Report counts and denominators for all five statuses by field. Publish the sampling frame, missing records, reviewer agreement before adjudication, changes made during review, and uncertainty intervals where sampling supports them. Do not merge `not_found`, `unclear`, and `conflicting` into a vague “bad disclosure” category, and do not infer deception, legality, legitimacy, quality, or value from a disclosure pattern.

Generalize only to the defined sampling frame. A small or convenience sample is descriptive evidence about those reviewed cards, not “all student opportunities.” Preserve the card/source records needed to audit aggregate counts without redistributing restricted source text or personal information.

## 12. Reviewer sign-off

Use the repository's [`docs/REVIEW_CHECKLIST.md`](https://github.com/Chrissyuh/opportunity-facts/blob/main/docs/REVIEW_CHECKLIST.md) for the final auditable gate. Sign-off means the reviewer checked source alignment under this guide. It does not certify the organizer, independently audit the claims, or provide legal advice.
