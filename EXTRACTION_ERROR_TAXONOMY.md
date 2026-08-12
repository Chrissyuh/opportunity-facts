# Extraction Error Taxonomy

This taxonomy records errors observed across the preserved baseline and post-fix development artifacts. Repairs are general and do not encode program names or expected outputs.

| ID | Layer | Failure | Frequency | Severity | Affected cards | Safest general repair |
| --- | --- | --- | ---: | --- | --- | --- |
| CONTRACT-01 | Model extraction | Authoritative Zod schema emitted unsupported JSON Schema `not`. | Smoke gate | P0 availability | All | Preserve the zero-length assertion invariant with a concrete candidate item schema; regression-test strict serialization. |
| CONTRACT-02 | Model extraction | Inline schema exceeded provider limits: 22,531 properties, 27 levels, and 501,243 schema-name characters. | Smoke gate | P0 availability | All | Reuse shared schema definitions; enforce provider property/depth/string budgets in tests. |
| CONTRACT-03 | Model extraction | Model-facing schema used unsupported string format `uri`. | Smoke gate | P0 availability | All | Remove unsupported formats only from the provider schema and retain authoritative post-generation URL parsing. |
| MODEL-01 | Model extraction | Production request timed out at 45 seconds before structured output. | 3 of 3 | P0 availability | All | Use an explicitly bounded but realistic timeout and lower reasoning effort for deterministic extraction; retain zero retries and abort support. |
| ACQ-01 | Source acquisition | Relevant official pages on a different origin were not discoverable from same-origin one-level crawling. | 3 cards; 8 reviewed categories | P1 recall | All | Preserve SSRF controls while permitting a bounded allowlist of explicitly linked public official origins only when relationship/ranking signals are strong; otherwise surface omissions. |
| ACQ-02 | Source acquisition | Relevant same-origin pages were missed by link ranking. | 1 card; at least 2 categories | P1 recall | Lumiere | Improve topic vocabulary and penalize generic admissions-marketing pages; add ranking fixtures. |
| ACQ-03 | Source acquisition | Irrelevant pages consumed source slots. | 3 pages | P1 recall/cost | Lumiere | Penalize generic admissions-results, counseling, and session marketing when opportunity-specific FAQ, cost, application, terms, or aid links exist. |
| ACQ-04 | Source acquisition | PDF/static reviewed sources were not represented by the HTML-only acquisition path. | At least 2 categories | P1 recall | TechRise | Add bounded PDF text acquisition with content-type, byte, page, and text limits; do not execute embedded content. |
| MODEL-02 | Model extraction | Internally inconsistent status/value combinations caused an otherwise usable response to fail authoritative parsing. | 1 completed diagnostic run | P0 availability | TechRise | Parse a structural candidate envelope, then validate and downgrade each fact independently before final card validation. |
| MODEL-03 | Model extraction | Generic pages mixed cycles, variants, and organization-wide audiences; the model selected values without establishing the target scope. | 6 displayed claims | P1 misleading | Lumiere | Strengthen scope instructions and deterministically withhold cycle/variant-sensitive flat facts when no structured target cycle/variant survives validation. |
| MODEL-04 | Model extraction | Volunteer mentor/judge wording was classified as a participant mentorship benefit. | 1 claim | P1 misleading | Diamond | Reject volunteer-role evidence unless the same excerpt states that participants receive mentoring/support. |
| MODEL-05 | Model extraction | An organizer office/program location was classified as the participant opportunity location. | 1 claim | P1 misleading | TechRise | Reject organizer-office/location evidence unless participant attendance or participation is explicit. |
| POST-01 | Deterministic post-processing | One invalid structured family caused every otherwise valid family to be discarded. | 2 diagnostic drafts | P1 recall | TechRise, Lumiere | Validate/salvage families in dependency order; retain independent valid families and warn per rejected family. |
| POST-02 | Deterministic post-processing | Exact-string evidence existed but did not support the displayed object/scope or every displayed detail. | 5 claims | P1 misleading | All | Add conservative semantic guards for organization roles, cancellation direction, privacy categories, volunteer roles, cycle/variant scope, and recipient scope. |
| POST-03 | Deterministic post-processing | A single modeled award row projected one cash amount even though the excerpt described a multi-placement/multi-track matrix. | 1 claim | P1 misleading | Diamond | Withhold incomplete cash outcome matrices and their flat cash projection; require several scoped rows or human review. |
| PROJ-01 | Projection | A non-operator administrator role occupied the flat operating-organization projection without exposing the missing manager role. | 1 claim | P1 flattening | TechRise | Preserve the explicit role label in the compact projection and retain rich organization records; never relabel administrator as operator. |
| PRODUCT-01 | Schema/product | URL analysis has no explicit target-cycle input when a generic program page lists several cycles. | 1 card | P1 recall | Lumiere | Add a future user-confirmed cycle/variant choice; until then withhold cycle-specific claims. This is not a Schema V2 representational failure. |

## Disposition

- CONTRACT-01/02/03, MODEL-01/02, ACQ-02/03, MODEL-03/04/05, POST-01/02/03, and PROJ-01 received code and regression coverage in this phase.
- ACQ-01/04 and PRODUCT-01 remain explicit recall/product limitations. They require broader acquisition or user scope input, not weaker evidence validation.
- No new Schema V2 P0/P1 representational failure was observed. The dominant remaining problem is obtaining and safely scoping enough source material.

## Severity interpretation

- P0 here means the production extraction path cannot return a draft or would force a materially false result.
- P1 means useful reviewed information is systematically omitted, flattened, or displaced.
- P2 means an awkward but still conservative result or operational limitation.

This taxonomy is not a product trust score and does not change the authority of the human-reviewed cards.
