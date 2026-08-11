# Verified progress

## Completed

- [x] Built a strict Next.js 16 App Router application with TypeScript, React, Tailwind CSS, Zod, Vitest, and Playwright from the empty repository.
- [x] Implemented one authoritative 59-field card schema and registry with exactly 13 core disclosure dimensions.
- [x] Added five-state facts, provenance, normalization, conflicts, calculation metadata, exact evidence alignment, review/version invariants, and portable JSON import/export.
- [x] Added seven visibly fictional `.example` demo cards with varied opportunity types, relationships, costs, outcomes, conflicts, and missing information.
- [x] Completed the homepage/sample, searchable/filterable library, full facts cards, two/three-card comparison, manual builder, analysis workbench, corrections, print, methodology, data, and research surfaces.
- [x] Implemented bounded public-page acquisition with DNS/IP validation, socket address pinning, redirect checks, byte/time/content limits, static extraction, and one-level same-origin discovery.
- [x] Implemented optional server-only OpenAI Responses extraction with strict structured output, bounded/fair source input, no retries, cancellation, hostile-output sanitization, and deterministic evidence validation.
- [x] Completed the no-key experience: samples, browsing, comparison, manual creation, imports/exports, and all documentation work without a model key.
- [x] Added deterministic public dataset/schema export, fail-closed draft/public boundaries, contribution tooling, threat model, schema guide, review checklist, and a seven-file honest research kit.
- [x] Repaired the full security/data audit: SSRF/service-address policy, URL-token privacy, transient API behavior, artifact publication, calculation integrity, model attribution, local persistence, and client secret isolation.
- [x] Repaired the full UX/accessibility audit: heading semantics, contrast, keyboard focus, live announcements, import state, mobile comparison, builder review scope/versioning, and populated mobile builder containment.
- [x] Generated and visually inspected the four stable release screenshots in `docs/screenshots/`.
- [x] Completed two independent post-repair clean signoffs with no remaining material P0/P1 issue.

## Final verification

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 16 files / 138 tests passed
- [x] `npm run export:data` — 7 cards and JSON Schema exported
- [x] `npm run validate:data` — 7 public demo cards, 0 drafts, both artifacts current
- [x] `npm run test:e2e` — 60 passed, 2 intentional project-inapplicable skips, 0 failed
- [x] `npm run build` — fail-closed data validation plus 20 generated pages
- [x] `npm audit --audit-level=high` — 0 vulnerabilities
- [x] Production Chromium matrix — 27 clean route/viewport combinations at 1440×900, 390×844, and 720×900
- [x] Fresh/resized populated builder — exact 390px document width, no serious/critical axe result, no console/page/request/HTTP error
- [x] Production headers, analysis `no-store`, keyless API state, client secret scan, artifact/API parity, and seven research hash pairs

## Intentionally outstanding

- [ ] Add real reviewed cards only after completing the source-by-source human review workflow; bundled records remain demo data.
- [ ] Run one configured provider smoke test only when a suitable OpenAI key is deliberately supplied.
- [ ] Deploy only when a target is requested, then verify platform egress, rate/concurrency/spend controls, logs, secrets, headers, and both configured/keyless paths in that environment.
- [ ] Conduct consented comprehension and extraction studies before publishing any result; public copy correctly remains “Study not yet published.”
- [ ] Consider the non-gating P2 hardening backlog in `QUALITY.md` after real-data and deployment work establishes priority.
