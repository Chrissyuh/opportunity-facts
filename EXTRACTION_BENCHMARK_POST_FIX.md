# Extraction Benchmark Post-Fix Development Run

## Identity and method

- Development set: NASA TechRise 2026–2027, Lumiere Fall 2026, Diamond Challenge 2027
- Baseline checkpoint: `d842f1a39fd8e26cdc5931b5f82367b64e8a323d` / `benchmark-v2-baseline`
- Schema: `2.0.0`
- Provider path: production OpenAI Responses API extraction, `store: false`, zero retries
- Exact model: `gpt-5.6-terra`; `OPENAI_MODEL` was unset, so the documented application default was used
- Settings: low reasoning effort, 24,000 maximum output tokens, 120-second request timeout
- Final runs: 2026-08-12 UTC

Each run began with the public URL a normal user would submit. The model received only automatically acquired source text, never the human-reviewed card or benchmark hints. Deterministic evidence validation then canonicalized sources, rejected nonmatching excerpts and typed claims, and projected the surviving V2 draft. A human semantic review checked every displayed disclosed/conflicting claim against its exact excerpt and object/scope. The three reviewed cards were not changed.

## Source acquisition

| Card | Reviewed categories acquired | Exact reviewed URLs acquired | Missed categories | Acquired pages | Fetch failures |
| --- | ---: | ---: | ---: | ---: | ---: |
| TechRise | 4 / 6 | 1 / 6 | NASA page; flyer | 5 | 0 |
| Lumiere | 4 / 8 | 4 / 8 | Airtable application; academic principles; press release; older context page | 4 | 1 irrelevant oversized essay-award page |
| Diamond | 1 / 5 | 1 / 5 | Horn deadlines; UD relationship; summit; privacy | 1 | 0 |
| **Aggregate** | **9 / 19 (47.4%)** | **6 / 19 (31.6%)** | **10** | **10** | **1** |

TechRise's acquired HTML rules/privacy/terms pages covered the same source categories as three reviewed PDF URLs, so category recall is higher than exact-URL overlap. Cross-origin official pages remain outside the deliberately same-origin, one-level product crawler. The Lumiere oversized page was retained as a visible partial-source failure and caused absence claims/structures to be treated conservatively.

## Final metrics

| Card | Supported-claim precision | Supported summary recall | Status agreement | Semantic evidence correctness | Structured P / R | Corrections | Critical errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TechRise | 18 / 18 (100%) | 16 / 23 (69.6%) | 41 / 59 (69.5%) | 26 / 26 (100%) | 5 / 5 (100%) · 5 / 13 (38.5%) | 30 | 0 |
| Lumiere | 12 / 13 (92.3%) | 12 / 30 (40.0%) | 17 / 59 (28.8%) | 14 / 15 (93.3%) | N/A (0 emitted) · 0 / 33 (0%) | 78 | 0 |
| Diamond | 22 / 23 (95.7%) | 22 / 35 (62.9%) | 38 / 59 (64.4%) | 30 / 31 (96.8%) | 7 / 7 (100%) · 7 / 23 (30.4%) | 44 | 0 |
| **Aggregate** | **52 / 54 (96.3%)** | **50 / 88 (56.8%)** | **96 / 177 (54.2%)** | **70 / 72 (97.2%)** | **12 / 12 (100%) · 12 / 69 (17.4%)** | **152** | **0** |

Precision counts displayed disclosed facts and conflict candidates. Summary recall counts human-reviewed disclosed/conflicting summary dimensions that were recovered without a material value/scope error. Structured matching counts reviewed organizations, roles, relationships, variants, stages, pathways, costs, and outcomes where identity was well-defined. An undefined precision denominator is reported as N/A, never as 100%.

Status agreement is intentionally lower than precision: when source coverage was partial or the target cycle/variant was not established, the repaired pipeline returned `unclear` rather than a more optimistic `not_found` or a confidently wrong disclosure.

## Semantic review findings

- TechRise: all 18 displayed supported facts and 26 evidence attachments were semantically supported. The structured draft recovered NASA and Future Engineers as organizations, Future Engineers' administrator role, and two stages. It safely omitted the `$1,500` outcome structure after candidate validation could not produce a fully valid outcome family; it never labeled that funding personal cash.
- Lumiere: the URL path did not establish the Fall 2026 cycle and had one source failure. Dates, eligibility, duration, prices, and structured families were therefore withheld/unclear. The one remaining noncritical semantic miss was flat journal-submission support shown without its tier scope.
- Diamond: one organization-type statement attached the initiative's description to Horn Entrepreneurship, a noncritical object error. The final draft withheld the incomplete single-row cash projection, wrong universal date/location, and volunteer-as-participant-mentorship errors. Seven emitted structured entities were correct, but the prize matrix and pathways were omitted.

## Correction burden

The correction ledger counts concrete review actions, not one score. Across the final three drafts:

| Correction type | Count |
| --- | ---: |
| Add missing claim | 38 |
| Remove unsupported claim | 2 |
| Change status | 44 |
| Change value | 2 |
| Change relationship/scope | 7 |
| Change evidence | 2 |
| Restructure object | 57 |
| **Total** | **152** |

## Validator catches and repairs

The final runs produced 34 deterministic warnings: exact-excerpt mismatches, typed enum/date/value mismatches, invalid relationship semantics, invalid role semantics, and invalid family references. These are withheld candidates, not displayed claims. General repairs added provider-compatible strict schemas, realistic bounded latency, better same-origin link ranking, claim-by-claim recovery from internally inconsistent model facts, family-level structured salvage, and conservative guards for organizer offices, non-operator roles, cancellation rights, overbroad privacy text, volunteer roles, unspecified cycles/variants, and incomplete prize matrices.

## Runtime, usage, and estimated cost

| Card | Runtime | Input tokens | Cached input | Output tokens | Reasoning tokens | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TechRise | 79.269 s | 56,022 | 0 | 11,404 | 367 | $0.2489 |
| Lumiere | 78.975 s | 46,445 | 44,150 | 11,206 | 285 | $0.1479 |
| Diamond | 111.620 s | 47,570 | 44,150 | 17,599 | 294 | $0.2269 |
| **Selected final runs** | **269.864 s** | **150,037** | **88,300** | **40,209** | **946** | **$0.6236** |

The estimate uses the official price visible on the benchmark date: $2.00/M uncached input, $0.20/M cached input, and $12.00/M output. The minimum estimated cost of every successful smoke/diagnostic/final inference retained during development is about $1.52. Timed-out or failed requests did not return usage, so the exact provider bill may be higher and cannot be derived from repository artifacts.

## Limitations and stopping decision

- Structured recall is only 17.4%; these drafts are useful review starting points, not substitutes for human research.
- Cross-origin official sources and PDFs remain a major acquisition gap.
- The analyzer has no user-supplied target-cycle selector. When a generic page mixes cycles, conservative withholding is safer than selecting one.
- Partial-source handling can reduce status agreement substantially, as Lumiere demonstrates.
- The compact result is not an independent evaluation: these three cards are the development set used to design repairs.

Tuning stopped because deterministic validation leaves zero known critical misleading claims in the selected final drafts, remaining improvements are primarily acquisition/recall work, and further program-specific tuning would risk overfitting.

Machine-readable runs and semantic ledgers are under `research/extraction-benchmark/post-fix/` and `research/extraction-benchmark/reports/`.
