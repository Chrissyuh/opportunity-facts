# Deployment safety checklist

Opportunity Facts' analysis endpoint is intentionally unauthenticated. The
application bounds each request and each Node.js process, but a serverless
deployment can create many processes. Do not enable model-backed analysis on a
public deployment until the aggregate controls below are in place.

## Required before enabling analysis

- Keep `ANALYSIS_ENABLED=false` while the deployment is being configured.
- Put `/api/analyze` behind a durable, deployment-level request-rate limit.
  The limit must apply across every function instance, not only within one
  process. Reject excess requests before they reach the model provider.
- Set a durable aggregate concurrency limit for `/api/analyze` that matches the
  provider and hosting budgets. `ANALYSIS_MAX_CONCURRENCY` is only a local,
  best-effort backstop for one Node.js process.
- Isolate the production API key to this project. Configure provider spend
  alerts and a hard budget/circuit breaker where available. If the provider's
  budget is alert-only, enforce the hard stop in the gateway or another durable
  shared control.
- Confirm the configured function supports the route's 300-second envelope;
  do not infer plan-specific duration from repository configuration alone.
- Restrict outbound analysis traffic to public HTTP/HTTPS on default ports and
  the configured model endpoint where the platform supports egress policy.
- Keep production secrets out of untrusted preview builds. Verify that neither
  server logs nor client bundles contain the API key, request bodies, fetched
  page text, source excerpts, prompts, authorization headers, or URL query
  strings.

## Deployment verification

- Run `npm run export:data`, `npm run validate:data`, `npm run lint`,
  `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, and
  `npm audit --audit-level=high` from the exact release revision.
- Verify the actual deployed CSP, HSTS, frame, MIME, referrer, permissions, and
  no-store analysis-response headers.
- Exercise the disabled/no-key path, invalid input, oversized and stalled body,
  concurrency rejection, provider failure, partial-family result, client
  cancellation, and one controlled successful request.
- Confirm aggregate rate and concurrency limits from more than one function
  instance or region, and confirm that the hard spend circuit breaker stops new
  provider work.
- Verify operational logs contain only coarse error codes/timings and have a
  documented retention period.
- Record an incident owner and rehearse disabling analysis, revoking the key,
  rolling back the deployment, and correcting a published card.

The repository does not configure these distributed controls because their
implementation depends on the selected hosting gateway, plan, and provider
account. A successful local release gate does not prove that deployment layer.
