# Post-evaluation extraction hardening

Initial phase date: 2026-08-12

Continued hardening date: 2026-08-20

Starting commit: `6c40a0b279ba2cc69f84b07673ca6ebcd0417caf`

Preservation tag: `post-eval-hardening-start`
First committed hardening checkpoint: `3cd7ea1b39aaa9ea9caa36c6a0eafa345a9b4772`

This work begins after the preregistered seven-opportunity evaluation closed. It does not alter or replace any historical development-set or out-of-sample result. The ten human-reviewed cards are development material; frozen reports remain historical evidence.

## Extraction architecture

### Before post-evaluation hardening

One provider response had to return all 59 flat facts and every Schema V2 structured family. One truncated response therefore produced no draft, and competing output demands contributed to sparse structured records.

### Current production path

The current path uses four bounded strict-output families in two waves:

1. `facts`: all 59 summary candidate facts;
2. `foundation`: cycle, organizations, roles, relationships, and variants;
3. `process`: stages and pathways;
4. `financial`: costs and outcomes.

`facts` and `foundation` run concurrently. After both settle, `process` and `financial` run concurrently with only the strict-schema candidate foundation IDs and scope context, explicitly labeled as untrusted candidate data. This preserves useful structure while reducing one-response competition; final deterministic evidence, scope, and reference checks still decide whether any cross-reference survives.

Every family sets `store: false`, uses low reasoning effort, has a 120-second SDK timeout, and has zero automatic retries. The source budgets remain 120,000 characters for summary facts and 70,000 characters per structured family. Output ceilings are 12,000 tokens for facts, 14,000 for foundation, 12,000 for process, and 12,000 for financial. A provider result is accepted only when its status is exactly `completed`, its output is valid JSON, and it passes that family's strict schema.

A malformed, incomplete, timed-out, or failed family is withheld while independently completed families may still form a visibly partial draft. A failed summary family yields `unclear`, never false `not_found`, classifications. If all four families fail, no draft is displayed. Each family records independent provider telemetry when available.

## Deterministic semantic repairs

Exact excerpt presence remains necessary but is no longer sufficient. Candidate claims are rejected when the real excerpt has the wrong subject, scope, value, relationship, or financial semantics.

### Subject and scope

Validation distinguishes applicant/participant, team, teacher/adviser, parent/guardian, school, organizer, platform/account user, institution, employee/mentor, website visitor, finalist/winner, historical cohort, and generic legal-service subjects. It withholds, among other cases:

- platform/account minimum age from program eligibility;
- legal jurisdiction or service availability from participant geography;
- minor-account supervision from a program adviser requirement;
- an organizer office from participant location;
- teacher/school benefits from participant outcomes;
- finalist-only travel or duties from universal applicant requirements;
- optional communications/account services from opportunity requirements;
- generic program description from a claimed selection process;
- generic platform privacy, content, refund, or discontinuation terms when the target opportunity is not established;
- a name-only organization excerpt from the primary-operator fact.

Structured stages, costs, and outcomes receive the same scope checks. Participant summary projections now include only participant-, team-, or project-scoped outcomes; educator-, school-, and organization-scoped outcomes remain visible in rich details without becoming student cash or in-kind benefits.

### Typed and referenced claims

The post-checkpoint guard layer also requires:

- typed money, number, percentage, duration, date, and enum values to agree with the exact cited wording rather than merely coexisting in the same excerpt;
- organization roles and relationships to cite the actual referenced entity names, preventing evidence for one organization from binding to another ID;
- optional and conditional charges to retain those semantics instead of projecting as universally mandatory tuition, deposits, or totals;
- participant/team cash to be explicit cash, not restricted experiment, build, project, or venture funding;
- stipends, reimbursements, educator prizes, and project budgets to use evidence that states the corresponding financial nature and recipient;
- same-excerpt conditional pricing alternatives to remain scoped alternatives rather than artificial conflicts.

Project funding cannot project into personal cash. Optional costs cannot create mandatory-cost facts. A modeled but incomplete cost inventory still cannot produce a total.

## Cycle resolution

A deterministic cycle resolver runs before extraction and before final acceptance. It handles explicit year ranges (including abbreviated ranges), seasons, year-before-season wording, annual competition/cohort labels, announced dates pending for a named year, rolling monthly cohorts, and application-year versus participation-year wording. It uses page titles and target-page context but does not use sibling pages as the cycle anchor.

Historical statistics, prior-year outcomes, eligibility school-year references, and unrelated years cannot populate current-cycle fields. When multiple candidates remain incompatible, no model-proposed cycle can override that ambiguity: cycle-sensitive dates, applicant/acceptance counts, and rates are withheld. Explicitly supported rolling cycles do not acquire a fabricated year, season, or open/closed status.

## Target-program relevance

Same-origin discovery and claim acceptance now use submitted-page title, early named headings, opportunity path, target identity tokens, and cycle context. A different named opportunity path takes precedence over generic title overlap. Organization-wide and unclear pages require explicit target identity in the page or cited excerpt before they may support target-specific eligibility, dates, selection, costs, outcomes, or requirements.

Every citation attached to a target-specific claim must pass the target check; one sibling citation is enough to withhold the candidate. Same-organization sibling pages may still support genuinely organization-level identity when the evidence says so.

## Acquisition and route reliability

Static acquisition preserves bounded semantic reveal shells and reads only allowlisted Schema.org Course, Offer, FAQPage, Question, Answer, and Organization fields from non-executable JSON-LD. Those values remain hostile publisher text and receive the same evidence validation.

Hostile DOM processing was rewritten around bounded iterative traversals for simple CSS-hidden selectors, reveal shells, generic content containers, nested lists, block quotes, and inline text. Deep or repeated structures no longer cause recursive stack failure or repeated full-subtree rescans.

Public URL acquisition now accepts only protocol-default ports. Local/private/link-local/service addresses, credentials, sensitive query/fragment tokens, unsafe redirects, and non-default-port targets fail before a second transport attempt.

The analysis route now:

- requires JSON and rejects a mismatched browser `Origin` when present;
- bounds the request body at 600 KB and ten seconds of total read time;
- provides the `ANALYSIS_ENABLED` server-side kill switch;
- admits a bounded number of simultaneous requests per Node.js process, including body reading;
- enforces a 270-second application deadline inside the 300-second route envelope;
- propagates client/deadline cancellation into acquisition and provider work;
- returns controlled errors for disabled, saturated, aborted, and timed-out work;
- releases local admission capacity on every controlled exit.

These are local defense-in-depth controls, not distributed abuse prevention. Public analysis must remain disabled until durable aggregate rate/concurrency limits and a hard provider-or-gateway spend circuit breaker are proven in the target deployment; see `docs/DEPLOYMENT_CHECKLIST.md`.

## Human-reviewed card corrections

Two defects were independently re-reviewed against retained source evidence. Historical evaluation numbers remain frozen.

- **Breakthrough Junior Challenge, revision 2:** the $50,000 teacher prize now has explicit `educator_cash_prize` type, educator recipient scope, and educator payee. The school laboratory remains school-scoped. Neither projects into participant cash or in-kind summaries.
- **Polygence Core Program, revision 2:** the retained evidence supports rolling monthly cohorts, not an authoritative Fall 2026 year/season or a currently open status. The cycle now reads `Rolling admissions`, omits year and season, uses rolling cycle type, and leaves current status unclear.

The review notes document both changes and the generated public artifacts are rebuilt from the revised cards. Neither correction retroactively changes the closed out-of-sample score.

## Product and judge experience

- Draft, human-review, source-omission, evidence-interpretation, and non-verdict boundaries remain prominent.
- The disclosure meter leads with applicable core facts disclosed, then gives assessed/not-found/unclear/conflicting/not-applicable counts. It is explicitly not a trust or quality score.
- Analyzer progress is now an honest indeterminate server-work state with elapsed time, not simulated stage completion.
- Failed discovered pages expose sanitized paths and bounded reason categories, plus a direct handoff to pasted-source mode.
- Reviewed opportunities and fictional demos are visually separated in the library; mobile filters collapse so results are not pushed below a wall of controls.
- Mobile comparison shows an explicit swipe/button cue while keeping fact names pinned.
- Imported non-repository card files lose review attestation before comparison, while byte-identical repository cards retain their public reviewed state.

## Offline development evidence

Frozen candidates and source snapshots are replayed without changing their historical artifacts. General fixtures cover the four closed evaluation critical errors plus platform age, jurisdiction, minor supervision, organizer office, teacher/school recipient, finalist scope, optional service, historical counts, prior-year wording, multiple years, application/participation years, seasons, rolling/evergreen cycles, sibling programs, typed numeric/date/money mismatches, wrong organization references, optional/mandatory costs, restricted funding versus cash, truncation, timeout, family failure, partial completion, conditional pricing, reveal shells, hostile deep DOM structures, and bounded Schema.org metadata.

The final release gate completed with 32 Vitest files / 375 tests, 84 Playwright passes plus 4 intentional project-inapplicable skips, 17 validated public cards, a 30-page production build, and zero high-severity dependency vulnerabilities.

## Live checks and API usage

### Completed at committed checkpoint `3cd7ea1`

No provider call was made while the first architecture, acquisition, deterministic validation, fixtures, or browser behavior were changing. One private Lumos URL analysis then ran through the then-current three-family production path. It acquired the homepage, Terms, and Privacy pages, excluded an adjacent same-site competition, recorded two cross-origin form redirects as acquisition failures, and remained a draft.

Offline replay of that exact paid candidate after generalized deterministic repairs produced:

- critical misleading errors: **0**;
- displayed supported-claim precision: **18/18 (100%)**;
- semantic evidence correctness: **18/18 (100%)**.

It recovered six-week duration, scholarship-adjusted pricing/aid percentages, conditional refund terms, mentorship, program materials/alumni support, participant project ownership, personal-data collection/sharing, enrollment condition, and material terms. It conservatively withheld operator role, cycle/dates, participant location, acceptance statistics, cash outcomes, institutional partnerships, and other unsupported values.

Important misses remained: standard `$4,500` tuition, fully online format, the application-review/15-minute-interview flow, mentor affiliations, and current cohort dates. A later allowlisted JSON-LD acquisition repair exposed several of those source statements to future analysis, but no second paid run was used to claim recovery.

The checkpoint call used three Responses requests, 57,514 reported input tokens, 12,835 reported output tokens (including 1,805 reasoning tokens), and 70,349 total tokens. Its recorded estimated cost was `$0.269048` using the rates stated in the immutable benchmark reports.

### Current post-checkpoint continuation

The completed four-family path made exactly **four** paid development analyses on `gpt-5.6-terra` with low reasoning effort, `store: false`, zero automatic retries, and the production timeout/output bounds. The fourth was the one budgeted final confirmation after the first Lumos result exposed a general critical cost-completeness defect. The ignored local artifacts retain candidates, acquisition metadata, warnings, family telemetry, and final drafts without keys or authorization headers.

| Development check | Input tokens | Cached input | Output tokens | Runtime | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Breakthrough Junior Challenge | 107,276 | 0 | 21,833 | 121.9 s | `$0.4765480` |
| QuestBridge National College Match | 94,401 | 47,526 | 24,034 | 131.4 s | `$0.3916632` |
| Private Lumos judge path | 66,676 | 52,501 | 18,110 | 97.9 s | `$0.2561702` |
| Private Lumos final confirmation | 67,834 | 0 | 17,181 | 92.2 s | `$0.3418400` |
| **Total** | **336,187** | **100,027** | **81,158** | — | **`$1.4662214`** |

The estimate uses the repository's recorded model rates of `$2/M` uncached input, `$0.20/M` cached input, and `$12/M` output; dashboard settlement may differ. No call was repeated merely to improve a result.

- **Breakthrough** completed all four families over seven pages. It exposed general whitespace-boundary, natural date/time, educator-recipient, and mixed-recipient projection defects. The frozen candidate's offline replay after those repairs retains the six-stage process and scholarship while withholding teacher/school money from participant summaries; no known critical misleading claim remains.
- **QuestBridge** acquired six of seven reviewed URLs, all four reviewed source categories, no sibling College Prep Scholars page, and no fetch failure. All four provider responses completed, but the financial family violated a local cross-field contract and was withheld in the paid result. That paid result had 16/19 strict summary precision, 32/33 flat semantic evidence correctness, 6/7 structured-entity precision, 6/16 structured-entity recall, and zero critical misleading errors. It correctly withheld the historical 2025 count. The exact candidate then drove general per-record family salvage, adjacent-year lifecycle handling, pathway-step salvage, external-college-admission separation, deadline projection, and process-link ranking. Current offline replay has 18/20 strict summary precision, 18/28 summary recall, 35/35 summary evidence correctness, 5/6 structured-entity precision, 5/16 structured-entity recall, and zero critical errors. Stage/object binding remains a documented P1, and ranking improvements require a future ordinary acquisition run rather than a back-claim about the paid artifact.
- **Lumos** completed all four families over four acquired pages with no truncation. The first paid result had 17/20 strict summary precision, 22/26 summary semantic-evidence correctness, 27/29 structured precision, and one critical error: `$4,500` tuition was incorrectly shown as a complete mandatory-cost total. General deterministic repairs preserve tuition as one item in an incomplete inventory, withhold the total, reduce selection to application then interview, distinguish multiple same-stage deadlines, and recover source-backed refund, participant-IP, privacy, sharing, and material-term claims. After every deterministic and browser gate passed, one budgeted final provider confirmation completed without retry: 27/27 supported summary claims with 35/35 semantically correct summary evidence attachments, 23/23 supported structured claims with 23/23 correct structured attachments, and zero critical errors. It correctly modeled Fall 2026, both application deadlines, person-level Duke mentor affiliation, tuition/aid/refund, selection, IP/privacy/terms, and imported no optional Builder Competition claim. It still omits operator/role, most mentor affiliations, detailed aid/cohort, pathway, and outcome structure.

No hostname, organization name, expected Lumos value, Lumos-specific prompt, or prewritten Lumos response exists in production code. No public Lumos card or benchmark claim was created. Lumos remains private development evidence, not a formal benchmark or a generalization claim.

## Remaining limitations

- Static acquisition cannot execute arbitrary client-rendered applications or automatically cross into unrelated origins.
- Subject/scope validation is deliberately conservative and can withhold a true mixed-subject claim for human separation.
- Deterministic lexical/typed guards materially reduce false claims but cannot prove every semantic entailment or the truth of publisher text.
- The four-family split still depends on model recall; missing remains preferable to unsupported structure.
- Per-process admission cannot enforce a deployment-wide request, concurrency, or spend limit.
- The private Lumos result is not an independent benchmark; its post-repair result is an offline replay of the one paid four-family candidate, not a replacement provider run.

## Verification status

The `3cd7ea1` checkpoint completed its recorded gate, and those exact historical counts remain in repository history. The current post-checkpoint continuation also completed export, validation, lint, typecheck, 375 deterministic tests, 84 passing Playwright checks with 4 intentional skips, a 30-page production build, dependency audit, diff check, independent security review, and rendered desktop/mobile inspection. The final commit SHA and push status are recorded by Git rather than predicted in this report.
