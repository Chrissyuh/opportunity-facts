# Source-disclosure comprehension study protocol

Protocol version: `1.0-draft`
Evidence status: **not run; no results are claimed**

## 1. Research question

When the underlying source information is held constant, does a standardized Opportunity Facts card change a participant's ability to correctly identify disclosed, missing, unclear, and conflicting facts compared with a conventional source-page packet?

This protocol measures factual comprehension, completion time, evidence use, and confidence calibration. It does **not** measure whether an opportunity is legitimate, prestigious, safe, valuable, or likely to affect admission.

Before recruitment, create a dated frozen copy of this protocol and fill in:

| Item | Value to freeze |
| --- | --- |
| Study identifier | |
| Product commit/release | |
| Schema and field-registry version | |
| Fixture-set version and hashes | |
| Intended population | |
| Recruitment channel | |
| Target sample and rationale | |
| Primary outcome | |
| Primary comparison and interval/test | |
| Exclusion rules | |
| Stop rule | |
| Data-retention/deletion date | |
| Ethics/institutional review determination | |

Do not choose or revise these entries after inspecting confirmatory outcomes.

For a feasibility study, justify the target by the precision and operational uncertainty it can reasonably provide; do not call it powered for a confirmatory claim. For a confirmatory study, perform the sample-size calculation from a prespecified smallest meaningful paired difference, error rates, and within-participant variability estimated from independent pilot/literature data. Account for planned exclusions and incomplete pairs before recruitment, not after observing the effect.

## 2. Design

Use a randomized, counterbalanced, within-participant crossover design. Each participant completes two matched but distinct fictional opportunity tasks:

- one task with an Opportunity Facts card;
- one task with a conventional packet containing the source-page text used to make that card.

Never show the same opportunity in both formats to the same participant; that would create answer carryover. Prepare at least two matched fixture sets, A and B. Assign participants as evenly as practical to four sequences:

| Assignment | Block 1 | Block 2 |
| --- | --- | --- |
| 1 | Card A | Sources B |
| 2 | Sources A | Card B |
| 3 | Card B | Sources A |
| 4 | Sources B | Card A |

Generate the assignment independently of participant characteristics, record it before the first task, and preserve assignment failures. If a technical constraint forces a different design, document it before collection and analyze it accordingly.

### Fixture matching

Fixtures A and B should have the same number and approximate complexity of source pages and the same scored constructs. Each should deliberately include:

- facts directly disclosed;
- at least one fact not found in the reviewed sources;
- at least one ambiguous or unclear fact;
- at least one supported conflict;
- an institution-relationship distinction;
- cash and in-kind outcome information;
- a material money or terms question;
- at least one schema V2 distinction that a scalar summary cannot hold, such as tiered prices, stage/pathway-specific obligations, or team versus individual outcomes.

Use fictional organizations and `.example` URLs for the first study. The card and source condition must expose substantively identical source content. Structured card details may reorganize claims by organization, variant, stage, pathway, cost, or outcome, but may not add a value, scope, condition, or inference absent from the source packet.

## 3. Participants and ethical gate

Define inclusion and exclusion criteria before recruitment. A low-friction initial evaluation should use consenting adults (for example, parents, educators, or students who are at least 18) unless an appropriate reviewer has approved a minor-participant process.

If anyone under 18 may participate, stop recruitment until the responsible school, fair, institution, or qualified research supervisor determines the required review, guardian permission, and participant assent. Do not assume a project is exempt merely because it is low risk or educational. Follow [`consent-and-privacy-notes.md`](./consent-and-privacy-notes.md).

Do not recruit people whose grades, program access, employment, or relationship with the researcher could reasonably depend on participation unless coercion safeguards have been reviewed. Compensation, if any, must not depend on answer accuracy.

## 4. Materials

Prepare and freeze:

1. the two fixture source packets;
2. the corresponding Opportunity Facts cards;
3. a source-derived answer key with exact supporting excerpts, structured scope/reference bindings, and expected flat projections;
4. ten scored questions per fixture;
5. neutral task instructions;
6. the four-sequence assignment list;
7. the local data-capture form or runner;
8. a protocol-deviation log;
9. the consent/assent materials and debrief.

Two reviewers should independently answer every scored question from the frozen source packet. They then reconcile differences and sign off on the key before confirmatory collection. Record unresolved source ambiguity as `unclear` or `conflicting`; do not force a single answer.

## 5. Question blueprint and scoring

Use the same constructs in both fixtures. A recommended ten-item blueprint is:

1. operating organization;
2. relationship to a named institution;
3. tier/pathway-specific mandatory cost or whether one total can be calculated;
4. whether travel, lodging, or meals are included;
5. a cycle/stage-specific deadline or required time commitment;
6. what selection evidence is published;
7. cash versus project/in-kind outcomes and the recipient scope;
8. refund or cancellation terms;
9. privacy, project-rights, or publicity terms;
10. recognition of a fact that is not found, unclear, or conflicting.

Write questions that have a source-derived answer. Do not ask participants whether they trust, like, would apply to, or think the opportunity is a scam.

Create a closed response codebook before data collection. Each item should have:

- a stable `question_id` and construct;
- allowed response codes, including `not_found`, `unclear`, and `conflicting` when applicable;
- one or more accepted answer codes;
- an exact supporting excerpt or an explicit record that no support was found;
- a deterministic rule for `is_correct`;
- a rule for whether the evidence-location response is correct.

Do not score text using ad hoc similarity after seeing responses. If free-text is essential, blind two raters to condition and adjudicate under a frozen rubric.

## 6. Outcomes

### Primary outcome

Choose and freeze one primary outcome. The recommended outcome is the participant-level difference in proportion of correctly answered questions between card and source conditions.

### Secondary outcomes

- completion time per block, in milliseconds;
- correct recognition of `not_found`, `unclear`, and `conflicting` states;
- correct identification of the supporting page or evidence;
- confidence on a 0-100 scale after each response;
- calibration, reported as the gap between confidence and observed correctness;
- skipped questions and technical failures.

Completion time is not inherently beneficial: a faster wrong answer is not an improvement. Report time alongside accuracy, not as a standalone win.

## 7. Procedure

1. Confirm eligibility and complete the consent gate before recording task data.
2. Create a random participant ID. Do not place a name, email, school, exact birthday, or recruitment contact in the results file.
3. Assign one of the four sequences and record the assignment.
4. Explain the five evidence statuses in neutral language. Do not demonstrate answers from a study fixture.
5. Start block 1. Show only the assigned artifact. Record a monotonic start time.
6. For each question, record the response code, confidence, elapsed time, and whether evidence was opened or cited. Do not record keystrokes or unrelated browsing.
7. End block 1 and offer a short neutral break.
8. Repeat for block 2 with the other fixture and presentation condition.
9. Record technical failures and deviations without editing prior answers.
10. Show a debrief explaining the study question and how to request withdrawal, if withdrawal remains possible under the approved data design.
11. Export locally to the empty [`results-template.csv`](./results-template.csv) structure. Send nothing to a server unless that data flow was specifically reviewed and disclosed before consent.

Do not coach participants, explain source language during the task, or rescue an answer. If assistance is needed for accessibility, use a standardized accommodation and record its nonidentifying deviation code.

### Export data dictionary

Use UTF-8 CSV with the template's exact header and one row per scored or skipped question. Do not add free-text columns during collection.

| Column/group | Allowed content |
| --- | --- |
| `study_run_id`, protocol/product/schema/fixture versions | Frozen manifest identifiers; identical for all rows in one run |
| `participant_id` | Cryptographically random nonidentifying ID |
| `consent_gate_passed` | `true` only; no row is recorded before the gate |
| `assignment_id` | One of the four frozen assignment codes |
| `block_number` | `1` or `2` |
| `condition` | `card` or `sources` |
| `fixture_id`, `question_id`, `construct` | Stable values from the frozen fixture/question manifest |
| `response_code` | One allowed closed code from that question's codebook; blank only when skipped |
| `is_correct` | `true` or `false`; blank only when a technical failure prevented exposure/scoring under a frozen rule. A participant skip is normally `false`. |
| `confidence_0_100` | Integer 0-100, or blank when skipped before confidence was requested |
| `question_elapsed_ms`, `block_elapsed_ms` | Nonnegative integer milliseconds from a monotonic timer |
| `evidence_opened` | `true` or `false` |
| `evidence_response_code` | Stable page/evidence code, or blank when none was requested/provided |
| `evidence_is_correct` | `true`, `false`, or blank when not scored |
| `skipped_reason_code` | Blank, `participant_skip`, `timeout`, `technical_failure`, or another frozen code |
| `recorded_at_utc` | RFC 3339 UTC timestamp; omit from public participant-level release |
| `device_class` | `desktop`, `mobile`, `tablet`, `other`, or `unknown` |
| accommodation/deviation codes | Blank or a predefined nonidentifying code; details stay in a restricted operational log |
| `analysis_inclusion` | `true` or `false` under the frozen exclusion rules |
| `exclusion_reason_code` | Blank when included; otherwise one predefined exclusion code |
| `data_quality_flag` | `pass`, `review`, or `fail` under a frozen validation rule |

CSV cells must not contain names, contact details, schools, unreviewed notes, commas/newlines copied from source pages, or participant quotations.

## 8. Data-quality checks

Before analysis, validate that:

- participant IDs are unique and contain no direct identifier;
- `consent_gate_passed` is true for every exported row (it is not a copy of the consent record);
- every participant has a valid assignment;
- fixture, condition, and block agree with the assignment table;
- each `(participant_id, fixture_id, question_id)` row is unique;
- correctness was generated from the frozen codebook;
- confidence is an integer from 0 through 100;
- elapsed values are nonnegative milliseconds;
- timestamps use UTC and are not used to infer location;
- missing values use documented codes rather than invented answers;
- protocol deviations and prespecified analysis exclusions are preserved rather than silently dropped.

Keep consent records and recruitment contacts outside the analytic CSV. If a participant withdraws under the approved procedure, remove their analytic rows and retain only the nonidentifying operational count needed for the participant-flow report. If a temporary linkage is required for withdrawal, encrypt it, restrict access, and delete it on the declared schedule.

## 9. Analysis plan

Analyze only after the dataset is locked and checks pass.

1. Publish a participant flow: approached if known, consented, started, completed, excluded, withdrawn, and analyzed.
2. Apply only the frozen exclusion rules. Show results with and without exclusions if exclusions could change the conclusion.
3. For each participant and condition, calculate `correct items / all scheduled scored items`; count participant-chosen skips as incorrect. Report an answered-item sensitivity analysis and technical nonexposure separately so condition-dependent skipping cannot inflate accuracy.
4. Estimate the paired card-minus-sources difference in accuracy with a confidence interval. State the exact interval or test method selected in advance.
5. Report item-level numerators and denominators, especially for missing/unclear/conflicting recognition. Treat item-level tests as exploratory unless separately powered and prespecified.
6. Summarize completion time using medians and interval estimates or a prespecified transformation robust to long tails.
7. Report confidence and calibration by condition. Do not interpret higher confidence as better without corresponding accuracy.
8. Inspect fixture and order effects. If large, report them as limitations rather than hiding them in a pooled average.
9. Report missingness, technical failures, protocol deviations, and all prespecified outcomes.

Avoid a binary “works/does not work” conclusion. A small or imprecise study is a feasibility result. Statistical significance alone is not practical importance, and a nonsignificant result is not proof of equivalence.

## 10. Stop and deviation rules

Pause collection if the wrong fixture or answer key is deployed, randomization is broken, consent is bypassed, identifying data enters the analytic export, or participants can see answers from the other condition. Preserve affected rows; do not silently delete them. Document the time, scope, decision, and repair before restarting.

Participants may stop at any time without penalty. Follow the approved withdrawal procedure and never retain withdrawn data merely to preserve sample size.

## 11. Reporting checklist

A public report must include:

- the exact research question and design;
- frozen protocol, product, fixture, schema, and code versions;
- recruitment, eligibility, participant flow, and consent/approval process;
- the question blueprint and scoring method;
- assignment and counterbalancing;
- all prespecified outcomes with raw denominators and uncertainty intervals;
- exclusions, missing data, deviations, and adverse events;
- fixture, order, accessibility, and generalizability limitations;
- disclosure that fictional fixtures may not represent live program sites;
- a statement that comprehension does not establish real-world truth, legitimacy, prestige, value, safety, or admissions impact.

Until this process is complete, the product should display **Study not yet published** and no placeholder statistics.
