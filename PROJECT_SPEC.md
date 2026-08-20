# Opportunity Facts product contract

Opportunity Facts is a public disclosure and comparison tool for student opportunities. It turns official program pages, rules, policies, and user-supplied source text into standardized facts cards whose claims remain attached to reviewable source excerpts.

## Product promise

The product must be understandable in ten seconds: **paste an opportunity URL and Opportunity Facts researches its public pages into a source-backed draft.** URL analysis is the primary product; reviewed examples, comparison, and manual building are secondary reference and editing tools. It reports what reviewed sources disclose; it does not rate legitimacy, quality, prestige, admissions impact, or value.

Uncertainty is useful output. Every fact uses one of five evidence statuses: `disclosed`, `not_found`, `unclear`, `conflicting`, or `not_applicable`. Cards distinguish `demo`, manual `draft`, `automated_draft`, `ai_audited`, `human_reviewed`, and `organizer_confirmed` provenance. “Disclosed” means a cited source states the information, not that Opportunity Facts independently verified it.

## Required product surfaces

- An analyzer-first homepage with a dominant URL input, concrete promise, concise draft/evidence boundary, and real AI-audited examples as secondary proof.
- URL and pasted-source analysis with streamed observable progress, validated fact previews, grounded Needs Attention, deterministic good/caveated/insufficient outcomes, cancellation, and a useful no-key fallback.
- A practical default Overview plus a dedicated Full Record workspace containing all facts, V2 structures, evidence, sources, review/version metadata, search/filter/jump controls, and selectable-text Summary and Full Evidence PDFs.
- A searchable/filterable examples bank that separates AI-audited, human-reviewed, organizer-confirmed, and fictional demo records.
- A two- or three-card neutral comparison with Key Differences, Core Facts, and Full Record modes driven by the shared field registry.
- A bounded batch analyzer for at most five canonical distinct URLs with two-worker concurrency, per-item progress/cancellation, partial completion, and independent quality gating.
- A manual card builder with validation, live preview, local autosave, import/export, and honest review-state guidance.
- Methodology, schema/data documentation, a downloadable dataset, correction policy, version policy, limitations, and research materials.

## Information architecture

Schema `2.2.0` is authoritative for JSON validation, demo data, rendering, comparison, import/export, builder inputs, and publication. It retains the typed 59-field registry and all Schema `2.1.0` structured records while separating AI-audited evidence alignment from review completed by a person. Schemas `2.0.0` and `2.1.0` remain accepted through deterministic lossless import migration. Exactly 13 registry fields are core assessment areas. The meter leads with `X of Y applicable core facts disclosed`. Its detail begins `X of 13 core areas assessed`, then lists nonzero not-found, unclear, conflicting, not-applicable, and draft-unassessed counts in that order. It is never a score.

Supported flat-fact sections remain identity, eligibility, commitment, money, selection, outcomes, and terms. A fact preserves its status, original/displayed value, normalized representation, evidence sources, note, confidence, claim kind, and, when derived from V2 records, projection metadata. Each independently reviewable structured assertion has a stable claim ID and its own evidence behavior. A claim payload may bind inseparable typed fields supported by the same assertion—for example a role plus its scope—but cannot use one parent-record citation as blanket support for independent assertions. Scopes bind claims to variant, stage, and pathway IDs. Empty record collections explicitly distinguish `unassessed`, `none_found`, and `not_applicable`.

Mapped flat facts are deterministic compatibility projections, not a second editable truth source. A stored projection must exactly match the structured claims and claim references that generated it. Multiple legitimate scoped values become a labeled matrix/list with no false scalar normalization; incompatible values for the same scope remain conflicts. A modeled cost inventory is separately labeled `complete` or `incomplete`, and an incomplete inventory cannot produce a calculated total. See [`REALITY_STRESS_TEST_RESOLUTION.md`](./REALITY_STRESS_TEST_RESOLUTION.md) for the evidence-driven V2 decision.

## Data and persistence

Public cards are repository JSON. The initial dataset contains at least six obviously fictional `.example` demo cards with varied relationships, evidence statuses, costs, selection evidence, and cash/in-kind outcomes. Reviewed public V2 cards require a cycle-independent opportunity ID, a modeled cycle, and an explicit assessment state for every structured collection. User drafts and comparison selections remain on the device in browser storage. URL and pasted-text drafts are not permanently stored. An optional minimal durable key/value store may retain only an eligible insufficient-quality classification, safe high-level reasons, timestamps, analyzer version, expiry, and submitted-page text fingerprint for 14 days; it must never retain source text, model candidates, headers, or provider/transient failures. No account, payment, social layer, or generic administration surface is part of the product.

Schema V1 files are accepted only through an explicit conservative import migration. Migration preserves the legacy facts and evidence, advances the card revision, clears review attestation, leaves every new structured section unassessed, and records the V1 digest. It never guesses cycle identity, organization roles, tier scopes, pathways, recipient scope, or funding type. Schema `2.0.0` and `2.1.0` imports retain rich claims, evidence, review state, and card revision while the derived 59-field summary is deterministically rebuilt under `2.2.0` projection rules; a portable attested file still loses its review attestation under the normal import-safety rule. Only canonical `2.2.0` cards may be published.

## Safe analysis contract

The server accepts only public HTTP(S) URLs without credentials. It rejects loopback, private, link-local, metadata, and other non-public destinations after DNS resolution and again on every redirect. Fetching uses explicit time and byte limits, safe content types, no cookies or credentials, a descriptive user agent, and at most six relevant same-origin pages beyond the submitted page. It never executes source scripts or performs arbitrary crawling.

Fetched and pasted text is untrusted data. The optional OpenAI Responses API integration is server-only and uses four bounded strict-output sections: summary facts, cycle/identity foundation, schedule/selection process, and costs/outcomes. Summary and foundation run concurrently; process and financial extraction then run concurrently with only strict-schema candidate foundation context, still labeled untrusted. Every request sets `store: false`, has no automatic retry, and prohibits obeying source-page instructions or inventing unsupported claims. Every returned excerpt is deterministically matched against normalized source text; subject/recipient scope, target-program relevance, typed values, relationship/reference identity, cost/outcome semantics, and target-cycle alignment are checked before display. One incomplete provider section cannot be presented as complete or erase independent completed sections. The application remains fully useful without `OPENAI_API_KEY`.

Automated output is always a draft. Streamed progress may expose only observable acquisition events, completed model-family milestones, deterministically retained preview facts, validation counts, and safe quality events; hidden reasoning and speculative candidate claims are never shown. Needs Attention explanations must survive deterministic claim/status/source-reference grounding, and at most five decision-important items appear in the Overview. The quality gate uses explicit structural signals rather than model confidence. It suppresses insufficient records and offers a better official page or pasted-source recovery instead of a blind retry.

Eligible deterministic quality failures may be cached by canonical URL and analyzer version. Same-browser unchanged retries block immediately; a durable cross-user hit performs a bounded submitted-page fingerprint check when available and spends no model tokens if unchanged. Provider, cancellation, temporary network, and internal failures are never cached. `ANALYSIS_FAILURE_CACHE_BYPASS_HOSTS` affects only cache reads/writes and cannot alter acquisition, prompts, validation, thresholds, projections, or UI interpretation.

The product must explain that pages were collected automatically, missed or inaccessible sources can cause omissions, evidence still requires human checking, and analysis does not establish truth, legitimacy, quality, prestige, or value. Extraction evaluation keeps tuned development programs separate from preregistered out-of-sample programs and never promotes an automated draft into the reviewed public record.

## Design and accessibility

The visual language is calm public-interest infrastructure: warm neutral paper, deep ink, one deliberate accent, strong editorial typography, compact rules and status labels, and information-dense layouts. No gradients, glass, AI sparkles, fake testimonials, stock imagery, decorative charts, oversized rounded cards, or dead controls.

Primary flows target WCAG 2.2 AA behavior: semantic landmarks, skip navigation, correct heading order, complete labels, keyboard disclosures, visible focus, non-color status communication, accessible errors/tables/live regions, reduced motion, 200% zoom, and mobile tap targets.

## Security, privacy, and truthfulness

The application does not render arbitrary source HTML, expose API keys, collect student personal information, add hidden telemetry, permanently retain submitted pages, fabricate organizations or research results, or claim perfect security. The threat model documents SSRF, redirects, prompt injection, XSS, data retention, and remaining limitations.

## Release gate

A release is acceptable only after lint, strict typecheck, unit/integration/security tests, Playwright desktop/mobile flows with axe checks, and a production build pass. The rendered application must then be inspected at approximately 1440×900 and 390×844 for console/network errors, overflow, focus, keyboard operation, loading/error states, print behavior, consistency, and copy quality. `PLAN.md` and `PROGRESS.md` must reflect verified reality.
