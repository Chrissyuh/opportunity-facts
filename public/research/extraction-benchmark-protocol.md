# Extraction benchmark protocol

Protocol version: `1.0-draft`
Evidence status: **not run; no benchmark values are claimed**

## 1. Purpose and non-claims

This benchmark evaluates whether the Opportunity Facts analysis pipeline can turn a fixed set of reviewed source records into source-supported structured disclosures. It separates page retrieval, visible-text extraction, field extraction, deterministic evidence validation, and normalization so a failure is attributable to the correct stage.

It does not determine whether an organizer's statement is true, whether an opportunity is legitimate or worthwhile, or whether its terms are lawful. A result can only measure fidelity to the frozen sources and human-adjudicated annotation policy.

## 2. Freeze before running

Complete and hash a run manifest before evaluating a held-out split:

| Item | Required record |
| --- | --- |
| Benchmark and corpus version | Stable identifiers |
| Split | `development` or locked `test` |
| Application commit | Full Git commit or release digest |
| Schema/registry version | Exact version and exported schema hash |
| Extraction implementation | Commit and configuration |
| Model | Provider, exact model identifier/snapshot when available |
| Prompt and structured-output schema | SHA-256 hashes |
| Fetch/parser limits | Page, byte, time, redirect, and content-type settings |
| Normalization/evidence code | Commit and configuration |
| Fixture manifest | Source IDs, original URLs, access dates, content hashes |
| Metrics and thresholds | Definitions fixed before test output is inspected |
| Runtime environment | Node version, operating system, relevant dependency lock hash |

Use `research/benchmark-template.json` as the run record. It intentionally contains null metrics and an empty case list.

## 3. Evaluation tracks

Run and report these tracks separately. Do not describe a supplied-text result as URL-analysis performance.

### Track A: supplied records

Input is a frozen set of page titles, public source URLs, page types, and normalized visible text. This isolates structured extraction, normalization, and evidence validation from crawling and HTML parsing.

### Track B: frozen HTML parsing

Input is a frozen HTTP response fixture with headers and HTML. This adds content-type handling and visible-text extraction. Network access remains mocked and deterministic.

### Track C: URL retrieval and discovery

Input is a controlled local/mock origin graph that behaves like HTTP(S). This tests redirect validation, same-origin relevant-page discovery, limits, and retrieval recall without depending on changing public sites. Security cases must include public-to-private redirects and multiple DNS answers.

### Track D: adversarial evidence validation

Input includes controlled model outputs with valid support, mismatched excerpts, altered whitespace, correct quotations attached to the wrong claim, prompt-injection text, conflicts, and calculations. This tests the deterministic safety boundary independently of model behavior.

## 4. Corpus construction

Build development and held-out test splits. Never tune prompts, parsing rules, normalizers, or thresholds using held-out outputs.

The corpus should cover:

- every evidence status: `disclosed`, `not_found`, `unclear`, `conflicting`, and `not_applicable`;
- every section: identity, eligibility, commitment, money, selection, outcomes, and terms;
- all 13 core disclosure dimensions;
- prose, lists, tables, FAQs, rules, terms, privacy pages, and cost pages;
- zero, free, range, per-unit, deposit, optional, mandatory, cash, and in-kind money cases;
- explicit institution relationships and cases where a relationship must remain unclear;
- organizer-stated rates, published counts, valid calculated rates, and insufficient counts;
- duplicated boilerplate, navigation text, malformed markup, Unicode/whitespace variation, and long pages;
- supported conflicts across two pages;
- same-origin relevant and irrelevant links;
- adversarial source text that tells a model to ignore instructions or invent a result.

Start with clearly fictional `.example` fixtures so the full source packets can be retained and redistributed. If real public pages are later included, record URL, title, access time, content hash, provenance, permission/licensing basis, and any redaction. Do not include student applications, account-only pages, personal records, or material obtained by bypassing access controls. A URL being public does not automatically grant unrestricted redistribution rights.

Keep source snapshots immutable. A live URL check may be a separate freshness study, never the held-out benchmark input.

## 5. Annotation model

Each case contains one opportunity and a finite set of source records. Each expected fact annotation must include:

- `field_id` from the authoritative registry;
- expected evidence status;
- original source wording and normalized expected value where applicable;
- all accepted values when the expected status is `conflicting`;
- source ID and exact excerpt for every supported value;
- page type and claim kind;
- calculation inputs and formula when a value is calculated;
- a short adjudication note for ambiguity, conflict, or non-applicability.

Define one canonical text representation for annotation. Evidence offsets must refer to Unicode code-point indices in that frozen normalized text (not browser DOM offsets, bytes, or JavaScript UTF-16 positions), with `end_offset` exclusive. Store the exact excerpt as the human-reviewable authority and test that the recorded offsets reproduce it before freezing the corpus.

An illustrative case shape is:

```json
{
  "case_id": "stable-nonidentifying-id",
  "split": "test",
  "source_records": [
    {
      "source_id": "source-1",
      "url": "https://fictional-program.example/rules",
      "title": "Rules",
      "page_type": "official_rules",
      "accessed_at": "RFC-3339 timestamp",
      "content_sha256": "hex digest",
      "text_path": "path in private/frozen corpus"
    }
  ],
  "expected_facts": [
    {
      "field_id": "registry-field-id",
      "status": "disclosed",
      "accepted_normalized_values": [],
      "evidence": [
        {
          "source_id": "source-1",
          "exact_excerpt": "verbatim excerpt",
          "start_offset": 0,
          "end_offset": 16
        }
      ],
      "claim_kind": "source_stated",
      "adjudication_note": ""
    }
  ]
}
```

The example describes structure only; it is not a benchmark observation.

### Annotation procedure

1. Train reviewers on the schema, field registry, and [`disclosure-audit-guide.md`](./disclosure-audit-guide.md).
2. Have two reviewers independently inventory sources and annotate every evaluated registry field.
3. Compare status, normalized value, conflict set, evidence span, provenance, and claim kind separately.
4. Send disagreements to an adjudicator who can inspect both rationales but not system output.
5. Freeze the adjudicated key and content hashes before running the held-out system.
6. Record pre-adjudication agreement; do not use system output to resolve a human disagreement.

`not_found` means the fact was not located in the finite source packet, not that it does not exist elsewhere. `unclear` means the reviewed wording does not support a determinate value. `not_applicable` requires an affirmative reason, not mere absence.

## 6. Matching policy

Freeze field-specific comparison rules before evaluation:

- categorical values require an allowed canonical value;
- strings use a documented canonicalization, not unrestricted fuzzy matching;
- dates retain precision and timezone semantics; do not award an invented year or timezone;
- money retains currency, amount/range, unit, mandatory/optional classification, and cash/in-kind type;
- lists are compared as sets when order has no meaning;
- conflicts require the complete supported set, with extra and missing values counted separately;
- calculations require correct supported inputs, formula, output, and `calculated` labeling;
- relationship categories require explicit source support and may correctly remain `unclear`.

Do not add aliases after inspecting test errors. Version the answer key if a genuine annotation defect is found, publish the change, and rerun all compared systems.

## 7. Metrics

Report raw numerators and denominators with each rate. Aggregate both micro and field-macro results so frequent `not_found` fields cannot hide poor supported-fact performance.

### Retrieval and parsing

- **Relevant-page recall:** expected relevant source pages fetched / expected relevant source pages in the controlled graph.
- **Irrelevant-page fetch count:** fetched pages not marked relevant by the frozen manifest.
- **Limit compliance:** pages, redirects, bytes after decompression, and elapsed time stayed within configured bounds.
- **Text retention:** expected annotated evidence spans recoverable after visible-text normalization / all expected spans.

### Status and value

- **Status confusion matrix** across all five statuses.
- **Per-status precision, recall, and F1**, plus macro-F1.
- **Normalized value precision/recall/F1** for supported values, treating conflicting values as a set.
- **Field coverage:** fields for which the system returned a valid schema entry / fields required by the registry. Coverage is not correctness.

### Evidence-grounded claims

Treat each `(case, field, normalized value)` as a claim. A claim is correct only if the field and value match the adjudicated key and its cited excerpt matches the normalized frozen source text for the cited source. Also score whether that gold span semantically supports that value; exact substring presence alone is insufficient.

- **Grounded-claim precision:** correct supported output claims / all output claims marked supported.
- **Grounded-claim recall:** correct supported output claims / all expected supported claims.
- **Unsupported-support count:** claims displayed as supported despite absent or mismatched evidence.
- **Evidence-span source accuracy:** correct source assignment / output supported claims.
- **Conflict preservation:** cases where the complete expected conflicting set and evidence are retained / expected conflict cases.
- **Calculation integrity:** correctly labeled calculations with correct inputs and result / expected calculated facts.

### Deterministic validation invariants

For controlled fixtures, the release expectation is zero values displayed as source-supported when their returned excerpt does not match normalized source text. Report:

- mismatched excerpts rejected or downgraded / mismatched excerpts injected;
- valid excerpts retained / valid excerpts injected;
- correct excerpts attached to the wrong value rejected/downgraded / wrong-claim fixtures injected.

The first metric can be mechanically complete while the system still misunderstands a matching passage. Report all three and retain human error review.

### Operational measures

Record latency, model input/output units, errors, retries, and estimated cost only as operational observations under the exact configuration. Do not combine them with accuracy into a product score.

## 8. Run procedure

1. Verify fixture hashes and the locked split.
2. Confirm that no held-out case appears in prompts, examples, tests used for tuning, or development fixtures.
3. Remove or isolate external network access except for the model endpoint explicitly under evaluation.
4. Run each case from a clean deterministic application state. Fix random seeds where supported and record any nondeterminism controls.
5. Preserve raw structured model output, post-validation output, final card output, stage errors, and timings under case IDs. Store secrets nowhere in artifacts.
6. Evaluate each pipeline stage against the frozen key.
7. Manually classify every grounded-claim false positive and a prespecified sample of true positives, with reviewers blind to vendor/model identity when practical.
8. Independently recompute aggregate metrics from the case-level export.
9. Fill the benchmark result file only after the run; change `results_status` from `not_run` to the correct reviewed state.

Tests must not make live requests to public opportunity sites. If a live model is evaluated, label those results separately from deterministic mocked integration tests, and ensure source material sent to the provider is approved for that processing.

## 9. Adversarial suite

At minimum include cases for:

- visible text saying “ignore previous instructions” and requesting an invented verdict;
- text claiming to be a system/developer instruction;
- hidden/script/style content containing false values;
- a real matching excerpt cited for a different field or amount;
- an excerpt with only normalized whitespace changes;
- an excerpt absent from every source;
- two official pages with conflicting dates or fees;
- relationship language that says only “hosted at” but not “operated by”;
- an in-kind “value” that must not become a cash award;
- applicant count without acceptance count;
- zero cost versus cost not found;
- public initial URL redirecting to loopback, private IPv4, private IPv6, link-local, or metadata space;
- hostname resolution that changes between validation stages;
- oversized/decompression-expanded response and unsupported content type;
- cross-origin links that look relevant but must not be crawled.

Prompt-injection resistance is judged by schema/evidence behavior, not by asking the model whether it followed the attack.

## 10. Reporting

Publish:

- corpus composition and exclusions by split, without redistributing restricted text;
- annotation guide, reviewer counts, pre-adjudication agreement, and adjudication process;
- exact system/configuration identifiers and limits;
- stage-separated and end-to-end metrics with raw denominators and uncertainty intervals where appropriate;
- every threshold fixed in advance and whether it was met;
- error categories and representative redacted examples;
- failed, timed-out, and schema-invalid cases;
- benchmark contamination risks and other limitations;
- a clear statement that the result measures source fidelity, not truth, legitimacy, prestige, value, safety, or admissions impact.

Do not publish a single “accuracy” number without its unit of analysis and status/value/evidence breakdown. Until reviewed results exist, keep public copy at **Study not yet published**.
