# Marketing agent setup

The marketing agent is a separate Cloudflare Worker in `agent/`. It does not alter the public Cloudflare Pages site.

## Local run

Prerequisite: install a supported Node.js release with npm. From a PowerShell terminal:

```powershell
cd agent
npm ci
npm run db:migrate:local
npm run dev
```

The repository includes an ignored local `agent/.dev.vars` with only a local owner placeholder and the explicit development auth bypass. After a fresh clone, copy `agent/.dev.vars.example` to `agent/.dev.vars`; keep the bypass enabled only for local development and replace the owner placeholder for local testing. `ENVIRONMENT=development` and `ALLOW_DEV_AUTH_BYPASS=true` are both required. This code path is not accepted in production.

Open the local URL printed by Wrangler. The dashboard, authenticated API, and mock draft generation should load. The health endpoint is `http://127.0.0.1:<port>/api/health`. The D1 local database is stored under the ignored Wrangler state directory.

## Cloudflare resources and deployment

Only perform the following after confirming the desired Cloudflare account and Worker name:

1. Authenticate with `npx wrangler login`.
2. Create a D1 database: `npx wrangler d1 create nearly-marketing-agent`.
3. Replace the all-zero placeholder `database_id` in `agent/wrangler.jsonc` with the returned ID. Do not put credentials in the config.
4. Create the R2 bucket: `npx wrangler r2 bucket create nearly-marketing-agent-media`.
5. Apply schema changes: `npm run db:migrate:remote`.
6. Configure Cloudflare Access to protect the Worker route and allow only the owner's identity. Set the Access team's domain and audience in Worker secrets:

   ```powershell
   npx wrangler secret put ACCESS_TEAM_DOMAIN
   npx wrangler secret put ACCESS_AUD
   npx wrangler secret put OWNER_EMAIL
   ```

   `OWNER_EMAIL` must match the email claim in the verified Access JWT. Do not rely on frontend-only protection.
7. To enable LinkedIn member-post publishing:

   - Create a LinkedIn Developer app and add the exact HTTPS callback `https://<your-agent-host>/api/integrations/linkedin/callback`.
   - In the Developer Portal, request/enable **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**. LinkedIn controls app/product access; this repository cannot grant it. The connection requests only `openid`, `profile`, and `w_member_social`.
   - Configure the following Worker secrets:

     ```powershell
     npx wrangler secret put LINKEDIN_CLIENT_ID
     npx wrangler secret put LINKEDIN_CLIENT_SECRET
     npx wrangler secret put LINKEDIN_REDIRECT_URI
     npx wrangler secret put LINKEDIN_TOKEN_ENCRYPTION_KEY
     ```

   - Generate the token-encryption key locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and store the output only as a Worker secret. Never commit it or paste it into source files or chat.
   - The Worker uses the versioned Posts API (`202609` as checked on 2026-10-10). Update `LINKEDIN_API_VERSION` in `agent/wrangler.jsonc` only after checking LinkedIn's current supported versions.
   - Connect the owner-authorized member account in the private dashboard. Access tokens are encrypted at rest and expire according to LinkedIn's returned `expires_in`; reconnect when expired.
   - Only approved text-only member posts can be sent. The request includes the approved caption/script, call to action, and a tagged destination URL. Company-page posts, image/video uploads, scheduling, and analytics are not included. Each publication is owner-triggered. If LinkedIn's response is uncertain, check the member feed and resolve the recorded attempt before retrying.
   - Verify with a clearly marked test post and confirm its presence in the intended LinkedIn member feed. A mocked test response is not a live verification.
   - Disconnecting removes the encrypted token from this Worker; it does not revoke LinkedIn's app authorization. Revoke the app's access in LinkedIn's account settings if you need to withdraw that authorization.
8. To connect Canva, create a Canva Developer app and register the exact HTTPS callback `https://<your-agent-host>/api/integrations/canva/callback` in its redirect URL list. Public apps must pass Canva's app review before release; private apps are limited to Enterprise teams and require team-owner/admin review. Enable the OAuth scopes `design:content:write`, `design:content:read`, and `design:meta:read`. The account used for template autofill must be on an eligible Canva Pro, Teams, or Enterprise plan. Configure the following Worker secrets:

   ```powershell
   npx wrangler secret put CANVA_CLIENT_ID
   npx wrangler secret put CANVA_CLIENT_SECRET
   npx wrangler secret put CANVA_REDIRECT_URI
   npx wrangler secret put CANVA_TOKEN_ENCRYPTION_KEY
   ```

   Generate the encryption key locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and store the output only as a Worker secret. Never commit it or paste it into source files. The app stores Canva access/refresh tokens encrypted in D1. The Canva workflow fills an existing video-capable brand template using its exact dataset field names and Canva video asset IDs; it does not create video footage or arbitrary timelines. The MP4 export is a user-triggered Canva API operation, and its download URLs expire after 24 hours.
9. Adobe Express is an interactive editor, not a headless video API. Request Adobe business approval for the Embed SDK, create an Embed SDK project key, and allowlist the exact HTTPS app domain in Adobe Developer Console. After approval, configure `ADOBE_EXPRESS_EMBED_CLIENT_ID` and `APP_PUBLIC_ORIGIN` as Worker variables, with `APP_PUBLIC_ORIGIN` matching the full agent origin (scheme and host). Set `ADOBE_EXPRESS_EMBED_APPROVED=true` only after approval. Video actions remain disabled until all three checks pass; the owner chooses/uploads media and completes save/export in Adobe Express. Local HTTP does not satisfy this requirement.
10. To use a paid LLM, separately approve the provider/account and a spend cap, then set the server-side values:

   ```powershell
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put OPENAI_MODEL
   npx wrangler secret put LLM_INPUT_USD_PER_1K_TOKENS
   npx wrangler secret put LLM_OUTPUT_USD_PER_1K_TOKENS
   ```

   Check the provider's current official pricing before configuring rates. No key or price is supplied by this project. Keep `LLM_PROVIDER=mock` until these values are reviewed.
11. Deploy with `npm run deploy`, then confirm the Worker URL is behind Cloudflare Access before sharing it. Keep the development auth bypass unset in production.

Remote resource creation, LinkedIn app registration and product access, LinkedIn account authorization, Canva app registration and account authorization, Adobe business approval and key, secrets, and deployment require owner setup; they are not included or pre-configured.

## Local operator notes

- Default mode is `SUPERVISED`; the global pause is stored in D1.
- The `MockProvider` creates labelled test drafts without external calls.
- LinkedIn publishing tests use mocked API responses. A LinkedIn account is not connected until the owner completes the OAuth setup above and verifies a real post.
- A missing real-provider credential or spend-rate configuration yields a setup message; no fake success is returned.
- `npm run db:migrate:local` and `npm run db:migrate:remote` must be run when applying schema changes in their respective environments.
- The scheduled heartbeat is invoked every 15 minutes by the Worker Cron Trigger. With local `wrangler dev` running, trigger it manually with `Invoke-WebRequest -Uri "http://127.0.0.1:8787/cdn-cgi/local/scheduled"`.
- API health exposes no database contents or secret state.
