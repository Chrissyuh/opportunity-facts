# Analysis quality gate

The analysis quality gate is deterministic product logic. It is not a model confidence score, trust score, legitimacy judgment, or ranking. It runs only after the existing source, evidence, subject/scope, cycle, relationship, typed-value, and projection validation has finished.

The gate returns one of three outcomes:

- `good`: the result has adequate student-decision coverage, all extraction families completed, and no high-priority attention item remains.
- `usable_with_caveats`: the record is useful but has grounded gaps, warnings, or a partial independent family.
- `insufficient_quality`: the system cannot responsibly present a normal Opportunity Facts overview.

`insufficient_quality` is selected only by explicit structural rules in `lib/analysis/quality-gate.ts`, including unresolved opportunity identity, most model families failing, too few retained facts and decision areas, extreme deterministic candidate rejection with sparse retained output, materially ambiguous cycle context in an otherwise sparse record, or severely limited source coverage combined with poor core disclosure.

One missing fact, one family failure, an absent selectivity statistic, or a genuinely rolling cycle does not independently suppress a card. High-priority Needs Attention items produce a caveated result unless a separate hard structural rule also fails.

Durable caching is narrower than quality classification. A quality failure is cache eligible only after provider work completed and no temporary acquisition failure contributed. Provider timeouts, rate limits, provider errors, cancellations, network/DNS timeouts, and internal exceptions are never durable-cache entries. Cache keys include the analyzer version and a canonical public URL and expire after 14 days. Before a durable hit is returned, the server performs one bounded fetch of the submitted page and compares its extracted-text fingerprint. Changed content invalidates the entry and runs an ordinary analysis; a temporary freshness-check failure retains the valid cached result and does not start model work. Same-browser retry suppression remains immediate and does not perform this network check.

Hosts configured through `ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS` skip only durable failure-cache reads and writes. That configuration is not passed to source acquisition, extraction prompts, evidence validation, quality thresholds, projections, or result rendering.
