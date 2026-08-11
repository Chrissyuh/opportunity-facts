# Schema and data guide

Opportunity Facts uses one strict card schema and one typed field registry. They are the authority for repository JSON, rendering, comparison, disclosure counts, builder import/export, analysis output, and tests. A UI component must not invent its own field list or looser data shape.

## Authoritative files

| Concern | Authority |
| --- | --- |
| Enumerations and field definitions | `lib/opportunity/fields.ts` |
| Formatted/comparable field registry and disclosure count | `lib/opportunity/registry.ts` |
| Zod card/fact/source schemas | `lib/opportunity/schema.ts` |
| Opportunity helpers and public TypeScript imports | `lib/opportunity/index.ts` |
| Fictional cards | `data/demo/*.json` |
| Work-in-progress cards (never public) | `data/drafts/*.json` |
| Future public reviewed cards | `data/opportunities/*.json` |
| Machine-readable schema | `public/schema/opportunity-card.schema.json` |
| Downloadable public dataset | `public/data/opportunities.json` |
| Public schema/dataset exporter | `scripts/export-public-data.ts` / `npm run export:data` |
| Data validator | `scripts/validate-data.ts` / `npm run validate:data` |
| Draft generator | `scripts/create-card.ts` / `npm run create:card -- <slug>` |

The exported JSON schema and dataset are build artifacts/consumer interfaces. Change the TypeScript/Zod authority first, then regenerate and validate the public artifacts. Do not hand-edit two competing schemas.

The public JSON Schema is useful for structural interoperability, but it cannot encode every Zod `superRefine` relationship (for example, evidence/source metadata alignment and conflict metadata parity). Passing the JSON Schema alone is insufficient; repository and application imports must pass `opportunityCardSchema`.

## Versions

- `schemaVersion` is currently `1.0.0`. It identifies the interpretation and allowed structure of a card.
- `cardVersion` starts at `1`. Importing an existing reviewed/demo card into the builder opens the next draft revision; substantive source/fact changes or a new attestation from a non-draft card also advance it. Completing review of the current draft preserves that draft's version.

Schema version and card version answer different questions. A card can move from version 2 to 3 without changing schema version. A breaking schema change requires a new schema version and an explicit migration/compatibility decision for every stored card and local import.

## Top-level card

The strict top-level shape is conceptually:

```ts
interface OpportunityCard {
  schemaVersion: "1.0.0";
  cardVersion: number;              // positive integer
  slug: string;                     // lowercase kebab-case
  summary: string;                  // short neutral summary
  reviewState: ReviewState;
  reviewedAt: string | null;        // RFC 3339 with offset
  sourcePagesChecked: SourcePage[];
  conflicts: CardConflict[];
  facts: Record<FieldId, Fact>;      // all 59 current registry fields, exactly once
}
```

Zod objects are strict: all 59 current fact keys are required after parsing, and unknown top-level or nested keys are rejected rather than silently treated as supported product fields. Helper factories fill an explicit `not_found` record for each field instead of omitting it.

`sourcePagesChecked` is the finite review inventory. `not_found` means the reviewer or analysis did not locate a value in that inventory; it does not claim that no disclosure exists anywhere.

## Sources and evidence

A checked page contains:

```ts
interface SourcePage {
  id: string;          // lowercase kebab-case, unique within the card
  url: string;         // bounded public HTTP(S), no credentials/sensitive query or fragment
  title: string;
  pageType: PageType;
  accessedAt: string;  // RFC 3339 timestamp with offset
}
```

A fact's evidence source repeats those fields and adds an `excerpt`. The repeated metadata must exactly match the corresponding `sourcePagesChecked` entry. Each canonical URL appears once in the inventory under one stable ID, which facts reuse. This prevents duplicate page identities or a source ID quietly changing URL, title, provenance, or access time between facts.

Allowed provenance values are:

- `official_program_page`
- `official_faq`
- `official_cost_page`
- `official_financial_aid_page`
- `official_rules`
- `official_terms`
- `official_privacy_policy`
- `public_record`
- `user_supplied`

Automated URL and pasted-text analysis always records `user_supplied`. A path such as `/faq` or `/privacy` is useful for topical discovery but does not establish official provenance. The `official_*` categories are reserved for cards where a human or organizer has actually classified the source; the review state still describes process, not truth.

The stored-link schema confirms HTTP(S) syntax, a 2,048-character maximum, empty username/password, no token/key/signature/session-like names in query strings or parameter-like fragments, and rejection of literal non-public/service addresses plus obvious single-label, local, and metadata hostnames/suffixes. This browser-safe screening does not DNS-resolve a hostname and therefore does not prove that an arbitrary name is public. Server analysis separately applies DNS/address, redirect, timeout, byte, and content-type controls described in [`THREAT_MODEL.md`](./THREAT_MODEL.md).

Every displayed factual value requires evidence. Automated candidates have an additional non-schema gate: the excerpt must match normalized text from the cited fetched/pasted record before the value can be shown as source-supported.

## Fact shape and invariants

Each registered field uses the same structure:

```ts
interface Fact {
  status: EvidenceStatus;
  value: string | number | boolean | string[] | null;
  displayValue: string | null;
  normalizedValue: NormalizedValue | null;
  sources: EvidenceSource[];
  note: string | null;
  confidence: number | null;         // 0 through 1
  claimKind: ClaimKind | null;
  conflictingValues: ConflictingValue[];
  calculation: Calculation | null;
}
```

`confidence` is optional extraction metadata. It is not truth probability, a reviewer score, a legitimacy signal, or a substitute for evidence.

### Status behavior

| Status | Required behavior |
| --- | --- |
| `disclosed` | Requires `value`, `displayValue`, at least one evidence source, and a claim kind. |
| `not_found` | Has no value, display value, normalized value, or fact-level evidence. Pages checked remain visible at card level. |
| `unclear` | Cannot present an unresolved value/display value; may cite the ambiguous source and explain it in `note`. |
| `conflicting` | Requires at least two distinct supported candidates; cannot select a top-level value. |
| `not_applicable` | Has no value/evidence and requires an affirmative domain reason in `note`, not mere absence. |

Each field definition also declares its allowed statuses. A card is invalid if a fact uses a status the registry does not allow.

### Claim kinds

- `source_stated`: the cited source directly states the fact.
- `organizer_stated`: an organizer's own claim is being preserved explicitly.
- `calculated`: the application/reviewer calculated a value from cited inputs.

A calculated fact must include a short formula, named finite-number inputs, and an explanation. Calculation metadata is rejected on any other claim kind. Original source facts and evidence remain available; a calculation never becomes source-stated through formatting.

### Conflicts

Each conflicting candidate carries its own original value, display value, optional normalized value, evidence, and note. Candidates must be distinct. The top-level fact value and normalized value remain `null`, and card-level `conflicts` contains exactly one summary for that field.

This shape intentionally prevents “first value wins” behavior:

```json
{
  "status": "conflicting",
  "value": null,
  "displayValue": null,
  "normalizedValue": null,
  "sources": [],
  "note": "Two reviewed pages give different current deadlines.",
  "confidence": null,
  "claimKind": null,
  "conflictingValues": [
    {
      "value": "March 1",
      "displayValue": "March 1",
      "normalizedValue": null,
      "sources": [{ "id": "dates", "url": "https://northstar-workshop.example/dates", "title": "Dates", "pageType": "official_program_page", "accessedAt": "2026-08-10T12:00:00Z", "excerpt": "Applications close March 1." }],
      "note": null
    },
    {
      "value": "March 8",
      "displayValue": "March 8",
      "normalizedValue": null,
      "sources": [{ "id": "faq", "url": "https://northstar-workshop.example/faq", "title": "FAQ", "pageType": "official_faq", "accessedAt": "2026-08-10T12:00:00Z", "excerpt": "The application deadline is March 8." }],
      "note": null
    }
  ],
  "calculation": null
}
```

The example is fictional documentation, not a repository card or observed conflict.

## Normalized values

The original `value` and user-facing `displayValue` are never overwritten by normalization. `normalizedValue` is a tagged union used for consistent filtering, comparison, formatting, and calculations:

| Kind | Key semantics |
| --- | --- |
| `text` | One canonical text value |
| `text_list` | One or more canonical text entries |
| `date` | ISO calendar date without invented time/timezone |
| `money` | Nonnegative amount, ISO-style three-letter currency, and `fee`, `deposit`, `cash`, `in_kind`, or `tuition_waiver` classification |
| `number` | Nonnegative value and optional unit |
| `boolean` | Explicit true/false only; missing disclosure is not false |
| `percentage` | Value from 0 through 100 |
| `duration` | Nonnegative amount in hours, days, weeks, or months |
| `hours` | Minimum, optional maximum, and total/day/week period |
| `relationship` | One allowed institution-relationship category |
| `participation_format` | Online, commuter, residential, hybrid, or in-person category |

The schema checks that a field's normalized kind matches its registry value type. It does not accept a money object for a date field or generic text where a relationship category is required.

## Field registry

Every definition includes:

- stable field ID;
- section and user-facing label;
- concise neutral description;
- whether it is one of the 13 core disclosure dimensions;
- value type and comparison behavior;
- allowed evidence statuses.

The seven sections are `identity`, `eligibility`, `commitment`, `money`, `selection`, `outcomes`, and `terms`.

### Exactly 13 core dimensions

The registry enforces exactly these 13 core IDs:

1. `operating_organization`
2. `institution_relationship`
3. `grade_levels`
4. `application_deadline`
5. `duration`
6. `participation_format`
7. `estimated_total_mandatory_cost`
8. `financial_aid`
9. `refund_policy`
10. `selection_process`
11. `selection_evidence`
12. `other_benefits`
13. `material_terms`

“X of 13 core facts disclosed” is a completeness count. It is never a quality, legitimacy, safety, prestige, admissions-impact, or value score. A disclosed organizer claim can count as disclosed while still being unverified in the real world.

Adding, deleting, or changing a core flag is a product/schema decision. It requires registry tests, disclosure-count tests, comparison/builder review, documentation and export regeneration, and an explicit versioning decision.

## Review states

| State | Meaning |
| --- | --- |
| `demo` | Obviously fictional card; every cited/official URL must use a reserved `.example` hostname. |
| `draft` | Automated, imported, incomplete, or not fully aligned by a human reviewer. |
| `human_reviewed` | A reviewer checked displayed value/excerpt/source alignment. It is not an independent audit of the claim. |
| `organizer_confirmed` | The organizer confirmed or supplied information. It is not independent verification. |

`human_reviewed` and `organizer_confirmed` require `reviewedAt`. A valid JSON file does not automatically qualify for either state.

## Adding a card

### 1. Create a minimal draft

```powershell
npm run create:card -- fictional-opportunity-slug
```

Use a neutral lowercase slug. The generator should refuse to overwrite an existing card. Keep a new card `draft` until the review gate is genuinely complete.
The generator writes it to `data/drafts/`; that directory is excluded from every public artifact.

### 2. Inventory sources

Follow [`research/disclosure-audit-guide.md`](../research/disclosure-audit-guide.md). Add each checked page once to `sourcePagesChecked`, then reuse its stable metadata in fact evidence. Do not include account-only links, credentials, signed URLs, applications, or unnecessary personal data.

For demo cards, use only obviously fictional names and reserved `.example` URLs and retain `reviewState: "demo"`.

### 3. Populate every fact

Use the registry rather than deleting fields that were not found. Preserve original wording, normalized representation, exact evidence, uncertainty, conflicts, and calculation inputs. Automated analysis does not calculate acceptance rates: a human must first confirm that applicant and acceptance counts cover the same population and cycle. A calculated mandatory-cost total requires every cost category to be assessed and compatible. Never infer institution operation, refundability, acceptance rates, cash value, or legal status from weak signals.

### 4. Validate and audit

```powershell
npm run export:data
npm run validate:data
```

Complete [`REVIEW_CHECKLIST.md`](./REVIEW_CHECKLIST.md), set a truthful reviewed state and `reviewedAt`, and move the file from `data/drafts/` to `data/opportunities/`. `export:data` deterministically rebuilds the public dataset and machine-readable JSON Schema only from demo and reviewed public JSON. `validate:data` confirms states, filenames, slug uniqueness across drafts/public cards, demo constraints, deterministic timestamps, and byte-for-byte artifact parity. Structural validation does not prove source alignment; a human must check every displayed value and excerpt before selecting `human_reviewed`.

### 5. Run release checks

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Record actual results. Do not weaken a schema or test to admit one convenient card.

## Public exports and imports

The downloadable dataset contains repository public cards only. It must not silently include browser drafts, comparison selections, pasted pages, failed analysis output, or model prompts. Demo and reviewed records remain distinguishable by `reviewState`.

Browser import follows the same strict card schema. Imported drafts stay local unless the user explicitly downloads/submits them. Schema compatibility errors should identify the problem without partially accepting unknown fields.

When a public export is regenerated, verify:

- every source card passes the current Zod schema;
- record order is deterministic;
- no secret, private URL, student information, or local draft appears;
- card/demo labels and versions are preserved;
- the exported schema and dataset paths are covered by tests/build;
- the correction/version history remains in Git rather than being rewritten.

Use the supported sequence rather than manually editing generated files:

```powershell
npm run export:data
npm run validate:data
```

## Changing the model safely

For a new field or value type:

1. change the typed field registry and central schema;
2. decide whether the schema change is backward compatible;
3. update normalization, formatting, comparison, builder, import/export, extraction, and evidence behavior through shared domain helpers;
4. migrate every demo/reviewed card explicitly;
5. regenerate the machine-readable schema/dataset with `npm run export:data`;
6. update unit, data, integration, and browser tests;
7. update this guide, methodology, and review checklist;
8. run the full release gate.

Do not add an unregistered JSON property that only one component understands. That creates a second information model and breaks reviewability.
