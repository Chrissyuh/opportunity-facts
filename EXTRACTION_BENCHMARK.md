# Extraction Benchmark

## What this report means

This is a transparent development-set comparison, not a generalization claim or product accuracy score. The three independently human-reviewed cards were used first to expose failures and then to harden the same production extraction path.

## Baseline: untouched Schema V2 extractor

The exact tagged V2 checkpoint (`d842f1a…`, `benchmark-v2-baseline`) could not serialize its authoritative schema into the provider's strict Structured Outputs subset. After compatibility-only repairs made a request possible without changing extraction behavior, all three opportunity runs acquired text but timed out at the original 45-second limit.

- URL-path completion: `0 / 3`
- Reviewed source-category acquisition: `7 / 19` (36.8%)
- Irrelevant included pages: `3 / 10` (30.0%)
- Claim, evidence, status, structured, and correction metrics: undefined because no draft was returned

The immutable details remain in `EXTRACTION_BENCHMARK_BASELINE.md`.

## Diagnostic successful pass

After only the provider-contract, timeout, reasoning-effort, and link-ranking repairs, three drafts completed. Manual semantic review found:

- supported-claim precision: `53 / 66` (80.3%)
- supported summary recall: `45 / 88` (51.1%)
- status agreement: `101 / 177` (57.1%)
- semantic evidence correctness: `68 / 82` (82.9%)
- structured precision/recall: `5 / 7` (71.4%) / `5 / 69` (7.2%)
- correction burden: `157`
- critical misleading error categories: `12`

Those errors included administrator→operator flattening, organizer-office→participant location, organizer cancellation rights→participant policy, unsupported privacy expansion, wrong-cycle Lumiere eligibility/dates/duration, a Diamond prize matrix reduced to one amount, volunteer-role→participant mentorship, and an unsupported virtual location.

## Post-fix: same three-card development set

| Metric | Diagnostic pass | Final post-fix |
| --- | ---: | ---: |
| Supported-claim precision | 53 / 66 (80.3%) | **52 / 54 (96.3%)** |
| Supported summary recall | 45 / 88 (51.1%) | **50 / 88 (56.8%)** |
| Status agreement | 101 / 177 (57.1%) | **96 / 177 (54.2%)** |
| Semantic evidence correctness | 68 / 82 (82.9%) | **70 / 72 (97.2%)** |
| Structured precision | 5 / 7 (71.4%) | **12 / 12 (100%)** |
| Structured recall | 5 / 69 (7.2%) | **12 / 69 (17.4%)** |
| Correction burden | 157 | **152** |
| Critical misleading errors | 12 | **0** |
| Reviewed source-category acquisition | 7 / 19 (36.8%) | **9 / 19 (47.4%)** |

The slight status-agreement decline is intentional: unresolved cycle, scope, and incomplete-source cases now become `unclear` instead of confident but wrong values. The system traded optimistic coverage for semantic precision.

## Conclusion

The production path is now suitable for a separate seven-card out-of-sample evaluation as a conservative draft generator, with an important condition: structured recall and cross-origin/PDF acquisition must be treated as known limitations, and human review remains mandatory. The post-fix figures are development-set results and must not be reused as generalization accuracy.

See `EXTRACTION_BENCHMARK_POST_FIX.md` for per-card denominators, costs, acquisition failures, and correction ledgers; see `EXTRACTION_ERROR_TAXONOMY.md` for causes and repairs.
