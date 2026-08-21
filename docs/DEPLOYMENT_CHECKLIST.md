# Deployment safety checklist

Opportunity Facts' analysis endpoint is intentionally unauthenticated. The
application bounds each request and each Node.js process. Production also uses
one atomic Upstash-backed admission lease for anonymous rate limiting, weighted
global provider concurrency, and a hard spend reservation. Do not enable
model-backed analysis until that shared control reports ready.

## Required before enabling analysis

- Keep `ANALYSIS_ENABLED=false` while the deployment is being configured.
- Provision Upstash Redis and set `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN`. Set `ANALYSIS_SHARED_CONTROLS_REQUIRED=true` so a
  store/configuration outage fails closed before provider work.
- Set a random server-only `ANALYSIS_RATE_LIMIT_SECRET` of at least 32
  characters. The service stores only an HMAC of the coarse request address.
- Configure `ANALYSIS_RATE_LIMIT_WINDOW_SECONDS`,
  `ANALYSIS_RATE_LIMIT_MAX_REQUESTS`, and
  `ANALYSIS_EXTENDED_RATE_LIMIT_MAX_REQUESTS`. Normal and Extended limits are
  independent and apply across every function instance.
- Configure `ANALYSIS_GLOBAL_MAX_CONCURRENCY` and
  `ANALYSIS_GLOBAL_LEASE_SECONDS`. Normal analysis consumes one provider slot;
  Extended Research consumes two because its two bounded families run in
  parallel. `ANALYSIS_MAX_CONCURRENCY` remains a local backstop.
- Set positive `ANALYSIS_DAILY_BUDGET_USD`, `ANALYSIS_TOTAL_BUDGET_USD`,
  `ANALYSIS_NORMAL_RESERVE_USD`, and `ANALYSIS_EXTENDED_RESERVE_USD`. Admission
  atomically reserves the conservative per-operation maximum before provider
  work. Changing `ANALYSIS_BUDGET_EPOCH` starts a deliberately new total-budget
  ledger; do that only as an explicit operator reset.
- Optionally set the three `ANALYSIS_*_USD_PER_MILLION` pricing variables to
  reconcile known token usage. If pricing or usage is unavailable, the full
  reservation remains charged. This deliberately fails toward spend safety.
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
- Confirm a normal result creates an opaque Extended Research session in the
  shared store, survives a different function instance, expires after 30
  minutes, and leaves the normal result intact when Redis becomes unavailable.
- Verify operational logs contain only coarse error codes/timings and have a
  documented retention period.
- Record an incident owner and rehearse disabling analysis, revoking the key,
  rolling back the deployment, and correcting a published card.

The repository implements these controls through the same Upstash REST store as
stable quality-failure caching. A successful local release gate still does not
prove the production store, environment values, or cross-instance behavior;
verify the deployed configuration before changing `ANALYSIS_ENABLED` to true.

## Logging and privacy boundary

The application emits no request-body, prompt, fetched-text, evidence-excerpt,
authorization-header, or raw-address logs. The browser sends failure-suppression
checks as bounded JSON rather than placing the submitted opportunity URL in an API
query string. Hosting access/runtime logs therefore need only retain route, status,
duration, and platform metadata. Confirm the production project's current log
retention and drain settings separately; platform defaults are not a repository
guarantee.
