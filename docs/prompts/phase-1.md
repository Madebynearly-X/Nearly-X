# PHASE 1: FOUNDATION

You are working in Copilot Agent mode. Follow `.github/copilot-instructions.md` at all times. Use `docs/SPEC.md` as the reference specification (sections 1-5, 10, 15-19 matter most for this phase).

**Goal:** a working, secure foundation that lets the owner generate on-brand platform-specific drafts, approve them, and export them for manual posting, with the safety controls and scheduling framework in place for later phases.

**Out of scope for Phase 1:** real social-platform API connections, trend research, image/video generation, community inbox, competitor tracking, experiments, CRM, paid ads. Do not start these.

---

## Step 0: Gate (do this first, then continue automatically)

1. Confirm `docs/SPEC.md` is **not** the placeholder. If it is, stop and tell the owner.
2. Inspect the entire repository. Write `docs/REPO-FINDINGS.md` covering:
   - framework, language, package manager, build and deploy setup
   - existing Cloudflare configuration (Pages settings, `wrangler` files, Functions)
   - how the site's contact or enquiry path actually works (real CTAs, forms, email, WhatsApp, etc.)
   - brand assets actually present: colours, fonts, logo files, tone of the copy (extract from the real CSS and content)
   - existing analytics, auth, or database usage
   - anything that conflicts with `.github/copilot-instructions.md`
3. Write `docs/PLAN-PHASE-1.md` with milestones, dependencies, and acceptance criteria. Then proceed to Step 1 without waiting.

If the findings contradict a fixed architecture decision, stop and report.

## Step 1: Scaffold `/agent`

- Separate Worker with `wrangler.jsonc`: D1 binding `DB`, R2 binding `MEDIA`, static assets for the dashboard, a Cron Trigger every 15 minutes, `compatibility_date` set to today's date.
- TypeScript strict, Hono, zod, Vitest (use the Workers test pool). Pin dependency versions. Add scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `deploy`, `db:migrate:local`, `db:migrate:remote`.
- `.dev.vars.example` with placeholders only. Add `.dev.vars`, `.env*`, `.wrangler/` to `.gitignore`.

## Step 2: Database (D1 migrations in `agent/migrations`)

Tables with constraints and indexes: `brand_profiles` (versioned), `settings`, `content_items`, `approvals`, `jobs`, `agent_runs`, `activity_log`, `provider_usage`.

- `settings` holds operating mode (default `SUPERVISED`), global pause flag, per-platform and per-category approval overrides, daily and monthly spend caps.
- `content_items` carries every field listed in SPEC section 8 (hook, message, caption/script, CTA, platform, format, objective, pillar, source references, planned time, approval status, measurement plan) plus an idempotency/dedupe key with a unique constraint.

## Step 3: Authentication (fail closed)

- Middleware verifies the Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`) against the team's JWKS, checking audience and expiry. Config comes from `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`.
- Missing or invalid token returns 401. Missing config in production returns 503 with a setup message, never "allow all".
- A local-dev bypass is allowed only when `ENVIRONMENT=development` **and** `ALLOW_DEV_AUTH_BYPASS=true`. Test that it cannot activate in production.

## Step 4: Brand profile

- Seed from the real site (Step 0 findings). Any unknown field is `null` and flagged "needs owner input". Do not invent values.
- Dashboard form to view and edit; every save creates a new version. Persisted in D1.

## Step 5: Safety controls

- Emergency pause: one API, one prominent dashboard control, stored in D1, checked by the job runner and the publishing service.
- Operating modes A/B/C from SPEC section 10, enforced in one `PublishPolicy` service with unit tests. Only the authenticated owner can change mode or pause state; agents cannot.

## Step 6: Orchestrator framework

- Job runner invoked from `scheduled()`: lease/lock to prevent double execution, retry with exponential backoff, idempotency keys, run history in `agent_runs`.
- `Agent` interface (`name`, `run(ctx)`). Implement one `heartbeat` job proving cron works end to end and writing to `activity_log`.

## Step 7: LLM provider layer

- `LLMProvider` interface, `MockProvider`, and one real provider selected by env var. Timeouts, retry with backoff, structured JSON output validated with zod.
- Every call writes to `provider_usage`. Before each call, check the daily and monthly caps and refuse with a clear error when exceeded.
- Missing API key produces a setup message, not a crash.

## Step 8: Draft generation and approval workflow

- Endpoint: given a brief, content pillar, and target platforms (Instagram, Facebook, LinkedIn, TikTok), generate **platform-specific** drafts. Do not duplicate one caption across platforms.
- Rule-based quality control before a draft can enter review, flagging: guarantees, "free audit", discounts or prices not authorised in settings, invented testimonials or results, missing CTA, platform length limits, missing destination URL, repetitive openings versus recent drafts.
- State machine enforced server-side: `draft → pending_approval → approved → scheduled → exported/published`, plus `rejected` and `cancelled`. Invalid transitions are rejected and logged.
- `ManualExportAdapter`: produces a copy-ready package (caption, alt text, UTM link, asset brief). Items become `published` only when the owner confirms and supplies the live post URL. Never mark a post published automatically in this phase.
- UTM builder utility for tagged links (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) with tests.

## Step 9: Dashboard shell (responsive, desktop and mobile)

Pages: Overview, Content Studio, Calendar (list view is fine), Integrations, Settings (brand, mode, caps), Activity Log. Premium, understated styling consistent with the extracted brand.

- Integrations page reads from a **capability registry** (`agent/src/integrations/registry.ts`) for Instagram, Facebook, LinkedIn, TikTok, YouTube, Pinterest, X, Threads. Everything shows "Not connected". Populate API facts only from official documentation and record the URL and date in `docs/CAPABILITIES.md`; mark the rest `unverified`.
- No fabricated metrics anywhere. Empty states say what is missing and how to fix it.

## Step 10: Tests

Cover at minimum: auth fail-closed, approval gate blocks unapproved publishing, pause blocks jobs and publishing, invalid state transitions rejected, duplicate content prevented by the unique key, job leases prevent double runs, spend cap blocks LLM calls, missing credentials give setup messages, UTM builder, QC rules, and a build-output check proving no secret names or values appear in the dashboard bundle.

## Step 11: Documentation

`agent/README.md`, `docs/SETUP.md` (exact commands for local run, D1/R2 creation, secrets, deploy, Cloudflare Access), `docs/CAPABILITIES.md`, and an updated `docs/STATUS.md`.

---

## Acceptance criteria (prove each with command output)

1. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass in `/agent`.
2. `wrangler dev` starts; `/api/health` responds; the dashboard loads.
3. Brand profile edits persist across a restart and create versions.
4. Draft generation with `MockProvider` produces distinct drafts per platform; with no real API key it returns a setup message.
5. Unapproved content cannot be exported or published through any code path.
6. Emergency pause stops the job runner and publishing in tests.
7. Heartbeat job runs via cron locally (`wrangler dev --test-scheduled`) and appears in the activity log.
8. Dashboard bundle contains no secrets.
9. The existing public site's files are unchanged (`git diff --stat` outside `/agent`, `docs`, `.github` is empty).

## Final report format

1. **Verified** (command and result).
2. **Mocked / not live.**
3. **Blocked or needs owner** (credentials, decisions).
4. **Deviations from this prompt and why.**
5. **Next steps.**

Do not claim completion until every acceptance criterion above has been demonstrated.
