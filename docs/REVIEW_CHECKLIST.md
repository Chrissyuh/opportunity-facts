# Public card review checklist

Use this checklist before adding or updating a public Opportunity Facts card. It complements the detailed [`research/disclosure-audit-guide.md`](../research/disclosure-audit-guide.md).

Passing this checklist establishes source-to-card alignment at the recorded date. It does **not** certify the opportunity, audit the organizer's claims, give legal advice, or rate legitimacy, quality, prestige, admissions impact, or value.

## Review record

| Item | Record |
| --- | --- |
| Card slug | |
| Opportunity/application cycle | |
| Proposed card version | |
| Schema version | |
| Primary reviewer and date | |
| Independent alignment reviewer and date, if used | |
| Change type (`new`, `refresh`, `correction`) | |
| Related correction packet/issue | |

Do not put participant, applicant, or other unnecessary personal information in this record.

## 1. Scope and identity

- [ ] The card refers to one clearly identified opportunity and application cycle.
- [ ] The slug is stable, neutral, and uses lowercase letters, numbers, and hyphens.
- [ ] The primary official URL is public HTTP(S) and has no embedded credentials or private token.
- [ ] The operating organization is supported by explicit source language or is marked `not_found`/`unclear`.
- [ ] Any named institution is recorded separately from the operating organization.
- [ ] The institution relationship uses the registry category actually supported by the source; venue, alumni, staff biography, or branding alone was not treated as operation, sponsorship, partnership, or endorsement.
- [ ] The short summary is neutral and does not contain an unsupported factual value or product verdict.

## 2. Source inventory

- [ ] Each source has a unique stable ID, title, canonical URL, provenance/page type, and UTC access timestamp.
- [ ] Sources cover the relevant program page, FAQ/eligibility, money/aid, rules, terms/refund/cancellation, privacy, and relationship pages when those pages exist.
- [ ] Every source is public and reviewable; no credentials, private application content, or student records were copied.
- [ ] Search snippets, AI summaries, testimonials, and unsourced directories were not used as primary evidence.
- [ ] Sources from different cycles are not silently combined.
- [ ] Page attribution to the opportunity/operator is documented rather than inferred from visual branding.
- [ ] All fact-level source objects match an entry in `sourcePagesChecked` exactly.

## 3. Every registry field

- [ ] Every authoritative field exists once in `facts`; no component-specific or ad hoc fields were added.
- [ ] Each field uses one allowed status: `disclosed`, `not_found`, `unclear`, `conflicting`, or `not_applicable`.
- [ ] `not_found` means only that the finite recorded source review did not locate the disclosure.
- [ ] `unclear` is used when wording is relevant but cannot support one determinate value.
- [ ] `not_applicable` has an affirmative reason; it is not a substitute for missing evidence.
- [ ] Every `disclosed` value has a claim kind and at least one source-backed excerpt.
- [ ] No `not_found` or `not_applicable` field carries a hidden value or evidence.
- [ ] No `unclear` field presents unresolved wording as a settled value.
- [ ] The 13-core-fact count is computed from the central registry and described only as disclosure completeness.

## 4. Evidence alignment

- [ ] Every displayed value was checked against its cited source, not merely against a model response.
- [ ] Every excerpt matches normalized source text exactly and is long enough to preserve subject, unit, conditions, and exceptions.
- [ ] No quotation splices nonadjacent text or silently changes source wording.
- [ ] Subject/population is correct: applicant, participant, finalist, winner, team, or school was not substituted for another.
- [ ] Date year, cycle, timezone, precision, and deadline conditions are preserved when disclosed.
- [ ] Money currency, amount/range, unit, payer/recipient, required/optional status, and conditions are preserved.
- [ ] Normalized values retain the original value/display wording and do not add precision or meaning.
- [ ] Evidence matcher failures were removed or downgraded rather than waived.

## 5. Money, selection, outcomes, and terms

- [ ] Zero cost is supported and not confused with cost `not_found`.
- [ ] Application fees, deposits, tuition, and other mandatory costs remain separate.
- [ ] Deposit refundability was not inferred.
- [ ] Total mandatory cost is source-stated or visibly calculated from complete, compatible, cited inputs; exclusions are disclosed.
- [ ] Travel, lodging, and meals are each represented without assuming inclusion.
- [ ] Financial aid availability and limitations use the source's actual scope.
- [ ] Applicant and acceptance/winner counts use the same population and cycle before any rate is calculated.
- [ ] A calculated acceptance rate preserves inputs/formula and is labeled calculated; a source-stated rate without counts is labeled organizer-stated.
- [ ] “Selective” or similar copy was not converted into a numerical rate.
- [ ] Cash awards and stipends remain distinct from waivers, program seats, certificates, mentorship, and organizer-assigned in-kind value.
- [ ] Project ownership, project license, publicity rights, data sharing, confidentiality, cancellation, and refund language are summarized neutrally without a legal verdict.

## 6. Conflicts and uncertainty

- [ ] Every incompatible supported current value is preserved under `conflictingValues` with its own evidence.
- [ ] A conflicting fact does not select a preferred top-level value.
- [ ] Card-level conflict metadata exists for every conflicting fact and no nonconflicting fact.
- [ ] Cycle, population, unit, and source recency were checked before declaring a conflict.
- [ ] Source precedence or supersession was not invented.
- [ ] Calculations do not depend on unresolved conflicting inputs.
- [ ] Notes distinguish source absence, ambiguity, source conflict, and reviewer limitation.

## 7. Review state and truthfulness

- [ ] The card remained in `data/drafts/` until review was complete; only `human_reviewed` or `organizer_confirmed` cards are moved to `data/opportunities/`.
- [ ] Automated or pasted sources remain `user_supplied`; an `official_*` or `public_record` page type was assigned only after a human verified both publisher ownership and document kind.
- [ ] Fictional data uses reserved `.example` URLs and remains visibly labeled `demo` / Demo data.
- [ ] Automated, imported, or incompletely checked cards remain `draft`.
- [ ] `human_reviewed` is selected only after a human checked value/excerpt/source alignment for every displayed fact and the full source inventory.
- [ ] `organizer_confirmed` states organizer involvement and is not presented as independent verification.
- [ ] A non-demo reviewed state has a valid `reviewedAt` timestamp.
- [ ] No real organization, response, endorsement, user count, accuracy figure, traffic figure, or research result was fabricated.
- [ ] The card contains no legitimacy, scam, prestige, worth, recommendation, or admissions-impact score or implication.

## 8. Privacy, safety, and presentation

- [ ] Excerpts contain no unnecessary personal information about applicants, participants, or private individuals.
- [ ] URLs contain no credentials, session IDs, signed query/fragment tokens, or other secrets.
- [ ] Source text is rendered as text, never arbitrary HTML or executable markup.
- [ ] Link labels and destinations are understandable and use safe external-link behavior.
- [ ] Status meaning is conveyed in words, not color alone.
- [ ] Evidence disclosures, tables/lists, correction controls, export, print, and comparison remain keyboard usable.
- [ ] The card's disclaimer accurately says it reports reviewed sources and does not rate the opportunity.

## 9. Version and file review

- [ ] `schemaVersion` matches the current exported schema.
- [ ] `cardVersion` was incremented for a substantive correction or refresh.
- [ ] `reviewedAt` and `sourcePagesChecked` reflect the current audit, not an older review.
- [ ] The JSON filename and slug follow repository conventions.
- [ ] The diff contains only intended card/source changes and does not overwrite unrelated work.
- [ ] Machine-readable exports were regenerated if the repository requires it.

## 10. Verification commands

Run from the repository root and record actual outcomes:

```powershell
npm run export:data
npm run validate:data
npm run lint
npm run typecheck
npm test
npm run build
```

For a change that affects rendering, comparison, export, or interaction, also run the relevant Playwright suite and inspect desktop, mobile, keyboard, and print output:

```powershell
npm run test:e2e
```

- [ ] Public schema/dataset export was regenerated deterministically.
- [ ] Data validation passed.
- [ ] Lint passed.
- [ ] Strict typecheck passed.
- [ ] Deterministic tests passed.
- [ ] Production build passed.
- [ ] Relevant browser checks passed, or the exact unverified item and reason are recorded below.

## Sign-off and remaining limitations

Record concise evidence, not “looks good.”

| Check | Result/evidence |
| --- | --- |
| Source-to-card pass | |
| Card-to-source pass | |
| Automated validation | |
| Browser/print verification | |
| Remaining uncertainty | |
| Decision (`draft`, `human_reviewed`, `organizer_confirmed`) | |
