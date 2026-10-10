# Repository findings

## Stack and deployment

- The public site is a multi-page static site built with plain HTML, CSS, and browser JavaScript. There is no frontend framework.
- No `package.json`, lockfile, build configuration, test runner, linter, or dependency manager is present in the repository.
- The repository is configured for Cloudflare Pages by convention and documentation: `_headers` supplies Pages response headers, and `functions/api/enquiry.js` implements the `/api/enquiry` Pages Function. The README describes the deployed site at `https://nearly-x.pages.dev/`.
- There is no Wrangler configuration in the current repository. The marketing agent can therefore be added as the separately specified `/agent` Cloudflare Worker without changing the static site's deployment or build.
- The current branch is `feat/marketing-agent`, consistent with the integration guide's isolation recommendation.

## Existing enquiries and lead handling

- Website calls to action link to `contact.html`, an email address, or the studio's WhatsApp contact. `contact.html` has a project enquiry form with name, email, optional phone/business/service, and project details fields.
- The form posts to `/api/enquiry`. The Pages Function validates the request, honeypot, required fields and email; verifies Cloudflare Turnstile server-side; and submits the enquiry through Web3Forms when its server-side key is configured.
- Google Sheets recording is optional and requires both configured webhook secrets. The Apps Script validates its token and appends enquiries to a `Leads` sheet; the README says email remains the primary path.
- The site advertises service prices in its page content. Agent quality controls must not invent, alter, or claim owner authorisation for promotional terms beyond the verified site content and explicit configuration.
- No credentials were inspected. The Pages secrets, Turnstile configuration, Web3Forms status, Google Sheets deployment, and live email delivery have not been independently verified.

## Brand and assets

- CSS variables in `styles.css`: background `#f5f5f7`, paper `#fff`, ink `#1d1d1f`, muted `#6e6e73`, line `#d2d2d7`, and blue accent `#06c` (hover `#0077ed`).
- Typography uses DM Sans for body copy and Manrope for headings/brand styling, imported from Google Fonts.
- `favicon.svg` contains a white “N.” on a rounded dark square; the site also builds its wordmark from text and a CSS-styled mark. No separate logo image file was found.
- Locally present visual assets are the two illustrative demo photographs in `assets/`; the site explicitly labels its concept work as illustrative rather than commissioned client work.
- Copy is understated, clear, and warm: professional without pressure, with an emphasis on clear scope, considered design, and no surprise invoices. The site targets South African businesses while saying it works worldwide.

## Existing security, analytics, and persistence

- `_headers` configures a Content Security Policy, HSTS, frame denial, MIME sniffing protection, referrer policy, and permissions policy.
- The Pages enquiry handler performs server-side validation and Turnstile verification; its secrets are intended to be configured in Cloudflare Pages rather than committed.
- The README states that there is no advertising or analytics-cookie setup. Repository searches found no analytics integration, authentication system, or application database.
- Lead persistence is an optional Google Sheets integration, not a database in this repository. There is no existing persistent store for marketing-agent state.

## Compatibility with the agent pack

- The pack's architecture requires a separate Cloudflare Worker, D1, and dashboard under `/agent`; optional object storage can be added later without placing privileged integration secrets or cron jobs in the public site.
- The existing Pages Function and `_headers` establish Cloudflare Pages usage, so the absence of a Wrangler file is a configuration gap, not the absence of Cloudflare support. The Worker can have its own Wrangler config.
- The public site's files are explicitly out of scope and will remain unchanged. Agent capabilities without credentials or verified APIs will be labelled unavailable, mocked, or unverified rather than represented as live.
- Existing root instructions in `AGENTS.md` reinforce inspection, security, and preserving site behavior; no material conflict with the agent pack was found.
