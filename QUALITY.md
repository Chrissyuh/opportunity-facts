# Quality audit

Opportunity Facts is release-gated by repository tests, deterministic public artifacts, rendered browser checks, and independent security/data and UX/accessibility audits. A finding remains open until the repair and a focused regression pass; material P0/P1 findings also reset the clean-audit checkpoint.

## Closed material findings

| Area | Result | Regression evidence |
| --- | --- | --- |
| Configuration and bounded input | Fixed `.env.example` tracking, streamed request-size enforcement, pre-configuration input validation, sanitized errors, and `no-store` analysis responses. | Route/security tests cover oversized streams, invalid/canonical-duplicate inputs, keyless operation, and downstream failures. |
| Domain truthfulness | Centralized all 59 fields and 13 core dimensions; enforced review scope, `not_applicable` reasons, source inventory reuse, review/version invalidation, calculated-claim arithmetic, cost completeness, and organizer-stated acceptance-rate attribution. | Schema, normalization, builder, analysis, and data-validation regressions. |
| URL and SSRF boundaries | Added shared literal-host screening plus server DNS validation, address pinning, redirect revalidation, same-origin discovery limits, Azure platform-service blocking, and sensitive query/fragment rejection. | Security tests cover IPv4/IPv6/mapped forms, metadata/local/service addresses, mixed DNS, redirects, byte/time/content bounds, fragments, and pinned transport behavior. |
| Automated extraction | Bounded and fairly distributed model input, 45-second/no-retry SDK configuration, cancellation, hostile-output sanitization, exact excerpt matching, durable coverage limitations, neutral summaries/slugs, and no automatic acceptance-rate inference. | Analysis integration tests include hostile notes, unsupported calculations, empty HTML shells, currency ambiguity, evidence mismatch, and model-attribution repair. |
| Publication and local drafts | Drafts are excluded from public export; public states and artifact parity fail closed at validation/build and runtime load. Local writes roll back on partial failure. Imported drafts cannot create dead public links or duplicate comparison columns. | Temporary-repository artifact tests, runtime dataset tests, browser import/persistence flows, and `build` running `validate:data` first. |
| UX, accessibility, and layout | Repaired heading order, focus indicators, contrast, semantic lists, live results, keyboard disclosures, comparison containment, builder state synchronization, and populated-builder mobile overflow. | Playwright runs both 1440×900 and 390×844 projects, axe checks primary/expanded states, print checks, and a desktop-to-390 resize regression. |

## Independent audit checkpoints

- Checkpoint 2: independent UX/accessibility and security/data reviews found no remaining material source/contract defect after the main repair pass.
- Checkpoint 3: the UX audit found one P1 in the populated mobile builder (`421px` document width at a `390px` viewport). The builder grid/source list now uses zero-minimum tracks and wraps long source URLs; the regression verifies both a fresh mobile import and a 1440-to-390 resize.
- Checkpoint 4: both independent auditors returned **CLEAN — no material P0/P1 remains** against the rebuilt production bundle. Security rechecked acquisition/privacy/publication boundaries and 90 focused assertions. UX reproduced the prior failure at 390×844 and after live resize; both measured `scrollWidth=390`, with no console/network failure.

## Final release gate

| Command or check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | 16 files, 138 tests passed |
| `npm run export:data` | Exported 7 cards and the JSON Schema |
| `npm run validate:data` | 7 public demo cards, 0 drafts, both artifacts valid and current |
| `npm run test:e2e` | 62 total: 60 passed, 2 intentional project-inapplicable skips, 0 failed |
| `npm run build` | Pass; data validation ran first and Next generated 20 pages |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Production route matrix | 27 route/viewport combinations at 1440×900, 390×844, and 720×900; all 200, exactly one `h1`, no page overflow or browser/runtime/network diagnostics |
| Populated mobile builder | Fresh import and 1440-to-390 resize both remained 390px wide; 0 serious/critical axe violations |
| Production security | Strict CSP without `unsafe-eval`, nosniff, referrer, frame, COOP, permissions, HSTS, and analysis `no-store`; no API-key identifier or key-shaped value in client static bundles |
| Research publication | All 7 public research files are SHA-256 identical to their source copies; templates remain empty/not-run and the site says “Study not yet published” |

Verification ran locally on Windows 11 Home with Node.js 25.2.1, npm 11.6.2, Next.js 16.3.0, and Playwright 1.58.2. The final production process used `next start` on `127.0.0.1:4407` solely for local verification.

## Honest remaining boundaries

- The repository contains fictional demo data only. A real public card still requires line-by-line human source review and the review checklist.
- No live OpenAI request was made because no API key was supplied. Model behavior is covered by deterministic mocks and adversarial post-processing tests, not a provider smoke call.
- Nothing was deployed. Aggregate rate limiting, concurrency/spend caps, outbound egress controls, provider/host log retention, and secret governance remain deployment responsibilities.
- No study or benchmark result is claimed. Protocols and empty templates are ready for consented research.
- Non-gating P2 hardening candidates: automate research/public-copy parity inside `validate:data`, separate runtime-only artifact loading behind an explicit server-only boundary, and collapse trailing-dot hostname variants in canonical duplicate detection.
