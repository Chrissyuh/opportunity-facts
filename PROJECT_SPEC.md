# Opportunity Facts product contract

Opportunity Facts is a public disclosure and comparison tool for student opportunities. It turns official program pages, rules, policies, and user-supplied source text into standardized facts cards whose claims remain attached to reviewable source excerpts.

## Product promise

The product must be understandable in ten seconds: **Opportunity Facts creates a source-backed facts card for student opportunities.** It reports what reviewed sources disclose; it does not rate legitimacy, quality, prestige, admissions impact, or value.

Uncertainty is useful output. Every fact uses one of five evidence statuses: `disclosed`, `not_found`, `unclear`, `conflicting`, or `not_applicable`. Cards use the review states `demo`, `draft`, `human_reviewed`, and `organizer_confirmed`. “Disclosed” means a cited source states the information, not that Opportunity Facts independently verified it.

## Required product surfaces

- A homepage with an above-the-fold, one-click fictional sample.
- A searchable/filterable demo and reviewed-card library.
- Full facts cards with evidence, sources, review metadata, JSON export, corrections, comparison, and print behavior.
- A two- or three-card neutral comparison driven by the shared field registry.
- A manual card builder with validation, live preview, local autosave, import/export, and honest review-state guidance.
- URL and pasted-source analysis with visible progress, deterministic evidence checking, and a useful no-key fallback.
- Methodology, schema/data documentation, a downloadable dataset, correction policy, version policy, limitations, and research materials.

## Information architecture

Schema `2.0.0` is authoritative for JSON validation, demo data, rendering, comparison, import/export, builder inputs, and publication. It retains the typed 59-field registry as a stable summary and comparison interface while adding structured records for cycle identity, organizations and relationships, variants, stages and pathways, scoped costs, and outcomes. Exactly 13 registry fields are core assessment areas. The meter leads with `X of Y applicable core facts disclosed`. Its detail begins `X of 13 core areas assessed`, then lists nonzero not-found, unclear, conflicting, not-applicable, and draft-unassessed counts in that order. It is never a score.

Supported flat-fact sections remain identity, eligibility, commitment, money, selection, outcomes, and terms. A fact preserves its status, original/displayed value, normalized representation, evidence sources, note, confidence, claim kind, and, when derived from V2 records, projection metadata. Each independently reviewable structured assertion has a stable claim ID and its own evidence behavior. A claim payload may bind inseparable typed fields supported by the same assertion—for example a role plus its scope—but cannot use one parent-record citation as blanket support for independent assertions. Scopes bind claims to variant, stage, and pathway IDs. Empty record collections explicitly distinguish `unassessed`, `none_found`, and `not_applicable`.

Mapped flat facts are deterministic compatibility projections, not a second editable truth source. A stored projection must exactly match the structured claims and claim references that generated it. Multiple legitimate scoped values become a labeled matrix/list with no false scalar normalization; incompatible values for the same scope remain conflicts. A modeled cost inventory is separately labeled `complete` or `incomplete`, and an incomplete inventory cannot produce a calculated total. See [`REALITY_STRESS_TEST_RESOLUTION.md`](./REALITY_STRESS_TEST_RESOLUTION.md) for the evidence-driven V2 decision.

## Data and persistence

Public cards are repository JSON. The initial dataset contains at least six obviously fictional `.example` demo cards with varied relationships, evidence statuses, costs, selection evidence, and cash/in-kind outcomes. Reviewed public V2 cards require a cycle-independent opportunity ID, a modeled cycle, and an explicit assessment state for every structured collection. User drafts and comparison selections remain on the device in browser storage. URL and pasted-text analysis responses are not permanently stored. No database, account, payment, social layer, or generic administration surface is part of the product.

Schema V1 files are accepted only through an explicit conservative import migration. Migration preserves the legacy facts and evidence, advances the card revision, clears review attestation, leaves every new structured section unassessed, and records the V1 digest. It never guesses cycle identity, organization roles, tier scopes, pathways, recipient scope, or funding type. Only canonical V2 cards may be published.

## Safe analysis contract

The server accepts only public HTTP(S) URLs without credentials. It rejects loopback, private, link-local, metadata, and other non-public destinations after DNS resolution and again on every redirect. Fetching uses explicit time and byte limits, safe content types, no cookies or credentials, a descriptive user agent, and at most six relevant same-origin pages beyond the submitted page. It never executes source scripts or performs arbitrary crawling.

Fetched and pasted text is untrusted data. The optional OpenAI Responses API integration is server-only and uses bounded strict-output sections for summary facts, cycle/identity foundation, and process/cost/outcome details. Every request sets `store: false`, has no automatic retry, and prohibits obeying source-page instructions or inventing unsupported claims. Every returned excerpt is deterministically matched against normalized source text; subject/recipient scope, target-program relevance, typed values, and target-cycle alignment are checked before display. One incomplete provider section cannot be presented as complete or erase independent completed sections. The application remains fully useful without `OPENAI_API_KEY`.

Automated output is always a draft. The product must explain that pages were collected automatically, missed or inaccessible sources can cause omissions, evidence still requires human checking, and analysis does not establish truth, legitimacy, quality, prestige, or value. Extraction evaluation keeps tuned development programs separate from preregistered out-of-sample programs and never promotes an automated draft into the reviewed public record.

## Design and accessibility

The visual language is calm public-interest infrastructure: warm neutral paper, deep ink, one deliberate accent, strong editorial typography, compact rules and status labels, and information-dense layouts. No gradients, glass, AI sparkles, fake testimonials, stock imagery, decorative charts, oversized rounded cards, or dead controls.

Primary flows target WCAG 2.2 AA behavior: semantic landmarks, skip navigation, correct heading order, complete labels, keyboard disclosures, visible focus, non-color status communication, accessible errors/tables/live regions, reduced motion, 200% zoom, and mobile tap targets.

## Security, privacy, and truthfulness

The application does not render arbitrary source HTML, expose API keys, collect student personal information, add hidden telemetry, permanently retain submitted pages, fabricate organizations or research results, or claim perfect security. The threat model documents SSRF, redirects, prompt injection, XSS, data retention, and remaining limitations.

## Release gate

A release is acceptable only after lint, strict typecheck, unit/integration/security tests, Playwright desktop/mobile flows with axe checks, and a production build pass. The rendered application must then be inspected at approximately 1440×900 and 390×844 for console/network errors, overflow, focus, keyboard operation, loading/error states, print behavior, consistency, and copy quality. `PLAN.md` and `PROGRESS.md` must reflect verified reality.
