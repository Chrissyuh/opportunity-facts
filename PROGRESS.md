# Verified progress

## Completed

- [x] Built a strict Next.js 16 App Router application with TypeScript, React, Tailwind CSS, Zod, Vitest, and Playwright from the empty repository.
- [x] Implemented the authoritative Schema V2 lineage, now `2.2.0`: a stable 59-field projection/registry surface with exactly 13 core assessment areas plus evidence-bearing cycle, organization, variant, stage/pathway, cost, and outcome records. Schema 2.1 educator-recipient safeguards remain intact; 2.2 distinguishes automated drafts, AI-audited records, human review, and organizer confirmation while retaining deterministic `2.0.0`/`2.1.0` import compatibility.
- [x] Added atomic structured claims, explicit record-assessment states, variant/stage/pathway scopes, provenance, normalization, conflicts, calculation metadata, exact evidence alignment, projection-drift rejection, review/version invariants, and portable JSON import/export.
- [x] Added seven visibly fictional `.example` demo cards with varied opportunity types, relationships, costs, outcomes, conflicts, and missing information.
- [x] Added the first three real source-audited ground-truth cards: NASA TechRise 2026–2027, Lumiere Fall 2026, and Diamond Challenge 2027, with source-by-source records and structured V2 resolution of all nine reality-stress-test P1 comparison losses. Their current provenance is AI-audited; the closed historical reports retain their original terminology.
- [x] Completed the homepage/sample, searchable/filterable library, full facts cards, two/three-card comparison, manual builder, analysis workbench, corrections, print, methodology, data, and research surfaces.
- [x] Implemented bounded public-page acquisition with DNS/IP validation, socket address pinning, redirect checks, byte/time/content limits, static extraction, and one-level same-origin discovery.
- [x] Implemented optional server-only OpenAI Responses extraction with strict structured output, bounded/fair source input, no retries, cancellation, hostile-output sanitization, and deterministic evidence validation.
- [x] Completed the no-key experience: samples, browsing, comparison, manual creation, imports/exports, and all documentation work without a model key.
- [x] Added deterministic public dataset/schema export, fail-closed draft/public boundaries, contribution tooling, threat model, schema guide, review checklist, and a seven-file honest research kit.
- [x] Repaired the full security/data audit: SSRF/service-address policy, URL-token privacy, transient API behavior, artifact publication, calculation integrity, model attribution, local persistence, and client secret isolation.
- [x] Repaired the full UX/accessibility audit: heading semantics, contrast, keyboard focus, live announcements, import state, mobile comparison, builder review scope/versioning, and populated mobile builder containment.
- [x] Generated and visually inspected the four stable release screenshots in `docs/screenshots/`.
- [x] Completed two independent post-repair software/security/UX signoffs with no remaining material P0/P1 implementation issue, then completed the evidence-driven Schema V2 repair documented in `REALITY_STRESS_TEST_RESOLUTION.md`.
- [x] Preserved and pushed Schema V2 as `d842f1a39fd8e26cdc5931b5f82367b64e8a323d` plus the `benchmark-v2-baseline` tag, then completed the first live-provider three-card development benchmark without modifying ground truth.
- [x] Hardened the production Responses extraction contract, link ranking, semantic validation, structured-family salvage, cycle/scope uncertainty, and prize-matrix handling. Final development-set drafts had 52/54 supported-claim precision, 70/72 semantic evidence correctness, and zero known critical misleading claims; full denominators are in `EXTRACTION_BENCHMARK_POST_FIX.md`.
- [x] Froze `evaluation-v2-frozen`, preregistered seven structurally diverse opportunities before inference, completed and committed all seven independent source-audited V2 cards, and preserved exactly one production-path extraction result per card without tuning or replacement runs. Their current provenance is AI-audited, and the frozen evaluation remains unchanged.
- [x] Published the honest out-of-sample evaluation: 82/154 ground-truth claim precision, 188/203 semantic evidence correctness, 16/82 structured recall, four critical misleading claims, and a 462-item correction ledger. The public library now contains ten real AI-audited cards plus seven fictional demos; the frozen report itself remains unchanged.
- [x] Completed and committed the first post-evaluation hardening checkpoint (`3cd7ea1`) without changing the frozen evaluation: subject/scope validation, first-class cycle resolution, sibling-program isolation, bounded three-family Responses extraction, safe partial completion, static reveal-shell/Schema.org acquisition, clearer draft UX, and a private one-run Lumos judge-path development check with zero critical misleading claims after deterministic validation.
- [x] Implemented the current post-checkpoint hardening: two-wave four-family extraction, stronger typed/entity/cost/outcome guards, explicit cycle ambiguity handling, all-citation sibling isolation, bounded hostile-HTML traversal, route admission/deadline/kill-switch controls, default-port-only acquisition, truthful analyzer status/failure UX, reviewed/demo library separation, and mobile comparison/filter improvements.
- [x] Independently re-reviewed and revised the Breakthrough Junior Challenge educator/school outcome scopes and Polygence rolling-cycle identity without modifying historical benchmark or evaluation results.
- [x] Repositioned the product around URL analysis: an analyzer-first homepage, truthful streamed research activity, practical Overview, dedicated Full Record workspace, grounded Needs Attention, deterministic result-quality gating, durable quality-failure caching, bounded five-URL batch analysis, decision-focused comparison, and reviewed examples as secondary proof.
- [x] Corrected review-state integrity in Schema `2.2.0`: the ten independently researched records are now `ai_audited`; only a documented person-led review may use `human_reviewed`. Portable attestations still demote safely on import.
- [x] Added deterministic student/parent Summary PDFs and evidence-complete Full Record PDFs with selectable bundled fonts, exact source links, structured scope/context, projections, calculations, and no external PDF service.

## Last committed release verification

The checked results below preserve the completed gate for `3cd7ea1`; the newer final gate is recorded immediately afterward.

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 27 files / 234 tests passed
- [x] `npm run export:data` — 17 cards (7 demo, 10 then-labeled human reviewed) and JSON Schema exported
- [x] `npm run validate:data` — 17 public cards (7 demo), 0 drafts, both artifacts current
- [x] `npm run test:e2e` — 82 passed, 4 intentional project-inapplicable skips, 0 failed
- [x] `npm run build` — fail-closed data validation plus 30 generated pages
- [x] Homepage, all three real cards with expanded structured details, three-way comparison, populated V2 builder, and methodology inspected at 1440×900 and 390×844 — exact viewport width, one `h1`, and no console warnings/errors
- [x] `npm audit --audit-level=high` — 0 vulnerabilities
- [x] Final V2 production Chromium audit — 14 required surface/viewport combinations at 1440×900 and 390×844, with the full 84-test Playwright matrix covering the wider route and interaction set
- [x] Fresh/resized populated builder — exact 390px document width, no serious/critical axe result, no console/page/request/HTTP error
- [x] Production headers, analysis `no-store`, keyless API state, client secret scan, artifact/API parity, and seven research hash pairs
- [x] Out-of-sample library, Yale/Congressional App Challenge/QuestBridge detail cards, three-way new-card comparison, methodology disclosure, and analyzer pre-run/loading/success/partial-source/provider-failure/evidence states inspected at 1440×900 and 390×844 with no page overflow; non-failure states had no browser diagnostics.

## Current post-evaluation hardening verification

- [x] `npm run export:data` and `npm run validate:data` — 17 public cards (7 demo), 0 drafts, dataset and JSON Schema current
- [x] `npm run lint` and `npm run typecheck`
- [x] `npm test` — 32 files / 375 tests passed
- [x] `npm run test:e2e` — 84 passed, 4 intentional project-inapplicable skips, 0 failed
- [x] `npm run build` — fail-closed data validation plus 30 generated pages
- [x] `npm audit --audit-level=high` — 0 vulnerabilities
- [x] `git diff --check` — no whitespace errors
- [x] Production browser audit at 1440×900 and 390×844 — homepage, analyzer, reviewed/demo library, Diamond structured details, three-card comparison, and methodology remained within the viewport with no console warnings/errors
- [x] Independent final security/reliability audit — no remaining P0/P1 commit blocker; secrets and immutable evaluation artifacts remained outside the diff

## Current student-product redesign verification

- [x] `npm run export:data` / `npm run validate:data` — 17 public cards (10 AI-audited, 7 demo), 0 drafts, dataset and Schema `2.2.0` artifact current
- [x] `npm run lint` / `npm run typecheck`
- [x] `npm test` — 39 files / 400 tests passed
- [x] `npm run test:e2e` — 104 passed, 4 intentional project-inapplicable skips, 0 failed across desktop and mobile
- [x] `npm run build` — fail-closed data validation plus 48 generated pages, including 17 Overview and 17 Full Record routes
- [x] Browser PDF generation — Summary and Full Record downloads succeeded with selectable text, exact links, visible page numbering, grounded attention items, and no console errors
- [x] Three controlled live latency runs used `gpt-5.6-terra`, `store: false`, low reasoning, and no retry. Total times were 117.942s, 122.464s, and 195.622s; one bounded process-family timeout was safely salvaged. Full timing and cost accounting is in `docs/ANALYSIS_LATENCY.md`.

## Schema V2 regression coverage

- [x] V1 migration is deterministic, draft-only, digest-recorded, and does not infer cycle or structured semantics.
- [x] Canonical data tests require all seven demos and ten AI-audited cards to use schema `2.2.0`; attested cards cannot leave structured sections unassessed. Legacy `2.0.0`/`2.1.0` cards migrate losslessly while unsupported future versions and newer vocabulary under older labels fail closed.
- [x] Focused unit coverage preserves cycle identity, affiliations, tiered costs, branching pathways, restricted project funding, prize matrices, projection consistency, and reference integrity.
- [x] Focused browser coverage renders the TechRise, Lumiere, and Diamond distinctions on card and comparison surfaces without horizontal overflow.

## Intentionally outstanding

- [ ] Treat age-band representation as the documented non-gating P2 unless a broader reviewed sample demonstrates that a dedicated structured age model is warranted.
- [x] Run one configured production-path provider smoke test with `gpt-5.6-terra`, strict structured output, `store: false`, and deterministic post-validation.
- [x] Run the separate preregistered seven-card out-of-sample phase without tuning on its primary results; do not describe seven programs as population-level accuracy.
- [x] Repair the generalizable subject/scope, wrong-cycle count, invalid-structured-response, cycle omission, and structured-recall failures on a separate development fixture set before any unattended extraction claim.
- [x] Complete and record the current post-checkpoint full deterministic, build, browser, and explicitly budgeted live-development checks without changing historical benchmark/evaluation results.
- [ ] Deploy only when a target is requested. Keep model-backed public analysis disabled until distributed rate/concurrency controls and a hard provider-or-gateway spend circuit breaker are proven, then verify egress, logs, secrets, headers, and both configured/keyless paths using `docs/DEPLOYMENT_CHECKLIST.md`.
- [ ] Conduct consented comprehension and extraction studies before publishing any result; public copy correctly remains “Study not yet published.”
- [ ] Consider the non-gating P2 hardening backlog in `QUALITY.md` after real-data and deployment work establishes priority.
