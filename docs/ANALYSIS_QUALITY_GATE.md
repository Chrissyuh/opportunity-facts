# Analysis quality gate

The analysis quality gate is deterministic product logic. It is not a model confidence score, trust score, legitimacy judgment, or ranking. It runs only after the existing source, evidence, subject/scope, cycle, relationship, typed-value, and projection validation has finished.

The gate returns one of three outcomes:

- `good`: the result has adequate student-decision coverage and no material high-priority caveat remains.
- `usable_with_caveats`: the record is useful but has grounded gaps, warnings, or a safely isolated partial section.
- `insufficient_quality`: the system cannot responsibly present a normal Opportunity Facts overview.

Normal Analyze uses the compact gate in `assessFastAnalysisQuality`. It requires resolved opportunity identity, adequate source acquisition, at least five supported facts across at least three practical decision areas, surviving deterministic evidence, and no catastrophic normal extraction failure. It does **not** require all 59 storage fields, rich variants, a pathway ledger, complete terms analysis, or any other work reserved for Extended Research.

Extended/repository records retain the richer gate. `insufficient_quality` is selected only by explicit structural rules in `lib/analysis/quality-gate.ts`, including unresolved opportunity identity, most requested sections failing, too few retained facts and decision areas, extreme deterministic candidate rejection with sparse retained output, materially ambiguous cycle context in an otherwise sparse record, or severely limited source coverage combined with poor core disclosure.

One missing fact, one optional section failure, an absent selectivity statistic, or a genuinely rolling cycle does not independently suppress a card. Numerical-selectivity attention is emitted only when retained selection evidence indicates review, interview, finalists, ranking, advancement, limited seats, or another materially selective process. Open enrollment is not criticized for lacking an acceptance rate. High-priority Needs Attention items produce a caveated result unless a separate hard structural rule also fails.

An insufficient card is retained in the server response and same-browser entry. The default UI explains the top structural reasons and recovery actions. `View incomplete result anyway` requires an explicit confirmation, makes no model request, and leaves a persistent amber override warning on the revealed draft.

Durable caching is narrower than quality classification. A quality failure is cache eligible only after provider work completed and no temporary acquisition failure contributed. Provider timeouts, rate limits, provider errors, cancellations, network/DNS timeouts, and internal exceptions are never durable-cache entries. Cache keys include the analyzer version and a canonical public URL and expire after 14 days. Before a durable hit is returned, the server performs one bounded fetch of the submitted page and compares its extracted-text fingerprint. Changed content invalidates the entry and runs an ordinary analysis; a temporary freshness-check failure retains the valid cached result and does not start model work. Same-browser suppression is a separate ten-minute reuse/cooldown for the exact unchanged input, including non-durable quality failures.

Hosts configured through `ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS` skip durable failure-cache reads and writes. The server also returns an authoritative suppression decision so the browser clears and bypasses local reuse/cooldown for those hosts. That configuration is not passed to source acquisition, extraction prompts, evidence validation, quality thresholds, projections, or result interpretation.
