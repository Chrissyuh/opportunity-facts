# Quality audit

Opportunity Facts is release-gated by repository tests, deterministic public artifacts, rendered browser checks, and independent security/data and UX/accessibility audits. A finding remains open until the repair and a focused regression pass; material P0/P1 findings also reset the clean-audit checkpoint.

## Closed material findings

| Area | Result | Regression evidence |
| --- | --- | --- |
| Configuration and bounded input | Fixed `.env.example` tracking, streamed request-size enforcement, pre-configuration input validation, sanitized errors, and `no-store` analysis responses. | Route/security tests cover oversized streams, invalid/canonical-duplicate inputs, keyless operation, and downstream failures. |
| Domain truthfulness | Centralized all 59 fields and 13 core dimensions; enforced review scope, `not_applicable` reasons, source inventory reuse, review/version invalidation, calculated-claim arithmetic, cost completeness, and organizer-stated acceptance-rate attribution. | Schema, normalization, builder, analysis, and data-validation regressions. |
| Heterogeneous real-card fidelity | Added schema `2.0.0` atomic claims, explicit assessment states, scoped organizations/variants/stages/pathways/costs/outcomes, deterministic flat-fact projections, and conservative V1 migration. The three reviewed cards no longer flatten the nine reality-test distinctions. | `schema-v2`, canonical-card population, serialization, registry, and structured desktop/mobile browser regressions; full disposition in `REALITY_STRESS_TEST_RESOLUTION.md`. |
| URL and SSRF boundaries | Added shared literal-host screening plus server DNS validation, address pinning, redirect revalidation, same-origin discovery limits, Azure platform-service blocking, and sensitive query/fragment rejection. | Security tests cover IPv4/IPv6/mapped forms, metadata/local/service addresses, mixed DNS, redirects, byte/time/content bounds, fragments, and pinned transport behavior. |
| Automated extraction | Bounded and fairly distributed model input, 45-second/no-retry SDK configuration, cancellation, hostile-output sanitization, exact excerpt matching, durable coverage limitations, neutral summaries/slugs, and no automatic acceptance-rate inference. | Analysis integration tests include hostile notes, unsupported calculations, empty HTML shells, currency ambiguity, evidence mismatch, and model-attribution repair. |
| Publication and local drafts | Drafts are excluded from public export; public states and artifact parity fail closed at validation/build and runtime load. Local writes roll back on partial failure. Imported drafts cannot create dead public links or duplicate comparison columns. | Temporary-repository artifact tests, runtime dataset tests, browser import/persistence flows, and `build` running `validate:data` first. |
| UX, accessibility, and layout | Repaired heading order, focus indicators, contrast, semantic lists, live results, keyboard disclosures, comparison containment, builder state synchronization, and populated-builder mobile overflow. | Playwright runs both 1440×900 and 390×844 projects, axe checks primary/expanded states, print checks, and a desktop-to-390 resize regression. |

## Independent audit checkpoints

- Checkpoint 2: independent UX/accessibility and security/data reviews found no remaining material source/contract defect after the main repair pass.
- Checkpoint 3: the UX audit found one P1 in the populated mobile builder (`421px` document width at a `390px` viewport). The builder grid/source list now uses zero-minimum tracks and wraps long source URLs; the regression verifies both a fresh mobile import and a 1440-to-390 resize.
- Checkpoint 4: both independent auditors returned **CLEAN — no material P0/P1 implementation issue remains** against the rebuilt production bundle. Security rechecked acquisition/privacy/publication boundaries and 90 focused assertions. UX reproduced the prior failure at 390×844 and after live resize; both measured `scrollWidth=390`, with no console/network failure. At that checkpoint, the subsequently documented real-data modeling P1s were separate evidence-driven product findings, not regressions in those implementation gates.
- Schema V2 resolution: the later evidence-driven modeling findings were repaired without weakening those software/security boundaries. Atomic claim evidence, reference integrity, conservative migration, projection drift, and the three real-card UI examples now have focused regressions. The original findings remain preserved in `REALITY_STRESS_TEST.md`; their disposition is in `REALITY_STRESS_TEST_RESOLUTION.md`.

## Final release gate

| Command or check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | 22 files, 190 tests passed |
| `npm run export:data` | Exported 10 cards (7 demo, 3 human reviewed) and the JSON Schema |
| `npm run validate:data` | 10 public cards (7 demo), 0 drafts, both artifacts valid and current |
| `npm run test:e2e` | 84 total: 80 passed, 4 intentional project-inapplicable skips, 0 failed |
| `npm run build` | Pass; data validation ran first and Next generated 23 pages |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Final V2 production browser audit | Homepage, three real cards, three-way comparison, populated V2 builder, and methodology at 1440×900 and 390×844; all 14 surface/viewport checks had exactly one `h1`, no page overflow, and no browser diagnostics |
| Populated mobile builder | Fresh import and 1440-to-390 resize both remained 390px wide; 0 serious/critical axe violations |
| Production security | Strict CSP without `unsafe-eval`, nosniff, referrer, frame, COOP, permissions, HSTS, and analysis `no-store`; no API-key identifier or key-shaped value in client static bundles |
| Research publication | All 7 public research files are SHA-256 identical to their source copies; templates remain empty/not-run and the site says “Study not yet published” |
| First real-card render | TechRise, Lumiere, and Diamond passed expanded-evidence inspection at 1440×900 and 390×844 with exact viewport-width documents, Human reviewed badges, no demo markers, and no console warnings/errors |

Verification ran locally on Windows 11 Home with Node.js 25.2.1, npm 11.6.2, Next.js 16.3.0, and Playwright 1.58.2. The final production process used `next start` on `127.0.0.1:4410` solely for local verification.

## Honest remaining boundaries

- The repository now contains three real cards completed through line-by-line human source review plus seven visibly fictional demo cards. Additional real cards still require the same checklist and independent evidence review.
- Schema V2 is grounded in those three reviewed cards. The age-band limitation remains a non-gating P2; broader ontologies, workflow engines, generalized recurrence, and currency conversion remain intentionally out of scope until evidence justifies them.
- No live OpenAI request was made because no API key was supplied. Model behavior is covered by deterministic mocks and adversarial post-processing tests, not a provider smoke call.
- Nothing was deployed. Aggregate rate limiting, concurrency/spend caps, outbound egress controls, provider/host log retention, and secret governance remain deployment responsibilities.
- No study or benchmark result is claimed. Protocols and empty templates are ready for consented research.
- Non-gating P2 boundaries: the compact builder directly edits the first repeated atomic subclaim while preserving and labeling imported tails; Diamond topical-prize names remain omitted until exact excerpts are reviewed; natural-language numbers and abbreviated dates are intentionally conservative in automated extraction; and age-band structure remains deferred until a broader reviewed sample justifies it.
