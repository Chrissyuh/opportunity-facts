# Extraction Benchmark Baseline

## Baseline identity

- Git commit: `d842f1a39fd8e26cdc5931b5f82367b64e8a323d`
- Git tag: `benchmark-v2-baseline`
- Schema: `2.0.0`
- Provider: OpenAI Responses API
- Configured model: `gpt-5.6-terra` (application default; `OPENAI_MODEL` was unset)
- Privacy request setting in production code: `store: false`
- Smoke attempt: 2026-08-12 UTC

## Result

The exact tagged V2 extractor was not runnable. Its required production-path smoke request returned a sanitized HTTP 502 before a provider inference was sent. Local reproduction identified the deterministic cause: the OpenAI SDK could not convert the authoritative V2 Zod schema into strict Structured Outputs because the generated JSON Schema contains the unsupported keyword `not` inside a conflicting atomic claim.

This is an extraction-contract failure, not a model-quality result. Provider authentication and access to the exact configured model were confirmed separately through the non-inference model metadata endpoint. No alternate model, mock, special prompt, or benchmark-only inference path was used.

## Per-card baseline status

| Development card | URL-path run | Reason |
| --- | --- | --- |
| NASA TechRise Student Challenge — 2026–2027 | Not run | Mandatory production smoke gate failed before inference. |
| Lumiere Research Scholar Program — Fall 2026 | Not run | Mandatory production smoke gate failed before inference. |
| Diamond Challenge — 2027 | Not run | Mandatory production smoke gate failed before inference. |

## Metrics

All model-quality and acquisition metrics are undefined because there were zero opportunity runs and zero generated claims. Reporting zero percent would be misleading because there is no meaningful denominator.

- Supported-claim precision: not computable (`0` automated supported claims)
- Supported-claim recall: not computable (no opportunity run)
- Status agreement: not computable (no opportunity run)
- Semantic evidence correctness: not computable (`0` evidence attachments)
- Structured-entity precision/recall: not computable (`0` extracted entities)
- Critical misleading errors: `0` generated claims; the blocking contract failure is severity P0 for extraction availability
- Correction burden: not computable; no draft was produced
- Token usage: `0` inference tokens
- Estimated inference cost: `$0.00`

## Historical interpretation

This report is the immutable result for the exact tagged V2 baseline. A compatibility repair may enable a subsequent untuned development baseline, but results from repaired code must never be attributed to this tag.

Machine-readable evidence is in `research/extraction-benchmark/baseline/tagged-v2-smoke-gate.json`.

## Compatibility-unblocked untuned live attempt

Before observing any program output, the strict-output contract received three general compatibility repairs: an assertion schema stopped emitting unsupported `not`; repeated schemas were represented with shared definitions so the same contract fit provider size/depth limits; and the unsupported model-facing `uri` format was removed while authoritative URL validation remained after generation. The prompt, source discovery, source budget, normalization, evidence rules, projection logic, model, reasoning default, timeout, and three ground-truth cards were unchanged.

This compatibility-unblocked state was then run once per development card. All three acquired public text and reached the exact configured model, but all three hit the unchanged 45-second production timeout before a structured response returned.

| Development card | Relevant reviewed-source categories acquired | Relevant categories missed | Irrelevant pages included | Model result | Total runtime |
| --- | ---: | ---: | ---: | --- | ---: |
| NASA TechRise | 4 of 6 | 2 | 0 | Timed out; no draft | 47.254 s |
| Lumiere Fall 2026 | 2 of 8 | 6 | 3 | Timed out; no draft | 48.185 s |
| Diamond Challenge 2027 | 1 of 5 | 4 | 0 | Timed out; no draft | 45.770 s |
| **Aggregate** | **7 of 19** | **12** | **3** | **0 of 3 drafts** | **141.209 s** |

### Acquired pages

**TechRise** acquired the submitted Future Engineers challenge page plus same-origin HTML privacy, official-rules, and terms pages. It missed the reviewed NASA program page and the flyer. The acquired legal URLs differed from the exact reviewed PDF URLs but covered the same relevant source categories.

**Lumiere** acquired the submitted programs page and student application page. It also included three irrelevant pages about admissions results, admissions-officer sessions, and counseling. It missed the reviewed current application, FAQ, about, academic-principles, press-release, and older cost-context pages.

**Diamond** acquired only the submitted competition page. The same-origin one-level discovery path did not reach the reviewed Horn/University of Delaware deadlines, institution relationship, summit, or privacy sources on other official origins.

### Live-attempt metrics

- Reviewed-source category acquisition recall: `7 / 19` (`36.8%`)
- Irrelevant-page inclusion: `3 / 10` acquired pages (`30.0%`)
- URL-path draft completion: `0 / 3`
- Supported-claim precision/recall: not computable (`0` returned claims)
- Status agreement: not computable (`0` returned facts)
- Semantic evidence correctness: not computable (`0` returned evidence attachments)
- Structured-entity precision/recall: not computable (`0` returned entities)
- Critical misleading claims: `0`; no claims were returned
- Correction burden: not computable; no draft was returned

The successful provider smoke used 44,116 input tokens and 4,824 output tokens. At the documented `gpt-5.6-terra` prices current on the benchmark date ($2.00 per million input and $12.00 per million output), its estimated cost was `$0.1461`. Timed-out run usage was not returned by the provider, so their token use and charge cannot be stated honestly. Invalid-schema attempts did not start inference.

The immutable run records are:

- `research/extraction-benchmark/baseline/nasa-techrise-2026-2027-run-01.json`
- `research/extraction-benchmark/baseline/lumiere-fall-2026-run-01.json`
- `research/extraction-benchmark/baseline/diamond-challenge-2027-run-01.json`
