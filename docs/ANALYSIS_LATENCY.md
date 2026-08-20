# Analysis latency report

These are controlled engineering samples, not performance guarantees or a new extraction benchmark. They used `gpt-5.6-terra`, the production Responses API, low reasoning effort, low text verbosity, `store: false`, no automatic retry, and ordinary public-URL acquisition on August 20, 2026. Historical benchmark/evaluation results were not changed.

## Current normal Analyze

Normal Analyze now makes one sparse strict-output request. The provider receives at most 55,000 source characters, may return at most 4,800 tokens, cites compact source IDs plus exact excerpts, and does not emit the full 59-field object or rich V2 ledgers. Deterministic code hydrates provenance, resolves cycle context, validates the claims, assembles the card, and records which practical fields were actually assessed.

| Starting page | Total | Acquisition and discovery | Model | Validation | Supported practical facts | Attention | Quality |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Lumos Fellows | 23.446s | 2.361s | 20.042s | 0.055s | 13 | 3 | Good |
| QuestBridge National College Match | 25.829s | 2.994s | 22.452s | 0.064s | 12 | 3 | Usable with caveats |
| MITES Summer | 31.224s | 3.644s | 27.343s | 0.073s | 13 | 3 | Usable with caveats |

- Total wall time: **23.446s minimum, 25.829s median, 31.224s maximum**.
- Model generation: **20.042s minimum, 22.452s median, 27.343s maximum**.
- Acquisition/discovery: **2.361s minimum, 2.994s median, 3.644s maximum**.
- Text processing ranged from 0.109s to 0.283s; cycle resolution from 0.017s to 0.022s; projection assembly from 0.006s to 0.008s; quality gating remained below 0.001s.
- Provider generation is still the dominant component, but normal pages in this sample met the competition-build target of 45 seconds without weakening validation.

The final private Lumos normal run acquired four public pages, modeled Fall 2026, retained the August 23 final deadline, September 8 start, online format, $4,500 tuition, both aid bands, refund language, selection/interview process, mentorship, and principal benefits, with zero evidence-validation warnings and no observed critical misleading claim. It did not establish the operator, an explicit end date, or detailed institutional relationships. Two subsequent fixture-backed deterministic repairs allow a directly supported duration without requiring a rich cohort ledger and recognize explicit “join from anywhere in the world” eligibility; no additional paid run was made for those two narrow repairs.

### Normal usage and cost

| Case | Input tokens | Cached input | Output tokens | Total tokens | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lumos Fellows | 7,083 | 3,599 | 2,410 | 9,493 | $0.036608 |
| QuestBridge | 14,381 | 3,599 | 2,589 | 16,970 | $0.053352 |
| MITES | 12,702 | 0 | 3,267 | 15,969 | $0.064608 |
| **Total** | **34,166** | **7,198** | **8,266** | **42,432** | **$0.154568** |

The estimate uses the official direct-API rates published for GPT-5.6 Terra at the measurement date: $2.00 per million uncached input tokens, $0.20 per million cached input tokens, and $12.00 per million output tokens. See [the official model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

## Optional Extended Research

Extended Research reuses the exact acquired source contexts and validated normal card. It performs no source refetch. Two optional requests run concurrently: detailed process/relationships/terms and financial/outcome structure. Each is independently salvageable and capped at 8,000 output tokens. Baseline supported facts are protected from replacement.

| Starting page | Incremental wall time | Detail model | Financial model | Input | Cached input | Output | Incremental cost | Added retained material |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Lumos Fellows | 39.357s | 39.103s | 26.922s | 45,363 | 39,119 | 7,022 | $0.104576 | Project ownership, cancellation rights, one scoped tuition record |
| MITES Summer | 56.330s | 56.111s | 25.612s | 54,502 | 39,119 | 7,982 | $0.134374 | Travel requirement, meals, college credit |

Only two extended samples were run, so a median would not be meaningful. The incremental range was **39.357–56.330 seconds**. Detail generation was the critical path because the two requests overlap. Both runs reported `reusedAcquiredSources: true`; acquisition and text processing were not repeated.

Extended Research remained conservative. Both samples completed technically, but deterministic validation withheld many malformed or weakly bound rich candidates. MITES retained no valid rich record collection, while Lumos retained one cost record. That is an honest recall limitation, not a reason to loosen evidence or subject/scope safeguards. A failed or cancelled extension leaves the normal result unchanged.

## Reduction from the previous default path

The previous default used four verbose model families and was measured at 117.942s, 122.464s, and 195.622s, with 18,984, 21,413, and 15,838 output tokens respectively.

| Measure | Previous default | Current normal Analyze | Change |
| --- | ---: | ---: | ---: |
| Median wall time | 122.464s | 25.829s | **78.9% lower** |
| Average output tokens | 18,745 | 2,755 | **85.3% lower** |
| Three-case estimated cost | $0.948759 | $0.154568 | **83.7% lower** |
| Provider requests | Four families | One compact request | Three fewer requests |

Even normal plus Extended Research is smaller than the previous always-on path in these paired samples: approximately 64 seconds and 9,638 output tokens for the measured Lumos continuation, and 88 seconds and 11,249 output tokens for MITES. The richer work is now optional rather than imposed on every student.

## Implementation-call accounting

This development pass made 12 provider requests: 11 completed and one pre-repair MITES normal request returned an incomplete structured response at the 4,800-token bound. That failure exposed hidden legacy schema bloat; it was not treated as a result or retried unchanged. Completed responses reported 193,434 input tokens, 89,035 cached input tokens, and 37,350 output tokens, for a known estimated cost of **$0.674805**. The incomplete response did not expose usage through the harness, so the true phase cost is higher by an unknown provider-billed amount. No secrets or headers were retained.

The dominant remaining latency is model generation, not fetching or deterministic validation. A realistic current target is roughly 20–35 seconds on ordinary pages, with difficult acquisition/provider cases forming the tail. Further speed work should reduce generated semantics or use a faster model only after checking quality; source-fetch micro-optimization will not materially change the median.
