# Opportunity Facts repository instructions

## Non-negotiable product rules

- This is a disclosure and comparison tool, never a verdict engine. Do not add legitimacy, scam, prestige, worth, admissions-impact, or value scores.
- Make uncertainty visible. Preserve `not_found`, `unclear`, and `conflicting` states instead of smoothing them away.
- “Disclosed” means a cited source states a fact. “Human reviewed” means a reviewer checked value/excerpt/source alignment, not that the underlying claim was audited. “Organizer confirmed” is not independent verification.
- Never fabricate real organizations, users, traffic, results, accuracy figures, endorsements, or organizer responses. Demo cards must be obviously fictional, use `.example` URLs, and remain labeled Demo data.
- Every displayed value requires evidence unless its status is `not_found`, `unclear`, or `not_applicable`. Deterministically reject model excerpts that do not match source text.
- Preserve conflicting supported values and distinguish cash from in-kind value. Never infer university operation, endorsement, acceptance rate, refundability, or legal status from weak signals.
- Keep participant, team, project, educator, school, and organization outcome recipients distinct. Educator/school outcomes may remain visible in rich details but must never project as participant cash or in-kind benefits.
- Structured V2 values carry evidence at the atomic claim, not merely on a parent record. Preserve variant/stage/pathway scope, recipient scope, distribution, conditions, and source precision.
- The 59 flat facts are stable projections where V2 structured records apply. Never hand-edit a projected fact, discard its claim references, select one tier/pathway value as universal, or publish projection drift.
- A modeled cost list is not automatically complete. Preserve `costItems.completeness`; never calculate a total from an incomplete inventory, even when every recorded item has an amount.
- A V1 import is always a new draft revision with unassessed structured sections. Never retain its review attestation or infer V2 semantics from legacy prose.

## Architecture

- `app/`: App Router pages, layouts, and server route handlers.
- `components/`: accessible reusable product and form components.
- `lib/opportunity/`: authoritative V1/V2 schemas, atomic structured claims, field registry, deterministic projections, conservative migration, formatting, evidence, comparison, persistence, and data loading.
- `lib/analysis/`: server-only URL safety, fetching, extraction, model integration, and analysis orchestration.
- `data/demo/`: fictional demo JSON; `data/drafts/`: non-public work in progress; `data/opportunities/`: AI-audited, human-reviewed, or organizer-confirmed public cards.
- `scripts/`: data validation and card creation helpers.
- `tests/`: unit, security, integration, fixtures, and Playwright tests.
- `docs/`, `research/`, `public/schema/`, and `public/data/`: durable documentation and machine-readable exports.

Server-only modules must start with `import "server-only"` where appropriate. Client components may receive only serializable data. User-created drafts and compare selections stay in browser storage; submitted page content is not stored by the server.

## Commands

- `npm install` — install the locked dependency graph.
- `npm run dev` — development server.
- `npm run lint` — ESLint.
- `npm run typecheck` — strict TypeScript without emit.
- `npm test` — deterministic Vitest suite.
- `npm run test:e2e` — Playwright desktop/mobile browser suite.
- `npm run build` — production Next.js build.
- `npm run validate:data` — validate every repository card against the shared schema.
- `npm run create:card -- <slug>` — create a minimal draft JSON from the shared schema.
- `npm run export:data` — rebuild the deterministic public dataset and machine-readable schema.

## Engineering conventions

- TypeScript stays strict. Do not introduce casual `any`, silence lint rules, skip tests, or use unsafe casts to conceal invalid data.
- Extend the central schema and registry; do not recreate field lists or domain logic in components.
- Extend the shared structured schemas and projector rather than writing a component-only relationship, pricing, pathway, or outcome model. Reviewed V2 cards cannot leave structured collections `unassessed`.
- Keep client/server boundaries explicit and components focused. Prefer semantic HTML and CSS over needless dependencies.
- Never render fetched HTML or source excerpts through `dangerouslySetInnerHTML`.
- Keep URL fetching bounded: public HTTP(S) on protocol-default ports, DNS/IP validation, redirect revalidation, response/time limits, safe content types, no cookies/authentication, same-origin discovery only.
- Keep the extraction model bounded and optional. Tests mock pages and model output and never require external sites or an API key.
- Preserve unrelated worktree changes. Do not commit, push, deploy, or mutate production resources without Christopher’s explicit instruction.

## Design and writing constraints

Use warm neutral surfaces, deep ink, one accent, subtle rules, strong typography, compact status markers, visible focus, and restrained motion. Avoid gradients, glassmorphism, AI clichés, huge empty heroes, excessive nesting, fake social proof, stock images, decorative charts, and dead controls. Copy must be precise and neutral.

## Test expectations and stop conditions

Changes are not complete until relevant unit/integration/security tests, lint, typecheck, build, and browser checks pass. UI changes require keyboard and desktop/mobile rendered verification; primary routes require serious/critical axe checks. Stop and report honestly if a secret, external service, or environment prevents live validation, but missing `OPENAI_API_KEY` must never break the app or block deterministic tests.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
