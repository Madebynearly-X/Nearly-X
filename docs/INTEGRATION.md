# Integration Guide

How to get this pack into your repo, run Phase 1 in Copilot, and put the result live on Cloudflare safely.

Time needed: about 30 minutes to set up, then Copilot does the building.

---

## Part A: Add the pack to your repo

1. Open your site's repo in VS Code. Make sure the working tree is clean (`git status`).
2. Create a branch so the live site cannot be affected:
   ```
   git checkout -b feat/marketing-agent
   ```
3. Copy these into the **root** of the repo, keeping the folder structure:
   - `.github/copilot-instructions.md`
   - `docs/SPEC.md`
   - `docs/STATUS.md`
   - `docs/prompts/phase-1.md`
   - `docs/INTEGRATION.md`
4. **Replace `docs/SPEC.md`** with your original master prompt, pasted in full and unchanged. The file shipped here is only a placeholder, and Copilot is told to stop if it is still there.
5. Commit:
   ```
   git add .github docs
   git commit -m "Add marketing agent instructions and Phase 1 prompt"
   ```

> If your repo already has a `.github/copilot-instructions.md`, merge the two instead of overwriting.

## Part B: Run Phase 1 in Copilot

1. Make sure you are on a recent VS Code with GitHub Copilot Chat. Open Copilot Chat and switch the mode dropdown to **Agent**.
2. Choose the strongest model your plan offers. This is a long, multi-file task.
3. Send this message:
   ```
   Follow #file:docs/prompts/phase-1.md exactly. Start with Step 0. Work through every step, run the checks as you go, and give me the final report in the required format.
   ```
4. **Check the instructions were loaded.** In the response, open the "Used references" (or "References") list. `.github/copilot-instructions.md` should appear. If it does not, open VS Code settings, search for "instruction files", and make sure the Copilot setting for using instruction files is enabled. Then try again.
5. Approve tool and terminal prompts as they appear, and read what you are approving. Never approve anything that deletes files outside `/agent` or `/docs`.
6. If Copilot stops part-way (they often do on long tasks), send:
   ```
   Continue Phase 1 from where you stopped. Read docs/STATUS.md first, then carry on.
   ```
7. Commit after each milestone so you can roll back cleanly.

### How to know it worked

Do not take Copilot's word for it. Check these yourself:

| Check | How |
|---|---|
| Real inspection happened | `docs/REPO-FINDINGS.md` exists and matches your actual site (colours, fonts, contact path) |
| Code is sound | In `/agent` run `npm run typecheck && npm run lint && npm test && npm run build` |
| App runs | `npm run dev`, open the printed URL, dashboard loads |
| Public site untouched | `git diff --stat main -- . ':!agent' ':!docs' ':!.github'` prints nothing |
| No secrets in the bundle | Search the built dashboard output for your key names, e.g. `grep -r "API_KEY" agent/dashboard/dist` (expect no matches) |
| Honest reporting | The final report has separate Verified, Mocked, and Blocked sections |

If any check fails, tell Copilot exactly what failed and paste the output.

## Part C: Deploy to Cloudflare

Run these from `/agent`. Your existing Pages site is not involved.

1. **Log in:**
   ```
   npx wrangler login
   ```
2. **Create the database and bucket:**
   ```
   npx wrangler d1 create nearly-agent
   npx wrangler r2 bucket create nearly-agent-media
   ```
   Copy the `database_id` printed by the first command into `wrangler.jsonc` under the `DB` binding. R2 may ask you to enable it in the dashboard first, and may ask for a payment method even though a free tier exists. Check the current limits on Cloudflare's pricing page.
3. **Apply migrations** (local first, then remote):
   ```
   npm run db:migrate:local
   npm run db:migrate:remote
   ```
4. **Set secrets.** Only set the ones you have. Missing ones show setup messages instead of crashing:
   ```
   npx wrangler secret put LLM_API_KEY
   ```
   The exact names are in `.dev.vars.example`. For local development, copy it to `.dev.vars` and fill it in. That file is gitignored.
5. **Deploy:**
   ```
   npm run deploy
   ```
   Wrangler prints your Worker URL (`https://<name>.<your-subdomain>.workers.dev`).
6. **Protect it with Cloudflare Access** (do this before sharing the URL with anyone):
   - In the Cloudflare dashboard open your Worker, then **Settings, Domains & Routes**, and enable **Cloudflare Access** for the workers.dev route. If you later attach a custom domain, create a self-hosted application for it under Zero Trust, Access, Applications.
   - In Zero Trust, edit the generated Access application's policy so it **allows only your email address**.
   - Copy the application's **Audience (AUD) tag** and your **team domain** (`<team>.cloudflareaccess.com`), then set them:
     ```
     npx wrangler secret put ACCESS_AUD
     npx wrangler secret put ACCESS_TEAM_DOMAIN
     ```
   - Redeploy.
   - Dashboard menu labels change over time. If something is not where this guide says, search Cloudflare's docs for "Access for Workers".
7. **Verify:**
   - Open the Worker URL in a private window: you should hit the Access login, not the dashboard.
   - Log in with your email: the dashboard loads.
   - `curl -i https://<your-worker-url>/api/health` without a session should not return dashboard data.
   - In the Worker's **Settings, Triggers** you should see the cron schedule. After 15 minutes, a `heartbeat` entry appears in the dashboard's Activity Log.

## Part D: Connect it to the marketing site

Phase 1 needs no code changes to the public site. The connection is the **tagged links** the agent generates:

- Every exported post includes a link to `https://nearly-x.pages.dev/` with UTM parameters.
- To see the traffic, enable **Cloudflare Web Analytics** for the Pages project (cookie-free, no consent banner needed). Pages dashboard, your project, **Metrics**, enable Web Analytics.
- Real lead attribution (tracking enquiries back to a post) is Phase 6. Until then, record where each enquiry came from by asking, "How did you find us?" on your contact path.

## Part E: Platform access to start applying for now

Some platforms take weeks to approve. This is as I understand it today, so confirm each against its official documentation, which is exactly what Phase 4 will have Copilot do.

| Platform | Likely requirement |
|---|---|
| Instagram / Facebook | Meta developer app, Instagram Business or Creator account linked to a Facebook Page, app review for publishing permissions |
| LinkedIn | Developer app; posting to a company page typically needs approval for a Community Management product |
| TikTok | Developer app and an app audit before posts can be public |
| X | Paid API access for posting |

Until these are approved, the manual export flow in Phase 1 is your publishing path. It is not a downgrade, because every post still goes through approval and gets tagged links.

## Part F: Rollback and troubleshooting

| Problem | Fix |
|---|---|
| Something is wrong in production | Use the dashboard **Emergency Pause**, then `npx wrangler rollback` |
| Want to abandon the whole thing | `git checkout main && git branch -D feat/marketing-agent`. The public site was never touched |
| Copilot ignores the rules | Confirm the instructions file appears in References (Part B, step 4). Start a new chat and re-send the prompt |
| Copilot goes beyond Phase 1 | Reply: "Out of scope for Phase 1. Revert that and continue the listed steps." |
| `D1_ERROR` or binding not found | `database_id` in `wrangler.jsonc` is missing or wrong |
| Access login loops or 401 | `ACCESS_AUD` or `ACCESS_TEAM_DOMAIN` is wrong or unset. Redeploy after setting |
| Cron never fires | Check Worker Settings, Triggers. Test locally with `wrangler dev --test-scheduled` |

## Next phases

When Phase 1's final report is clean, ask me for the Phase 2 prompt (trend intelligence and daily brief), written against what Copilot actually built.
