# NEARLY Studio

Static Cloudflare Pages site for NEARLY Studio, a South Africa-based web design studio working worldwide.

## Run locally

For a static preview, open `index.html`. To test the Pages Function and `_headers`, use Wrangler from the repository root:

```text
npx wrangler pages dev .
```

The complete enquiry flow needs the environment variables listed below. Use test data locally and never commit secrets.

## Deploy to Cloudflare Pages

Push to `main`. The workflow in `.github/workflows/deploy-pages.yml` deploys the repository to Cloudflare Pages. Configure these GitHub repository secrets/variables first:

- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Variable: `CLOUDFLARE_PAGES_PROJECT`

The token needs permission to deploy to Pages. The Cloudflare Pages project should be configured with its production secrets in the Cloudflare dashboard as well.

## Pages

- `index.html` — home, services, illustrative concepts and FAQ
- `landing-pages.html` — landing page service
- `business-websites.html` — business website service
- `website-care.html` — ongoing website care service
- `contact.html` — enquiry form and contact details
- `thanks.html` — post-submission page
- `privacy.html` — privacy notice
- `concept-demos.html` — interactive illustrative concept demos
- `404.html` — styled not-found page

Shared assets and behaviour live in `styles.css`, `selected-concepts.css`, `concept-demos.css`, `script.js` and `concept-demos.js`.

## Enquiry Function

`functions/api/enquiry.js` handles `POST /api/enquiry`. It checks the same-origin request, validates the fields and Turnstile token, sends the enquiry through Web3Forms, and optionally records it in Google Sheets through an Apps Script webhook. The browser reports email success only after Web3Forms confirms delivery; if Sheets is enabled but does not confirm recording, the response includes a warning.

Required/optional environment variable names:

- `TURNSTILE_SECRET_KEY` — required Turnstile secret
- `WEB3FORMS_ACCESS_KEY` — required Web3Forms access key
- `GOOGLE_SHEETS_WEBHOOK_URL` — optional Apps Script web app URL; used with the token below
- `GOOGLE_SHEETS_WEBHOOK_TOKEN` — optional shared webhook token

Keep all values in Cloudflare Pages encrypted secrets or local ignored development files. Names are documented here; values must never be committed.

## Repository safety

`.gitignore` excludes environment files, Wrangler state, editor settings, logs, and dependencies. Review `_headers` whenever adding a third-party script, font, image source or endpoint because the Content Security Policy must be updated deliberately.
