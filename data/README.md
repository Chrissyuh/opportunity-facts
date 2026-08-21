# Opportunity Facts data

Repository cards are canonical schema `2.2.0` JSON validated by `lib/opportunity/schema.ts`. Portable `2.0.0` and `2.1.0` cards remain accepted through deterministic import migration that preserves rich claims/evidence and rebuilds current projections; repository publication always exports the current schema.

- `demo/` contains conspicuously fictional cards. Every URL uses the reserved `.example` domain and every card has the `demo` review state.
- `drafts/` contains work in progress and is always excluded from public artifacts.
- `opportunities/` is reserved for real cards whose facts have been checked by a human against the cited excerpts. A checked excerpt is not an independent audit of the underlying claim.
- `public/data/opportunities.json` is the downloadable aggregate dataset.
- `public/schema/opportunity-card.schema.json` is the machine-readable schema. The Zod schema remains authoritative for cross-field evidence rules that JSON Schema cannot express.

Create a draft with:

```powershell
npm run create:card -- your-card-slug
```

Then replace `not_found` statuses only where the reviewed sources support a different status. A `disclosed` value needs a citation and exact excerpt. Keep contradictory supported values under `conflictingValues`; do not choose one. Distinguish cash, fees, in-kind values, and tuition waivers in `normalizedValue.classification`.

V2 also requires an explicit opportunity/cycle identity and assessed structured collections for organizations, organization roles, institution relationships, variants, stages, pathways, cost items, and outcomes. Each independently reviewable semantic assertion has its own `claimId`, status, and evidence behavior. A claim may bind inseparable fields supported by the same passage, such as a role and its scope; a parent record cannot provide blanket evidence for separate assertions. Scopes refer only to known variant, stage, and pathway IDs. Use `none_found` or `not_applicable` with a reason when a collection was assessed and empty; `unassessed` is draft-only for reviewed cards. A modeled cost collection also records `completeness: "complete" | "incomplete"`; listed costs alone never prove the inventory is complete.

The core meter leads with `X of Y applicable core facts disclosed`. Detail begins `X of 13 core areas assessed`, then lists nonzero not-found, unclear, conflicting, not-applicable, and unassessed counts in that order. These are disclosure and assessment counts, not an opportunity score.

The 59 flat facts remain the compatibility and summary interface. Fields covered by structured data are deterministic projections with claim references. Edit the structured record, not the projected fact; validation rejects stale values, missing references, and projection drift.

The generator writes to `data/drafts/`. After completing the review checklist, setting a truthful publishable state and timestamp, and recording at least one checked page, move the file to `data/opportunities/`. The exporter rejects drafts in the public directory. A Human reviewed state is not selected in the public builder: use the local digest-bound workflow documented in [`docs/REVIEW_CHECKLIST.md`](../docs/REVIEW_CHECKLIST.md), which creates the required `data/reviews/<slug>.human-review.json` sidecar only after interactive human confirmation.

Schema V1 imports are accepted only through conservative migration. They become a new draft V2 revision, keep the legacy facts/evidence, record the prior-card digest, and leave all new structured sections unassessed. Migration does not infer cycle identity, roles, scopes, pathways, recipient scope, or funding type; a reviewer must populate and re-attest those records before publication.

Rebuild the downloadable dataset and exported schema after adding or changing cards:

```powershell
npm run export:data
```

The export is reproducible: its `generatedAt` value is the latest reviewed/source-access timestamp in the included cards, not the wall-clock time when the command ran.

Before proposing a card, run:

```powershell
npm run validate:data
npm test
```

Use `ai_audited` only after a separate AI-assisted audit checks value, excerpt, source, scope, and projection alignment. Do not claim `human_reviewed` until a person independently performs the relevant checks. Do not claim `organizer_confirmed` unless the organizer supplied or confirmed the information; that state is still not independent verification.
