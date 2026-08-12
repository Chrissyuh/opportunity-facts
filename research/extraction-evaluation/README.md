# Out-of-sample extraction evaluation artifacts

This directory is reserved for the preregistered seven-opportunity evaluation of the frozen production extractor tagged `evaluation-v2-frozen`.

- `manifest.json` is the machine-readable preregistration identity and locked run order.
- `first-pass/` will contain exactly one primary production URL-path artifact per opportunity.
- `reports/` will contain frozen human semantic scoring ledgers.

No artifact may contain API keys, authorization headers, account-only content, or ground-truth hints supplied to the model. Primary first-pass artifacts are immutable and cannot be replaced by reruns.

