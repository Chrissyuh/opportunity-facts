# Post-evaluation extraction hardening

Date: 2026-08-12
Starting commit: `6c40a0b279ba2cc69f84b07673ca6ebcd0417caf`
Preservation tag: `post-eval-hardening-start`

This phase begins after the preregistered seven-opportunity evaluation closed. It does not alter or replace any historical development or out-of-sample result. The ten human-reviewed cards remain authoritative development material.

## Architecture before and after

Before this phase, one provider response had to return all 59 flat facts and every Schema V2 structured family. One truncated JSON response therefore produced no draft, and output competition contributed to sparse structured records.

The production path now uses three bounded strict-output sections:

1. all 59 summary facts;
2. cycle, organizations, roles, relationships, and variants;
3. stages, pathways, costs, and outcomes.

Summary and foundation start independently. The detail section can reuse only the candidate foundation IDs and source-backed scopes. Every section sets `store: false`, uses low reasoning effort, has a 120-second timeout, and has zero automatic retries. A malformed, incomplete, or timed-out section is withheld while independently completed sections may still form a visibly partial draft. If every section fails, no draft is displayed.

The flat section retains the fair 120,000-character budget. Each structured section receives at most 70,000 characters selected from exact normalized blocks plus adjacent context. The output ceilings are 12,000, 14,000, and 16,000 tokens respectively.

Static acquisition now preserves a semantic primary-content reveal shell when server-rendered content is shipped with an initial opacity/transform animation. Arbitrary hidden descendants remain excluded. It also reads at most 50,000 characters of allowlisted Schema.org Course, Offer, FAQPage, Question, Answer, and Organization fields from bounded non-executable JSON-LD. Those values remain hostile publisher text and receive the same evidence checks; unknown metadata fields and executable scripts are ignored.

## Subject and scope

An exact excerpt is no longer sufficient by itself. Deterministic validation now separates participant/applicant, team, teacher/adviser, parent/guardian, school, organizer, platform/account user, institution, employee/mentor, website visitor, finalist/winner, historical cohort, and legal-service subjects. It withholds:

- platform/account age language from program eligibility;
- legal jurisdiction or service availability from participant geography;
- minor account supervision from program adult/adviser requirements;
- organizer offices from participant locations;
- teacher/school outcomes from student benefits with the wrong recipient scope;
- finalist-only duties without stage/pathway scope;
- optional communications/account services from program requirements;
- generic platform privacy, content, refund, or service-discontinuation terms when the opportunity-specific subject is not established.
- a named organization from the primary-operator fact unless the evidence explicitly states an operator/run/organization/provision relationship.

Structured stage/outcome claims receive the same recipient and scope checks.

## Cycle resolution

A deterministic cycle resolver now runs before provider extraction and again before final acceptance. It handles explicit year ranges, seasons, annual competition/cohort labels, rolling admissions, and application-year versus participation-year wording. Ambiguous multi-year and evergreen pages remain unresolved. Cycle-sensitive dates, applicant/acceptance counts, and organizer-stated rates are withheld when no target cycle is established or when evidence names a different/historical year.

## Target-program relevance

Same-origin discovery now uses submitted-page title and opportunity-path identity. A different named program path is excluded unless target identity is also explicit. Acquired pages are independently classified as target, organization-level, sibling, or unclear. Sibling pages may support an organization identity but cannot support target-specific facts or structured claims.

The private judge-path acquisition check proved this behavior on a real distributed page: the submitted program, its Terms, and its Privacy Policy were acquired, while an adjacent same-site competition was excluded. Two application links redirected to a different form origin and were recorded as failures rather than followed.

## Reliability and product behavior

- Provider `incomplete` status, empty output, invalid JSON, schema mismatch, timeout, and total-family failure have deterministic handling.
- No automatic paid retry was added.
- Partial-family completion is shown to the user; the interface no longer describes every warning as only an unsupported citation.
- A failed summary family produces `unclear` fields rather than false `not_found` absence claims.
- Draft, human-review, source-omission, evidence-interpretation, and non-verdict boundaries remain prominent.
- The disclosure meter now leads with applicable facts actually disclosed, then reports assessment coverage and status counts. Neither is a percentage or trust score.
- The sticky progress panel becomes static when a result appears, preventing it from covering the draft header and partial-completion notice.

## Offline development checks

The closed Polygence and QuestBridge first-pass candidates were replayed against exact excerpts reconstructed from the immutable artifacts. All four historical critical claims are now withheld. General fixtures cover platform age, jurisdiction, minor supervision, organizer office, teacher/school recipient, finalist scope, optional service, historical counts, previous-year wording, multiple years, application/participation years, seasons, rolling cycles, evergreen pages, sibling programs, truncation, timeout, family failure, partial completion, conditional pricing, SSR reveal shells, and bounded Schema.org metadata.

## Live-call budget

No provider call was made while the architecture, acquisition, deterministic validation, fixtures, or browser behavior were changing. One final private Lumos URL analysis was then authorized because fixtures could not prove live three-family completion or the real judge path. No exploratory prompt variants or repeat samples were run.

## Private Lumos acceptance

The one production analysis completed all three strict-output families with no family failure. It acquired the homepage, Terms, and Privacy pages; the adjacent Builder Competition was not acquired. The two cross-origin application-form redirects remained visible acquisition failures. The result stayed a draft.

The paid candidate exposed three general post-processing weaknesses: a name-only excerpt had been promoted to operator, a program-data-sharing excerpt had been over-withheld, and a scholarship-conditioned price had been labeled as cohort variation. General deterministic repairs were added and the same paid raw candidate was replayed offline. That replay produced:

- critical misleading errors: **0**;
- displayed supported-claim precision: **18/18 (100%)**;
- semantic evidence correctness: **18/18 (100%)**;
- correct recovery of six-week duration, scholarship-adjusted pricing and aid percentages, conditional refund terms, mentorship, program materials/alumni support, participant project ownership, personal-data collection/sharing, enrollment condition, and material terms;
- conservative withholding of operator role, cycle/dates, participant location, acceptance statistics, cash outcomes, institution partnerships, and other unsupported values.

Important misses remained: the live candidate did not recover the standard `$4,500` tuition, fully online format, actual application-review/15-minute-interview flow, mentor affiliations, or current cohort dates. The post-call allowlisted JSON-LD acquisition repair now exposes the published standard price, online answer, interview answer, and cohort explanation to future production analysis, but no second paid inference was run to claim model recovery. The external application form remained intentionally outside same-origin acquisition.

No hostname, organization name, expected Lumos value, Lumos-specific prompt, or prewritten Lumos response exists in production code. No public Lumos card or benchmark claim was created.

## Remaining limitations

- Static acquisition still cannot execute client-rendered applications or cross into unrelated origins automatically.
- Subject/scope validation is deliberately conservative and can withhold a true mixed-subject claim for human separation.
- The private Lumos call does not establish generalization metrics, and its post-call JSON-LD acquisition improvement was verified offline rather than with another paid sample.
- The compact family split still depends on model recall; missing remains preferable to unsupported structure.

## API usage in this phase

- Production analyses: 1
- OpenAI Responses requests: 3 (facts, foundation, details)
- Reported input tokens: 57,514 (0 cached)
- Reported output tokens: 12,835, including 1,805 reasoning tokens
- Reported total tokens: 70,349
- Estimated cost: **$0.269048**, using the same recorded model rates as the immutable benchmark reports (`$2/M` input and `$12/M` output)
- Nominal remaining balance: approximately **$0.72** from the user's supplied `$0.99` starting estimate, subject to billing lag and unreported failed-call charges

## Final verification

- `npm run export:data`: exported 17 cards and the machine-readable Schema V2 contract.
- `npm run validate:data`: validated 17 public cards (7 demo), 0 drafts, and both generated artifacts.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 27 files / 234 tests passed.
- `npm run test:e2e`: 82 passed, 4 intentional project-inapplicable skips, 0 failed, across desktop and mobile Chromium.
- `npm run build`: passed; fail-closed data validation ran first and Next generated 30 pages.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: passed; Git reported only expected line-ending notices.

Browser inspection covered the homepage, analyzer pre-run/loading/success/partial-family/provider-failure states, expanded evidence, a complex reviewed card, library, comparison, methodology, and disclosure meter at 1440×900 and 390×844. There was no horizontal page overflow or unexpected runtime diagnostic. The result-state progress panel was changed from sticky to static after inspection found it could cover the draft header on desktop.
