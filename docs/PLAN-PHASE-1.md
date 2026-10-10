# Phase 1 implementation plan

## Outcome and constraints

Build the marketing agent as an independent Cloudflare Worker in `/agent`, with a private dashboard, D1-backed state, R2 media binding, supervised-by-default controls, and a locally testable mock LLM provider. Do not change the public site's files or enable real social publishing.

## Milestones and dependencies

1. **Repository gate and setup** — master spec is present; document findings and plan; install the pack's repository instructions and Phase 1 prompt. Depends on the supplied master spec and existing Pages inspection.
2. **Worker scaffold** — strict TypeScript, Hono, Zod, Wrangler, dashboard assets, cron trigger, environment templates, and scripts. Uses the existing Cloudflare Pages site only as a deployment precedent; the Worker remains separate.
3. **D1 schema and core services** — migrations, settings, versioned brand profile, content/approval records, jobs, run history, activity, and provider usage.
4. **Security and safety** — Cloudflare Access JWT validation with fail-closed production behavior; guarded local-only bypass; pause and publish-policy checks.
5. **Orchestration and providers** — leased/idempotent jobs, retry behavior, heartbeat, mock and real LLM provider interfaces, spend limits, and clear missing-credential behavior.
6. **Content workflow** — distinct platform drafts, rule-based quality checks, server-side state transitions, approvals, UTM building, and manual export with owner-confirmed publication records.
7. **Dashboard and capability registry** — responsive overview, studio, calendar, integrations, settings, activity log, brand editing, and no fabricated analytics or connection state.
8. **Verification and operating docs** — targeted test suite, typecheck, lint, test, build, local Worker smoke test where tooling permits, bundle-secret check, and setup/capabilities/status documentation.

## Acceptance criteria

- In `/agent`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass.
- Local Worker health endpoint and dashboard load; cron heartbeat is verifiable locally.
- Brand profile saves are versioned and persisted; MockProvider produces platform-specific drafts; missing real-provider credentials return setup guidance.
- Unapproved content and a global pause prevent export/publication and job execution; invalid transitions and duplicate keys are rejected.
- Authentication fails closed, production cannot use the local bypass, and configured spend limits block LLM requests.
- Capability and dashboard states do not claim social integrations or analytics are live; no secrets appear in the dashboard bundle.
- No public-site files are changed. Cloudflare deployment, Access, D1/R2 provisioning, and real credentials are owner-side setup and are not performed as part of local implementation.

## Risks and open prerequisites

- Cloudflare account resources (`database_id`, R2 bucket, Access team domain/audience) are not available in the repository and must not be guessed.
- No Node/npm executable was detected during initial inspection; recheck before validation. If unavailable, code can be prepared but JavaScript test/build acceptance cannot be honestly marked verified.
- API credentials and live social accounts are intentionally not required for Phase 1; real provider calls must fail with explicit setup guidance until credentials are configured.
