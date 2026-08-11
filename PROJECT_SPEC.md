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

One strict Zod schema and one typed field registry are authoritative for JSON validation, demo data, rendering, disclosure counts, comparison, import/export, builder inputs, and model extraction. The registry defines exactly 13 core disclosure dimensions; the UI reports “X of 13 core facts disclosed” as completeness only.

Supported sections are identity, eligibility, commitment, money, selection, outcomes, and terms. A fact preserves its status, original/displayed value, normalized representation, evidence sources, note, confidence, and claim kind. Every displayed factual value needs evidence unless its status is `not_found`, `unclear`, or `not_applicable`. Conflicts preserve every supported value. Calculations preserve inputs and visibly identify the calculation.

## Data and persistence

Public cards are repository JSON. The initial dataset contains at least six obviously fictional `.example` demo cards with varied relationships, evidence statuses, costs, selection evidence, and cash/in-kind outcomes. User drafts and comparison selections remain on the device in browser storage. URL and pasted-text analysis responses are not permanently stored. No database, account, payment, social layer, or generic administration surface is part of version one.

## Safe analysis contract

The server accepts only public HTTP(S) URLs without credentials. It rejects loopback, private, link-local, metadata, and other non-public destinations after DNS resolution and again on every redirect. Fetching uses explicit time and byte limits, safe content types, no cookies or credentials, a descriptive user agent, and at most six relevant same-origin pages beyond the submitted page. It never executes source scripts or performs arbitrary crawling.

Fetched and pasted text is untrusted data. The optional OpenAI Responses API integration is server-only, uses strict structured output, bounded input/output, and a prompt that prohibits obeying source-page instructions or inventing unsupported claims. Every returned excerpt is deterministically matched against normalized source text; unmatched support is removed or downgraded before display. The application remains fully useful without `OPENAI_API_KEY`.

## Design and accessibility

The visual language is calm public-interest infrastructure: warm neutral paper, deep ink, one deliberate accent, strong editorial typography, compact rules and status labels, and information-dense layouts. No gradients, glass, AI sparkles, fake testimonials, stock imagery, decorative charts, oversized rounded cards, or dead controls.

Primary flows target WCAG 2.2 AA behavior: semantic landmarks, skip navigation, correct heading order, complete labels, keyboard disclosures, visible focus, non-color status communication, accessible errors/tables/live regions, reduced motion, 200% zoom, and mobile tap targets.

## Security, privacy, and truthfulness

The application does not render arbitrary source HTML, expose API keys, collect student personal information, add hidden telemetry, permanently retain submitted pages, fabricate organizations or research results, or claim perfect security. The threat model documents SSRF, redirects, prompt injection, XSS, data retention, and remaining limitations.

## Release gate

A release is acceptable only after lint, strict typecheck, unit/integration/security tests, Playwright desktop/mobile flows with axe checks, and a production build pass. The rendered application must then be inspected at approximately 1440×900 and 390×844 for console/network errors, overflow, focus, keyboard operation, loading/error states, print behavior, consistency, and copy quality. `PLAN.md` and `PROGRESS.md` must reflect verified reality.
