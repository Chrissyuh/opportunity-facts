# Verified progress

## Completed

- [x] Built a strict Next.js 16 App Router application with TypeScript, React, Tailwind CSS, Zod, Vitest, and Playwright from the empty repository.
- [x] Implemented authoritative schema `2.0.0`: a stable 59-field projection/registry surface with exactly 13 core assessment areas plus evidence-bearing cycle, organization, variant, stage/pathway, cost, and outcome records.
- [x] Added atomic structured claims, explicit record-assessment states, variant/stage/pathway scopes, provenance, normalization, conflicts, calculation metadata, exact evidence alignment, projection-drift rejection, review/version invariants, and portable JSON import/export.
- [x] Added seven visibly fictional `.example` demo cards with varied opportunity types, relationships, costs, outcomes, conflicts, and missing information.
- [x] Added and migrated the first three real human-reviewed ground-truth cards: NASA TechRise 2026–2027, Lumiere Fall 2026, and Diamond Challenge 2027, with source-by-source review records and structured V2 resolution of all nine reality-stress-test P1 comparison losses.
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

## Final verification

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 23 files / 196 tests passed
- [x] `npm run export:data` — 10 cards (7 demo, 3 human reviewed) and JSON Schema exported
- [x] `npm run validate:data` — 10 public cards (7 demo), 0 drafts, both artifacts current
- [x] `npm run test:e2e` — 80 passed, 4 intentional project-inapplicable skips, 0 failed
- [x] `npm run build` — fail-closed data validation plus 23 generated pages
- [x] Homepage, all three real cards with expanded structured details, three-way comparison, populated V2 builder, and methodology inspected at 1440×900 and 390×844 — exact viewport width, one `h1`, and no console warnings/errors
- [x] `npm audit --audit-level=high` — 0 vulnerabilities
- [x] Final V2 production Chromium audit — 14 required surface/viewport combinations at 1440×900 and 390×844, with the full 84-test Playwright matrix covering the wider route and interaction set
- [x] Fresh/resized populated builder — exact 390px document width, no serious/critical axe result, no console/page/request/HTTP error
- [x] Production headers, analysis `no-store`, keyless API state, client secret scan, artifact/API parity, and seven research hash pairs

## Schema V2 regression coverage

- [x] V1 migration is deterministic, draft-only, digest-recorded, and does not infer cycle or structured semantics.
- [x] Canonical data tests require all seven demos and three reviewed cards to use schema `2.0.0`; reviewed cards cannot leave structured sections unassessed.
- [x] Focused unit coverage preserves cycle identity, affiliations, tiered costs, branching pathways, restricted project funding, prize matrices, projection consistency, and reference integrity.
- [x] Focused browser coverage renders the TechRise, Lumiere, and Diamond distinctions on card and comparison surfaces without horizontal overflow.

## Intentionally outstanding

- [ ] Treat age-band representation as the documented non-gating P2 unless a broader reviewed sample demonstrates that a dedicated structured age model is warranted.
- [x] Run one configured production-path provider smoke test with `gpt-5.6-terra`, strict structured output, `store: false`, and deterministic post-validation.
- [ ] Run the next seven-card evaluation as a separate out-of-sample phase; do not describe the current three-card tuned results as generalization.
- [ ] Deploy only when a target is requested, then verify platform egress, rate/concurrency/spend controls, logs, secrets, headers, and both configured/keyless paths in that environment.
- [ ] Conduct consented comprehension and extraction studies before publishing any result; public copy correctly remains “Study not yet published.”
- [ ] Consider the non-gating P2 hardening backlog in `QUALITY.md` after real-data and deployment work establishes priority.
