# Preregistered out-of-sample extraction evaluation

## Status and scope

This report freezes the first-pass results of the production Opportunity Facts extractor on seven previously unseen opportunity structures. The set was selected and committed before inference, every human-reviewed card was completed and committed before its automated result was revealed, and each preregistered URL received exactly one primary production-path run. No extraction, acquisition, normalization, evidence-validation, or projection logic changed during the evaluation.

The development set was NASA TechRise 2026–2027, Lumiere Fall 2026, and Diamond Challenge 2027. Those three programs were observed and tuned against. The out-of-sample set below was preregistered independently and was not used to tune the reported run.

- Frozen extractor: `f5def78cc581b3c0896662c62c2503d173793a43`, tag `evaluation-v2-frozen`
- Preregistration: `dc433e942cf3575b60aed9eb46f0d0d7d93a0ac5`
- Human ground truth: `439085efcc452f59ec492ea25b82ae564da9d851`
- Frozen first-pass outputs: `f96b4c6622646e29e6939c6144fa1384f349f18d`
- Schema: `2.0.0`
- Model: `gpt-5.6-terra`, OpenAI Responses API, low reasoning effort, `store: false`, existing production timeout and output bounds
- Run policy: one ordinary URL-path analysis per card; no retries or replacement runs

## Evaluation set

| Opportunity | Target cycle | Structural role in the set |
| --- | --- | --- |
| Congressional App Challenge | 2026 | Civic district competition; individual/team entries and district-scoped judging |
| Coca-Cola Scholars Program | 2027 | Large scholarship with application, semifinalist, and finalist stages |
| Yale Young Global Scholars | Summer 2027 | University-operated, paid, multi-session residential program |
| Polygence Core Program | Fall 2026 entry | Paid independent remote research program with mentor matching |
| MITES Summer | Summer 2027 | Free selective in-person STEM program |
| Breakthrough Junior Challenge | 2026 | Global video competition with participant, teacher, and school outcomes |
| QuestBridge National College Match | 2026 application / Fall 2027 entry | Multi-institution admission-and-aid pathway with rankings and binding/non-binding branches |

The selection rationale, canonical URLs, diversity matrix, exclusion criteria, metrics, and scoring rules are immutable in `OUT_OF_SAMPLE_PREREGISTRATION.md`.

## Scoring method

The 59-field projection was compared field by field. A supported automated claim counted as a ground-truth match only when its value and scope agreed with a disclosed claim in the frozen human card. Semantic evidence correctness was judged separately: an attachment counted only when the cited excerpt existed, supported the interpretation, and was attached to the correct object and scope. Structured records were matched by semantic identity, not by array position or wording. Undefined denominators remain undefined.

Correction burden counts the concrete edits required to turn the draft into the frozen reviewed record. It is not an accuracy score and categories can overlap for one damaged object.

## Per-card results

| Opportunity | Completed | Claim precision | Summary recall | Status agreement | Evidence correctness | Structured P / R | Critical errors | Corrections |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Congressional App Challenge | Yes | 11/22 (50.0%) | 11/17 (64.7%) | 45/59 (76.3%) | 28/31 (90.3%) | 6/10 (60.0%) / 6/10 (60.0%) | 0 | 44 |
| Coca-Cola Scholars | No | undefined | 0/18 (0.0%) | 0/59 (0.0%) | undefined | undefined / 0/11 (0.0%) | 0 | 88 |
| Yale Young Global Scholars | Yes | 10/32 (31.3%) | 10/19 (52.6%) | 27/59 (45.8%) | 39/42 (92.9%) | 4/8 (50.0%) / 4/9 (44.4%) | 0 | 79 |
| Polygence Core | Yes | 11/22 (50.0%) | 11/21 (52.4%) | 36/59 (61.0%) | 23/27 (85.2%) | 2/4 (50.0%) / 2/11 (18.2%) | 3 | 66 |
| MITES Summer | Yes | 15/25 (60.0%) | 15/23 (65.2%) | 35/59 (59.3%) | 31/34 (91.2%) | 4/4 (100%) / 4/15 (26.7%) | 0 | 59 |
| Breakthrough Junior Challenge | Yes | 16/30 (53.3%) | 16/20 (80.0%) | 16/59 (27.1%) | 41/42 (97.6%) | undefined / 0/10 (0.0%) | 0 | 73 |
| QuestBridge National College Match | Yes | 19/23 (82.6%) | 19/28 (67.9%) | 39/59 (66.1%) | 26/27 (96.3%) | undefined / 0/16 (0.0%) | 1 | 53 |

The Coca-Cola run acquired seven pages successfully, but the provider response ended as invalid unterminated JSON. The primary run therefore returned no draft. It was not retried. Claim precision, semantic evidence correctness, and structured precision are undefined rather than zero because there were no displayed claims or emitted structured entities.

## Aggregate results

- Supported-claim precision against frozen ground truth: **82/154 (53.2%)**
- Supported summary recall: **82/146 (56.2%)**
- Status agreement: **198/413 (47.9%)**
- Semantic evidence correctness: **188/203 (92.6%)**
- Structured-entity precision: **16/26 (61.5%)**
- Structured-entity recall: **16/82 (19.5%)**
- Structured cycle modeled: **0/7 (0.0%)**
- Critical misleading errors: **4**
- Correction burden: **462** edits/categories across the seven drafts

The correction ledger comprises 64 missing claims, 72 unsupported-claim removals, 215 status corrections, 10 value corrections, 12 relationship/scope corrections, 15 evidence corrections, and 74 structural corrections.

## Source acquisition

- Exact reviewed URLs acquired: **27/35 (77.1%)**
- Reviewed source categories acquired: **22/24 (91.7%)**
- Pages acquired: **43**
- Irrelevant pages included: **6**
- Fetch/parser failures: **0**

Acquisition was substantially stronger than on the development set and was not the dominant aggregate bottleneck. QuestBridge was the exception: discovery included three nearby College Prep Scholars pages and missed ranking, scholarship, and terms categories. The Coca-Cola failure happened after acquisition, during structured provider output.

## Critical misleading errors

Four displayed claims met the preregistered critical-error definition:

1. Polygence: a platform Terms minimum age was presented as program eligibility.
2. Polygence: legal-service access geography was presented as participant geography eligibility.
3. Polygence: a minor's platform supervision requirement was presented as a program sponsor/adult requirement.
4. QuestBridge: a 2025 matched-finalist count was presented as a 2026 acceptance count.

No project budget was turned into personal cash, no team prize was turned into individual cash, and no founder/mentor affiliation was upgraded to an institutional partnership in these seven runs. Zero-critical-error behavior nevertheless did **not** generalize.

## Development-set comparison

| Metric | Final development set | Preregistered out-of-sample set |
| --- | ---: | ---: |
| Supported-claim precision | 52/54 (96.3%) | 82/154 (53.2%) |
| Summary recall | 50/88 (56.8%) | 82/146 (56.2%) |
| Status agreement | 96/177 (54.2%) | 198/413 (47.9%) |
| Semantic evidence correctness | 70/72 (97.2%) | 188/203 (92.6%) |
| Structured precision | 12/12 (100%) | 16/26 (61.5%) |
| Structured recall | 12/69 (17.4%) | 16/82 (19.5%) |
| Critical misleading errors | 0 | 4 |
| Correction burden | 152 | 462 |

The precision improvement did not generalize under the frozen-ground-truth metric. Evidence attachment correctness remained high, and structured recall remained low. Repairs that did generalize include exact-excerpt enforcement, project/team cash distinctions, relationship-type guards, incomplete-cost conservatism, and structured family salvage. New failures centered on generic legal terms being mis-scoped as program requirements, historical counts being attached to the current cycle, missing cycle structures, sparse structured output, and one invalid structured response.

## Ground-truth completeness limitation

Scoring revealed an evaluation-integrity limitation: several official claims extracted from acquired pages were semantically supported but absent from the already frozen human card. Yale was the clearest example, including current eligibility, tuition/application-fee, refund, certificate, and travel language. The anti-leakage rule correctly prevents changing ground truth after seeing automated output, so those claims remain precision mismatches in the primary metric even when their evidence was judged correct.

This does not justify retroactive ground-truth editing or a more favorable headline number. It demonstrates that seven independent manual reviews need a second blind adjudication pass in a future evaluation. The separate 92.6% semantic-evidence metric exposes the distinction; the 53.2% ground-match precision remains the preregistered result.

## Runtime, tokens, and cost

The seven primary runs took **652,404 ms (10m 52.4s)** in total. The six successful responses reported 342,404 input tokens, including 220,750 cached input tokens; 79,563 output tokens; 1,954 reasoning tokens; and 421,967 total tokens. Using the recorded model rates, reported usage is estimated at **$1.242214**.

The failed Coca-Cola response exposed no token telemetry to the harness, so the actual provider-billed total is unknown and may be higher. No key, authorization header, or sensitive request metadata is retained.

## Conclusion

On this preregistered seven-opportunity evaluation set, the extractor was often useful for locating cited statements and building a partial review draft, but it was not safe enough for unattended publication and did not preserve the development set's zero-critical-error behavior. Human review remains mandatory. The product is suitable for controlled user testing only if automated results remain visibly draft-only and cannot be promoted without the existing source-by-source review gates.

No extraction tuning was implemented after this evaluation. Future work is ranked in `OUT_OF_SAMPLE_FAILURES.md`; the immutable machine-readable ledgers are under `research/extraction-evaluation/`.
