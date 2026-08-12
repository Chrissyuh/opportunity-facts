# Out-of-sample extraction failures

This backlog was written only after all seven preregistered first-pass outputs and scores were frozen. It does not change or replace the reported evaluation. No production extraction tuning was made in this phase.

## Ranked future repairs

| Priority | Failure class | Frequency/evidence | Deployment importance | Safest generalizable repair | Effort |
| --- | --- | --- | --- | --- | --- |
| P0 evaluation integrity | Frozen human cards missed supported official claims | Most visible in Yale; ground-match precision and semantic evidence diverged materially | Required before claiming independent model precision from a future set | Two-reviewer blind ground-truth workflow, adjudication before inference, machine check that every reviewed source category received a completed disposition | High |
| P1 data integrity | Generic platform/legal terms promoted to program eligibility or adult requirements | Three critical Polygence claims | Blocks unattended use | Bind requirements to the described subject and program context; reject terms/privacy sentences whose subject is platform access, legal service, or account use unless the program claim is explicit | Medium |
| P1 data integrity | Historical counts attached to the target cycle | One critical QuestBridge claim | Blocks unattended use | Require explicit cycle/year alignment for every count/rate claim; otherwise preserve as historical context or `unclear` | Medium |
| P1 reliability | Provider returned invalid truncated JSON | 1/7 runs after successful acquisition | A normal user receives no draft and the evaluation spent an inference call | Investigate provider output-length/strict-schema behavior; improve structured-response completion detection and useful sanitized failure copy without automatic retries | Medium |
| P1 recall | Structured cycle remained unassessed | 7/7 runs | Breaks cycle-aware comparison and increases flat-field ambiguity | Require a conservative cycle candidate when explicit target-cycle language is present; keep absent/ambiguous components unassessed rather than inferring from slug | Medium |
| P1 recall | Sparse or absent V2 structured records | 16/82 recall; BJC and QuestBridge emitted none | Negates major V2 comparison benefits | Reduce schema/output competition, extract bounded families in a deterministic staged contract if cost permits, and preserve family-level omissions explicitly | High |
| P1 acquisition | Nearby official program pages outranked target-program pages | Three irrelevant QuestBridge College Prep Scholars pages; target ranking/aid/terms pages missed | Material omissions despite a healthy site | Add entity/title/path consistency to same-origin ranking and penalize sibling program brands without hard-coded names | Medium |
| P1 scope | Correct excerpt attached to wrong product field/object | CAC district→location and SMS→cancellation/material terms; other smaller object errors | Can make supported text misleading | Expand deterministic subject/scope checks beyond money/date/count: participant vs organizer, optional service vs opportunity, teacher/school vs entrant, stage vs whole program | High |
| P2 completeness | Supported claims absent from frozen summary ground truth | Several out-of-sample cases | Evaluation concern more than a production defect | Record adjudicated supplemental claims separately in a future study without replacing primary frozen metrics | Medium |
| P2 efficiency | Large token use with low structured recall | 421,967 reported total tokens across seven runs | Cost and latency concern | Measure page-family utility, prune navigation/legal boilerplate, and evaluate staged family extraction only on a new development set | High |

## Error taxonomy

### Source acquisition

- **Relevant page not discovered:** concentrated in QuestBridge ranking, scholarship, and terms sources.
- **Relevant page misranked:** sibling College Prep Scholars pages consumed three of the six irrelevant-page slots.
- **Fetch blocked / parser failure:** none in the seven primary runs.
- **JavaScript/PDF limitation:** no primary run failed for this reason, though unacquired reviewed material may still include content ranking did not surface.

### Model extraction

- **Missed explicit statement:** common; aggregate supported-summary recall was 56.2%.
- **Wrong scope/subject:** generic platform terms became participant/program requirements; district eligibility became location.
- **Wrong cycle:** a historical QuestBridge count was treated as current-cycle evidence.
- **Conflated legal/product concepts:** optional SMS rules became challenge cancellation/material terms.
- **Missing rich structure:** cycle was absent in every run and entity recall was 19.5%.
- **Invalid structured output:** the Coca-Cola response ended as unterminated JSON.

### Deterministic post-processing

- Existing exact-excerpt and typed semantic guards caught numerous candidate claims, recorded as validation warnings in the immutable artifacts.
- The guards did not yet detect subject/scope errors where every word was present but referred to a platform service, organizer right, teacher, school, historical cohort, or different field.
- Projection remained conservative on many missing families, but could not recover structure the model never emitted.

### Genuine schema/product limitation

No new P0/P1 Schema V2 representational defect was demonstrated. The schema can represent the seven reviewed opportunities. The primary product limitation is workflow: one human reviewer can freeze an incomplete ground-truth card without blind adjudication, and a failed provider response currently produces no partial candidate salvage.

## Deployment disposition

Do not auto-publish automated drafts. Keep human review, evidence inspection, and promotion gates mandatory. Before a future model-quality claim, use a new preregistered set with double-reviewed ground truth. Before considering unattended extraction, repair the four critical subject/cycle errors on a separate development fixture set and demonstrate that the repair does not weaken conservative omission.
