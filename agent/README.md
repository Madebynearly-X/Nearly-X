# NEARLY Studio Marketing Agent

Independent Cloudflare Worker for the supervised marketing workflow. The existing Pages website is not part of this Worker and its files are not changed by the agent.

## Local development

Requires Node.js/npm and a Cloudflare account only for remote deployment. Local generation uses `MockProvider`; it does not call a paid API or publish posts.

```powershell
cd agent
npm ci
npm run db:migrate:local
npm run dev
```

Open the Wrangler local URL. `/api/health` reports only basic process health. Local dashboard API writes are permitted only because the ignored `.dev.vars` sets `ENVIRONMENT=development` and the explicit `ALLOW_DEV_AUTH_BYPASS=true` switch. Never set this bypass in production.

To recreate the ignored local file after cloning, copy `.dev.vars.example` to `.dev.vars`, keep the development environment and bypass values, and set `OWNER_EMAIL` to a local placeholder. Do not add real credentials to the example file.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start local Worker and dashboard |
| `npm run build` | Type-check, produce a Wrangler dry-run bundle, and scan dashboard assets for secret names |
| `npm run typecheck` | Strict TypeScript check |
| `npm run types` | Generate Worker and binding types from Wrangler configuration |
| `npm run lint` | Lint TypeScript source and tests |
| `npm run test` | Vitest using the Cloudflare Workers test pool; applies migrations to its isolated D1 database |
| `npm run db:migrate:local` | Apply D1 migrations to the local database |
| `npm run db:migrate:remote` | Apply migrations to the configured remote D1 database |
| `npm run deploy` | Deploy the separate Worker |

## Safety and data

- Cloudflare Access is required for every dashboard and API route except the minimal `/api/health` response. The Worker independently verifies `Cf-Access-Jwt-Assertion` against the configured Access team JWKS, audience, issuer, signature, and expiry.
- Missing Access configuration returns a setup error in production. Invalid or absent tokens fail closed. Only `OWNER_EMAIL` may change settings, pause controls, brand data, approvals, or content.
- Global pause is persisted in D1, blocks the scheduled runner and export/publishing state changes, and is visible on the dashboard.
- Generated content is stored in D1. Clean drafts enter the approval queue; flagged drafts remain drafts. Publishing requires an approved state. LinkedIn supports owner-triggered text-only member posts; the owner must approve each post and confirm uncertain outcomes. No scheduled auto-publishing is enabled.
- LinkedIn OAuth tokens are encrypted before D1 storage. The connection uses member permissions only; it does not publish to company pages or attach media. LinkedIn credentials, product access, and a live account connection still require owner setup and verification.
- Canva uses its OAuth API to fill an owner-provided video-capable brand template and request MP4 export. A Canva Pro, Teams, or Enterprise account and a Canva app with the configured API scopes are required. The integration does not assemble arbitrary timelines or generate source footage.
- Canva OAuth tokens are encrypted before D1 storage using `CANVA_TOKEN_ENCRYPTION_KEY`. Configure Canva client ID/secret and the exact callback URL as Worker secrets; register the same callback URL and required scopes in the Canva Developer Portal.
- Adobe Express uses its interactive Embed SDK only after Adobe business approval, an HTTPS domain, and a configured client ID. It is a user-operated editor; source selection, sign-in, review, and export remain with the owner.
- The real LLM provider requires server-side credentials, a model name, current provider input/output rates, and available configured spend caps. Rates are explicit configuration because prices can change. The pre-call spend reservation uses a conservative token estimate and the provider request has an output limit.
- The capability registry marks LinkedIn API documentation as checked but keeps the account “Not connected” until OAuth is completed. Other social platforms remain “Not connected” and “unverified.” No performance figures or live integrations are implied.
- `altText` remains an owner task when the final media does not exist. Exports identify that rather than inventing a description.

## Remote setup and current limitations

Follow [`../docs/SETUP.md`](../docs/SETUP.md) before provisioning Cloudflare resources or deploying. LinkedIn app registration and product access, Canva/Adobe app registrations, a real social account, LLM key, current model pricing, and Cloudflare Access configuration are not included. Trend research, social analytics, media publishing, company-page publishing, and automated scheduling remain unimplemented.
