# Opportunity Facts data

Repository cards are plain JSON validated by `lib/opportunity/schema.ts`.

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

The generator writes to `data/drafts/`. After completing the review checklist, setting a truthful reviewed state and timestamp, and recording at least one checked page, move the file to `data/opportunities/`. The exporter rejects drafts in the public directory.

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

Do not claim `human_reviewed` until a reviewer has checked value, excerpt, and source alignment. Do not claim `organizer_confirmed` unless the organizer supplied or confirmed the information; that state is still not independent verification.
