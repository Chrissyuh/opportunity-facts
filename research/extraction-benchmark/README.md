# Extraction benchmark artifacts

This directory contains durable, machine-readable development-set evidence for the Opportunity Facts live-provider extraction benchmark.

- `baseline/` preserves the exact tagged V2 baseline and any untuned runs.
- `post-fix/` preserves runs made after documented general repairs.
- `fixtures/` contains public, non-secret regression inputs derived from observed failure classes.
- `reports/` contains generated or manually reviewed scoring records.

The exact tagged baseline is summarized in `EXTRACTION_BENCHMARK_BASELINE.md`.
Final development-set results are summarized in `EXTRACTION_BENCHMARK_POST_FIX.md`
and compared in `EXTRACTION_BENCHMARK.md`. Historical post-fix runs remain in
place when they informed a subsequent general repair; the selected final run is
named by each machine-readable score ledger.

Artifacts must never contain API keys, authorization headers, private URLs, or ground-truth hints supplied to the model. The three human-reviewed public cards remain immutable benchmark references.
