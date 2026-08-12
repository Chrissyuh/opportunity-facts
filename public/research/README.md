# Opportunity Facts research kit

## Current evidence status

**Comprehension study not yet published.** This directory contains protocols and empty study templates, not participant results, organizer responses, or evidence that Opportunity Facts improves decisions. The repository separately preserves a three-card live-provider development benchmark and a preregistered seven-card out-of-sample extraction evaluation. Neither is a comprehension result or a population-level accuracy claim.

The kit supports two different evaluations:

1. A comprehension study asks whether people can answer disclosure questions accurately when using an Opportunity Facts card versus a controlled source-page packet.
2. An extraction benchmark measures whether the analysis pipeline retrieves, extracts, and preserves source-supported facts.

Those questions must remain separate. A strong extraction score would not prove that an opportunity is legitimate or worthwhile. A comprehension result would not prove that extracted claims are true. Opportunity Facts reports what sources disclose.

## Files

| File | Purpose |
| --- | --- |
| [`comprehension-study-protocol.md`](./comprehension-study-protocol.md) | Counterbalanced study procedure, scoring, and analysis plan |
| [`results-template.csv`](./results-template.csv) | Empty, row-per-question comprehension-results template |
| [`extraction-benchmark-protocol.md`](./extraction-benchmark-protocol.md) | Frozen-corpus annotation and evaluation procedure |
| [`benchmark-template.json`](./benchmark-template.json) | Empty benchmark manifest/result template with null metrics |
| [`disclosure-audit-guide.md`](./disclosure-audit-guide.md) | Human source-review and card-audit instructions |
| [`consent-and-privacy-notes.md`](./consent-and-privacy-notes.md) | Consent, minor-participant, retention, and publication safeguards |

## Evidence rules

- Never fill a result with an estimate and present it as observed.
- Keep pilot, development, and held-out test results labeled and separate.
- Record the product version, schema version, corpus version, protocol version, projection rules/hash, and evaluation code version for every run.
- Freeze questions, answer keys, exclusions, primary outcomes, and decision thresholds before collecting confirmatory data.
- Publish denominators, missing observations, protocol deviations, and uncertainty intervals alongside aggregate results.
- Report negative and inconclusive findings. Do not select only favorable questions, fields, fixtures, or participants.
- Do not call organizer-stated facts independently verified. The benchmark evaluates fidelity to reviewed sources, not real-world truth.
- Do not turn disclosure completeness or any research outcome into a legitimacy, prestige, admissions-impact, scam, or value score.

## Recommended workflow

1. **Freeze the evaluated artifact.** Record a Git commit or release identifier, schema version, browser/device matrix, and screenshots of each tested condition.
2. **Define the claim.** Select either comprehension or extraction. Write the primary outcome and planned analysis before viewing final results.
3. **Prepare fixtures.** Use clearly fictional `.example` opportunities for initial studies, or obtain permission and review the legal/privacy implications of retained public-page material. Do not include student records or application data.
4. **Create the answer key.** Two reviewers independently audit each source packet, including V2 atomic claims, scope/reference bindings, collection states, and expected 59-fact projections. Resolve disagreements before the fixture enters a confirmatory study or held-out benchmark.
5. **Pilot the procedure.** Use pilot data only to repair unclear instructions, timing, instrumentation, or scoring. Mark pilot rows and do not merge them into a confirmatory result unless that decision was made in advance.
6. **Obtain required approval and consent.** Follow [`consent-and-privacy-notes.md`](./consent-and-privacy-notes.md), especially before involving anyone under 18.
7. **Run the locked protocol.** Preserve assignment, exclusions, failed runs, and deviations. Do not tune the product, prompt, answer key, or thresholds against the held-out evaluation set.
8. **Validate the export.** Check uniqueness, allowed codes, timing units, missing-value conventions, and that no direct identifiers or accidental free text are present.
9. **Analyze and publish.** Report the protocol, exact sample or corpus, raw counts, uncertainty, limitations, and all preregistered outcomes. Keep unpublished results out of public product copy.

## Suggested artifact layout

Research data should not be committed to the public application repository by default. In an access-controlled research workspace, use a layout such as:

```text
study-YYYY-MM-DD/
  protocol-frozen.md
  artifact-manifest.json
  answer-key/
  raw-restricted/
  derived-deidentified/
  analysis/
  publication/
```

`raw-restricted/` may contain sensitive operational data and should have the shortest retention period. `derived-deidentified/` should contain only fields needed for the declared analysis. The public repository should receive only reviewed aggregate results and a methods note.

## Publication gate

Before changing the public methodology page from **Study not yet published**, confirm all of the following:

- the protocol and analysis plan were frozen before the confirmatory run;
- participant permission and any required ethics or institutional review are documented outside the analytic dataset;
- the evaluated version and fixtures are identifiable;
- results were independently recomputed from the deidentified export;
- no direct identifiers, small identifying subgroups, source-page copyrighted bundles, or unredacted free text are published;
- counts, denominators, confidence intervals, exclusions, deviations, and limitations are present;
- claims stay within the measured outcome and do not imply legitimacy, real-world truth, or admissions impact.
