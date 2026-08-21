# Quality audit

Opportunity Facts is release-gated by repository tests, deterministic public artifacts, rendered browser checks, and independent security/data and UX/accessibility audits. A finding remains open until the repair and a focused regression pass; material P0/P1 findings also reset the clean-audit checkpoint.

## Closed material findings

| Area | Result | Regression evidence |
| --- | --- | --- |
| Configuration and bounded input | Fixed `.env.example` tracking, streamed request-size enforcement, pre-configuration input validation, sanitized errors, and `no-store` analysis responses. | Route/security tests cover oversized streams, invalid/canonical-duplicate inputs, keyless operation, and downstream failures. |
| Domain truthfulness | Centralized all 59 fields and 13 core dimensions; enforced review scope, `not_applicable` reasons, source inventory reuse, review/version invalidation, calculated-claim arithmetic, cost completeness, and organizer-stated acceptance-rate attribution. | Schema, normalization, builder, analysis, and data-validation regressions. |
| Heterogeneous real-card fidelity | Added Schema V2 atomic claims, explicit assessment states, scoped organizations/variants/stages/pathways/costs/outcomes, deterministic flat-fact projections, and conservative V1 migration. Schema `2.2.0` retains educator-recipient safeguards, distinguishes AI-audited evidence alignment from human review, and retains lossless `2.0.0`/`2.1.0` imports. | `schema-v2`, canonical-card population, serialization/version migration, registry, and structured desktop/mobile browser regressions; full disposition in `REALITY_STRESS_TEST_RESOLUTION.md`. |
| URL and SSRF boundaries | Added shared literal-host screening plus server DNS validation, address pinning, redirect revalidation, same-origin discovery limits, Azure platform-service blocking, and sensitive query/fragment rejection. | Security tests cover IPv4/IPv6/mapped forms, metadata/local/service addresses, mixed DNS, redirects, byte/time/content bounds, fragments, and pinned transport behavior. |
| Pre-fast extraction hardening | The former four-family path established fair source input, cancellation, hostile-output sanitization, exact excerpts, typed value/relationship/cost/outcome checks, subject/recipient scope checks, first-class cycle resolution, sibling-program isolation, safe family-level salvage, durable coverage limitations, neutral summaries/slugs, and no automatic acceptance-rate inference. Those deterministic safeguards remain authoritative under the smaller current contracts. Static acquisition also preserves semantic reveal shells and reads a bounded allowlist of non-executable Schema.org metadata. | Analysis integration tests include strict-schema budgets, hostile notes, unsupported calculations, platform/legal/program scope confusion, historical-cycle mixing, sibling pages, entity-reference mismatches, optional/mandatory cost confusion, restricted-funding/cash confusion, empty shells, currency/date/enum mismatches, incomplete prize matrices, truncation/timeout, and structured-family salvage. |
| Fast Analyze and Extended Research | Replaced the former always-on four-family product path with one compact sparse request for normal Analyze and two optional independently salvageable Extended requests. Normal output uses compact source references, an explicit assessed-field mask, a fast decision-usefulness gate, max-three grounded attention items, and no rich-ledger generation quota. Extended Research accepts only opaque server-held continuation state, reuses acquired sources, protects validated baseline facts, deduplicates concurrent/repeated calls, and preserves the normal result on cancellation/failure. | Contract tests cover schema/input/output bounds, source hydration and unknown-source rejection, compact conflict preservation, fast quality thresholds, contextual selectivity, session TTL/size/count/version bounds, route admission/cancellation, idempotence, partial salvage, baseline protection, and normal/Extended browser transitions. |
| Publication and local drafts | Drafts are excluded from public export; public states and artifact parity fail closed at validation/build and runtime load. Local writes roll back on partial failure. Imported drafts cannot create dead public links or duplicate comparison columns. | Temporary-repository artifact tests, runtime dataset tests, browser import/persistence flows, and `build` running `validate:data` first. |
| UX, accessibility, and layout | Repaired heading order, focus indicators, contrast, semantic lists, live results, keyboard disclosures, comparison containment, builder state synchronization, and populated-builder mobile overflow. Current hardening also separates reviewed/demo records, collapses mobile filters, adds mobile comparison navigation, replaces simulated analyzer stages with truthful elapsed/indeterminate status, and exposes bounded acquisition failures with a paste-source handoff. | Playwright runs both 1440×900 and 390×844 projects, axe checks primary/expanded states, print checks, and desktop-to-mobile regressions. The final 88-test matrix completed with 84 passes, 4 intentional project-inapplicable skips, and no failures. |

## Independent audit checkpoints

- Checkpoint 2: independent UX/accessibility and security/data reviews found no remaining material source/contract defect after the main repair pass.
- Checkpoint 3: the UX audit found one P1 in the populated mobile builder (`421px` document width at a `390px` viewport). The builder grid/source list now uses zero-minimum tracks and wraps long source URLs; the regression verifies both a fresh mobile import and a 1440-to-390 resize.
- Checkpoint 4: both independent auditors returned **CLEAN — no material P0/P1 implementation issue remains** against the rebuilt production bundle. Security rechecked acquisition/privacy/publication boundaries and 90 focused assertions. UX reproduced the prior failure at 390×844 and after live resize; both measured `scrollWidth=390`, with no console/network failure. At that checkpoint, the subsequently documented real-data modeling P1s were separate evidence-driven product findings, not regressions in those implementation gates.
- Schema V2 resolution: the later evidence-driven modeling findings were repaired without weakening those software/security boundaries. Atomic claim evidence, reference integrity, conservative migration, projection drift, and the three real-card UI examples now have focused regressions. The original findings remain preserved in `REALITY_STRESS_TEST.md`; their disposition is in `REALITY_STRESS_TEST_RESOLUTION.md`.

## Last completed release gate

The results below describe committed checkpoint `3cd7ea1`. They remain historical evidence, not a claim that the current post-checkpoint working tree has completed its release gate.

| Command or check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | 27 files, 234 tests passed |
| `npm run export:data` | Exported 17 cards (7 demo, 10 then-labeled human reviewed) and the JSON Schema |
| `npm run validate:data` | 17 public cards (7 demo), 0 drafts, both artifacts valid and current |
| `npm run test:e2e` | 86 total: 82 passed, 4 intentional project-inapplicable skips, 0 failed |
| `npm run build` | Pass; data validation ran first and Next generated 30 pages |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Final V2 production browser audit | Homepage, three real cards, three-way comparison, populated V2 builder, and methodology at 1440×900 and 390×844; all 14 surface/viewport checks had exactly one `h1`, no page overflow, and no browser diagnostics |
| Populated mobile builder | Fresh import and 1440-to-390 resize both remained 390px wide; 0 serious/critical axe violations |
| Production security | Strict CSP without `unsafe-eval`, nosniff, referrer, frame, COOP, permissions, HSTS, and analysis `no-store`; no API-key identifier or key-shaped value in client static bundles |
| Research publication | All 7 public research files are SHA-256 identical to their source copies; templates remain empty/not-run and the site says “Study not yet published” |
| First real-card render | TechRise, Lumiere, and Diamond passed expanded-evidence inspection at 1440×900 and 390×844 with exact viewport-width documents. Their review-state wording has since been corrected to AI-audited without changing evidence or frozen metrics. |
| Live extraction benchmark | Production-path smoke and three final development runs completed on exact model `gpt-5.6-terra`; 52/54 supported claims and 70/72 evidence attachments were semantically correct, with zero known critical misleading claims after validation |
| Analyzer state audit | Pre-run, loading, malformed-provider failure, successful partial-family draft, explicit non-human-review warning, and expanded evidence inspected at 1440×900 and 390×844 without horizontal overflow or unexpected browser diagnostics |
| Preregistered out-of-sample extraction | Frozen seven-card set, one run per card, no replacement runs or tuning; 82/154 ground-truth claim precision, 188/203 semantic evidence correctness, 16/82 structured recall, and 4 critical misleading claims. Machine ledgers and full limitations are preserved under `research/extraction-evaluation/`. |
| Expanded real-card browser audit | The 17-card library, Congressional App Challenge, Yale, QuestBridge, a Yale/Breakthrough/QuestBridge comparison, methodology, partial-source draft, and expanded evidence were checked at 1440×900 and 390×844 with exact viewport-width documents and no non-failure browser diagnostics. |
| Private Lumos judge-path acceptance | One production analysis completed the then-current three-family path. Offline replay of the same paid candidate after generalized deterministic repairs produced 18/18 displayed supported claims, 18/18 semantically correct evidence attachments, and zero critical misleading claims; no Lumos-specific production branch or public card was added. This is not live validation of the newer four-family path. |

Verification ran locally on Windows 11 Home with Node.js 25.2.1, npm 11.6.2, Next.js 16.3.0, and Playwright 1.58.2. The final production process used `next start` on `127.0.0.1:4410` solely for local verification.

## Current post-checkpoint gate

Implemented and release-gated after `3cd7ea1`:

- two-wave, four-family extraction (`facts` + `foundation`, then `process` + `financial`) with independent completion telemetry and no paid retry;
- deterministic cycle ambiguity handling, sibling-source exclusion, all-citation target relevance, typed numeric/date/money alignment, referenced-entity alignment, optional/conditional cost semantics, and cash/restricted-funding recipient semantics;
- bounded iterative HTML processing for hostile deep or repeated structures;
- JSON/origin/body/deadline admission controls, per-process concurrency, a server-side analysis kill switch, default-port-only public acquisition, abort propagation, and controlled cleanup;
- manually re-reviewed revision-2 corrections for Breakthrough Junior Challenge educator/school outcomes and Polygence rolling-cycle identity, without changing frozen evaluation scores;
- reviewed/demo library separation, mobile filter and comparison navigation, truthful analyzer run status, and visible failed-page fallback.

| Command or check | Result |
| --- | --- |
| `npm run export:data` / `npm run validate:data` | 17 public cards (7 demo), 0 drafts, dataset and JSON Schema current |
| `npm run lint` / `npm run typecheck` | Pass |
| `npm test` | 32 files, 375 tests passed |
| `npm run test:e2e` | 88 total: 84 passed, 4 intentional project-inapplicable skips, 0 failed |
| `npm run build` | Pass; data validation ran first and Next generated 30 pages |
| `npm audit --audit-level=high` / `git diff --check` | 0 vulnerabilities; no whitespace errors |
| Production browser audit | Homepage, analyzer, 17-card library, complex reviewed card, three-card comparison, structured details, and methodology inspected at 1440×900 and 390×844; exact page width and no console warnings/errors |
| Independent final audit | No remaining P0/P1 implementation or commit blocker; secrets and immutable evaluation history remained outside the diff |

## Current student-product release gate

The analyzer-first redesign adds streamed observable progress, deterministic quality outcomes, grounded attention items, cache-safe retry suppression, five-URL batch orchestration, practical Overview and Full Record surfaces, decision-focused comparison, corrected AI-audited provenance, and two selectable-text PDF formats.

| Command or check | Result |
| --- | --- |
| `npm run export:data` / `npm run validate:data` | 17 public cards (10 AI-audited, 7 demo), 0 drafts, public dataset and Schema `2.2.0` current |
| `npm run lint` / `npm run typecheck` | Pass |
| `npm test` | 39 files, 400 tests passed |
| `npm run test:e2e` | 108 total: 104 passed, 4 intentional project-inapplicable skips, 0 failed |
| `npm run build` | Pass; fail-closed data validation ran first and Next generated 48 pages |
| PDF audit | Summary and Full Record downloads passed in a real browser; selectable text, exact links, page numbering, grounded attention, and zero PDF console errors |
| Accessibility/browser audit | Primary analyzer, Overview, Full Record, examples, comparison, batch, builder, methodology, data, and expanded evidence passed desktop/mobile serious/critical axe checks and overflow regressions |
| Live latency sample | Three one-shot `gpt-5.6-terra` runs: 117.942s minimum, 122.464s median, 195.622s maximum; provider generation dominated wall time; one process-family timeout was safely isolated |

## Current fast-analysis and Extended Research release gate

| Command or check | Result |
| --- | --- |
| `npm run export:data` / `npm run validate:data` | 17 public cards (10 AI-audited, 7 demo), 0 drafts, public dataset and Schema `2.2.0` current |
| `npm run lint` / `npm run typecheck` | Pass |
| `npm test` | 42 files, 435 tests passed |
| `npm run test:e2e` | 124 total: 120 passed, 4 intentional project-inapplicable skips, 0 failed |
| `npm run build` | Pass; fail-closed data validation ran first and Next generated 48 pages |
| `npm audit --audit-level=high` / `git diff --check` | 0 vulnerabilities; no whitespace errors |
| Browser/accessibility audit | Normal completion, Extended in-progress/completed/partial/failure/cancel, minefield override, suppression bypass, and hidden batch navigation passed desktop/mobile serious/critical axe and overflow checks; production tablet audit covered four primary routes at 768×1024 with zero diagnostics and exact width |
| PDF audit | Diamond Summary/Full 3/14 pages, Lumiere 4/13, TechRise 3/9; selectable text, exact hyperlinks, visible page numbering, deduplicated evidence, no JavaScript/Launch/EmbeddedFile payloads, and no visually observed clipping/overlap |
| Secret/history integrity | `.env.local` ignored; no high-confidence key/private-key pattern; immutable development/out-of-sample/reality-stress reports and research artifact trees unchanged |
| Current normal latency | Three final-contract samples: 23.446s minimum, 25.829s median, 31.224s maximum; 2,410–3,267 output tokens; estimated three-case cost $0.154568 |
| Extended incremental latency | Two samples: 39.357–56.330s, no source refetch, 7,022–7,982 output tokens, estimated incremental cost $0.104576–$0.134374 |
| Private Lumos judge path | Final compact run acquired four pages in 23.446s, returned `good`, retained 13 practical supported facts and 3 grounded attention items, emitted zero evidence warnings, and showed no observed critical misleading claim. Two later fixture-backed deterministic retention fixes were not paid-rerun. No Lumos-specific production code or public record exists. |

## Honest remaining boundaries

- The repository now contains ten real cards completed through line-by-line AI-assisted source auditing plus seven visibly fictional demo cards. Their current state is `ai_audited`, not human reviewed. Scoring exposed incomplete frozen ground truth on some claims, especially Yale; future evaluations require a second blind human review and adjudication before inference.
- Schema V2 is grounded in those three reviewed cards. The age-band limitation remains a non-gating P2; broader ontologies, workflow engines, generalized recurrence, and currency conversion remain intentionally out of scope until evidence justifies them.
- Live OpenAI Responses requests were made for the controlled three-card development benchmark, exactly seven preregistered out-of-sample primary runs, and the private post-evaluation Lumos development check documented in `POST_EVALUATION_HARDENING.md`. Exact benchmark/evaluation settings, acquired pages, usage, drafts/failure, warnings, and semantic ledgers are preserved under `research/extraction-benchmark/` and `research/extraction-evaluation/`; no key or authorization header is retained.
- The application is deployed at `https://opportunityfacts.vercel.app`. Paid work fails closed unless Upstash-backed per-address rate limits, weighted global concurrency, and daily/total spend reservations are available. Provider-side account limits, platform log retention, and outbound-network policy remain additional account-level controls rather than repository guarantees.
- Extended Research continuation state is an opaque, analyzer-version-bound Redis record with a fixed 30-minute TTL and bounded source/serialized size. Browser state is never authoritative. If the shared store expires or fails, the normal result remains intact and the extension reports a controlled non-destructive failure.
- Extended Research structured recall remains conservative. In the two live samples, deterministic validation withheld many malformed or weakly bound rich candidates; MITES retained no rich record collection and Lumos retained one cost record. The optional path is safer and smaller than the old default, but richer recall is a material remaining weakness for the final professionalism audit to present honestly rather than mask.
- No comprehension/user study result is claimed. The seven-card evaluation is independent of extraction tuning for its reported run, but is too small and has a documented ground-truth-completeness limitation; it is not population-level accuracy.
- Non-gating P2 boundaries: the compact builder directly edits the first repeated atomic subclaim while preserving and labeling imported tails; Diamond topical-prize names remain omitted until exact excerpts are reviewed; natural-language numbers and abbreviated dates are intentionally conservative in automated extraction; and age-band structure remains deferred until a broader reviewed sample justifies it.

## Current competition-release gate

| Command or check | Result |
| --- | --- |
| `npm run export:data` / `npm run validate:data` | 17 public cards (10 AI-audited, 7 demo), 0 drafts, public dataset and Schema `2.2.0` current |
| `npm run lint` / `npm run typecheck` | Pass |
| `npm test` | 47 files, 461 tests passed |
| `npm run test:e2e` | 136 total: 132 passed, 4 intentional project-inapplicable skips, 0 failed |
| `npm run build` | Pass; fail-closed data validation ran first and Next generated 49 pages |
| `npm audit --audit-level=high` / `git diff --check` | 0 vulnerabilities; no whitespace errors |
| Production controls | Real Redis round trip/TTL, per-address rejection, weighted global-concurrency rejection, and hard-budget rejection passed before analysis was enabled; control-store failure is fail-closed |
| Production security/privacy | CSP, HSTS, frame/MIME/referrer/permissions headers present; review workspace hard-404s; Batch hidden; runtime-log scan found no target URL, API-key identifier, authorization header, prompt, or source excerpt |
| Production smokes | Lumos normal and Extended plus MITES and Diamond normal paths completed. No run was repeated to improve its output; these are deployment checks, not a benchmark. |
| PDF audit | Production Lumos artifact renders as a 2-page Summary and 9-page Full Evidence report with selectable text, exact links, page numbering, and visually clean section boundaries |

The final page-boundary pass keeps the private production Lumos artifact at 2/9 pages. Three deliberately complex reviewed records render at 3–4 Summary pages and 11–17 Full Evidence pages. The two hardest examples exceed the 8–15-page design target slightly so structured records and exact evidence remain readable; all pages retain Letter dimensions, running context, page numbering, selectable text, and exact links.
