# NEARLY Studio — multi-page redesign

A static, responsive website with an Apple-inspired minimalist direction (without copying Apple branding): generous whitespace, oversized typography, restrained blue accents, product-style mockups and simple navigation.

## Pages
- `index.html` — studio home
- `landing-pages.html` — focused landing page service
- `business-websites.html` — starter and business websites
- `website-care.html` — maintenance service
- `contact.html` — enquiry form, with service selection prefilled from page links and a searchable international calling-code picker
- `thanks.html` — post-submission confirmation page
- `privacy.html` — plain-language notice for website enquiries and lead handling

## Files
- `styles.css` — shared responsive design system
- `_headers` — Cloudflare Pages security headers and Content Security Policy
- `script.js` — mobile navigation, reveal-on-scroll, year and form validation/submission
- `contact-form.js` — enquiry submission and international phone country-code picker; country flags load as Twemoji SVGs from cdnjs
- `functions/api/enquiry.js` — server-side Web3Forms delivery and optional authenticated Google Sheets lead recording
- `scripts/google-sheets-webhook.gs` — Google Apps Script endpoint that records leads and maintains the Sheet's follow-up pipeline

## Before publishing
1. Confirm prices, timelines, included deliverables, revision limits and care plan terms.
2. Confirm public contact details.
3. The enquiry form uses a Cloudflare Pages Function at `/api/enquiry` to send enquiries through Web3Forms. Create a Web3Forms access key for `madebynearly@gmail.com`, then add it to the Cloudflare Pages project's **Settings → Variables and Secrets** as the encrypted secret `WEB3FORMS_ACCESS_KEY`. Never commit the key. Redeploy after configuring the secret. The form reports success only when Web3Forms accepts the submission; confirm delivery in Gmail and check Spam during the first live test.
4. Keep `privacy.html` accurate as your data handling, service providers, and retention practices change.
5. Replace illustrative mockups with real work as you have permission to publish it. Concept work should remain clearly labelled.
6. Add favicon/social preview assets, update absolute social-image metadata, and test all pages on mobile and desktop.
7. Deploy as a preview first and test every navigation link and enquiry flow before pointing your main domain at it.

## Enquiry spam protection

The contact form includes a honeypot field and Cloudflare Turnstile. Turnstile must be validated server-side; the Pages Function does this through Cloudflare Siteverify and checks the configured hostname and `enquiry` action before sending anything to email or Sheets.

Before deploying the Turnstile integration:
1. Create a Turnstile widget for `nearly-x.pages.dev` and any custom domain you use. Use Managed mode and do not enable pre-clearance.
2. Set the widget's **site key** on the `cf-turnstile` element in `contact.html`. This key is public and belongs in the page; the **secret key must never go into source code or chat**.
3. Add the widget's secret key to the Cloudflare Pages project's **Settings → Variables and Secrets** for Production as the encrypted secret `TURNSTILE_SECRET_KEY`.
4. Only publish after both keys are configured. If either key is missing or does not match, form submissions will be rejected rather than silently bypassing verification.
5. Submit a real test enquiry and verify it reaches both email and the Leads sheet. Expired or reused Turnstile tokens are rejected; visitors can retry the widget and submit again.

Turnstile is provided at no cost by Cloudflare under its current service terms. It sends technical browser and network signals to Cloudflare for bot detection; see `privacy.html`. Keep the privacy notice accurate if you change providers or widget settings.

## Security and cookies

The site does not use advertising or analytics cookies or a cookie-preference store, so it does not need a consent banner for those purposes. Turnstile may use strictly necessary security cookies or similar signals; these are described in the privacy notice. `_headers` applies a restrictive Content Security Policy, clickjacking protection, MIME sniffing protection, a referrer policy, a permissions policy, and HSTS on Cloudflare Pages. Review the CSP whenever adding scripts, fonts, images, or other third-party services.

## Optional: record enquiries in Google Sheets at no hosting cost

This setup does not require n8n or a separate hosting service. It uses Google Sheets and a small Google Apps Script web app. Google account quotas and product terms apply. The website keeps using Web3Forms for enquiry email; the Cloudflare Pages Function separately sends a copy to your script for the private lead sheet. If recording fails, the form reports that the email was accepted but the lead tracker could not be updated.

1. In Google Sheets, create a private spreadsheet named `NEARLY Leads` and add a tab named `Leads`. Keep access restricted to you and anyone who needs the enquiries.
2. Open the spreadsheet ID from its URL: the long text between `/d/` and `/edit`. Keep this ID handy.
3. Open [script.google.com](https://script.google.com/), create a new project, and paste the contents of `scripts/google-sheets-webhook.gs` into `Code.gs`. Save the project.
4. In Apps Script, open **Project Settings** and add these **Script Properties**:
   - `SPREADSHEET_ID` — the spreadsheet ID from step 2.
   - `WEBHOOK_TOKEN` — a new, private random secret of at least 32 characters. Do not share or commit it.
5. Choose **Deploy → New deployment → Web app**. Set **Execute as** to your Google account and **Who has access** to **Anyone**, then deploy and approve Google Sheets access. Anyone can reach this public endpoint, but it only records a lead when the private token matches.
6. Copy the deployed web app URL. It should start with `https://script.google.com/macros/s/` and end with `/exec`.
7. In the Cloudflare Pages project's **Settings → Variables and Secrets** for **Production**, add encrypted secrets named `GOOGLE_SHEETS_WEBHOOK_URL` (the Apps Script URL) and `GOOGLE_SHEETS_WEBHOOK_TOKEN` (the exact same random secret from step 4). Do not put either secret into website files or chat.
8. Redeploy the Pages project. The site's `privacy.html` notice describes lead storage in Google Sheets, the services processing it, and the 12-month retention period for enquiries that do not become client relationships. Review it if these practices change. Submit a clearly marked test enquiry and confirm both the existing email and the row in the `Leads` tab before relying on this workflow.

Until both Cloudflare secrets are set, sheet recording is disabled and the existing email flow is unchanged. If Google Sheets recording fails after activation, the email is still sent; the site reports that sheet recording was not confirmed. Apps Script logs failures without logging the enquiry contents.

### Lead follow-up columns

The Apps Script adds `last_contacted`, `follow_up_date`, and `notes` to the `Leads` sheet if they are missing. It formats the header, freezes it, adds a filter, and adds a `status` dropdown with `New`, `Contacted`, `Qualified`, `Proposal sent`, `Won`, and `Lost`. New enquiries are added as `New`; enter contact dates, follow-up dates, and notes manually as you work each lead. For an existing deployment, replace `Code.gs` with the latest contents of `scripts/google-sheets-webhook.gs`, save, then use **Deploy → Manage deployments → Edit** and deploy a new version of the web app. Keep its existing Script Properties and `/exec` URL; the Cloudflare secrets do not need changing.

## Accessibility
The site includes a skip link, named primary navigation, keyboard-visible focus indicators, keyboard-operable enquiry controls, semantic page landmarks, and reduced-motion support. These code improvements are not a legal ADA compliance certification or a complete WCAG conformance audit; test with assistive technologies and users, and review applicable legal requirements before making a compliance claim.

## Run locally
Open `index.html` in a browser to preview the static pages. The enquiry endpoint requires Cloudflare Pages Functions and the `WEB3FORMS_ACCESS_KEY` secret, so the complete form flow must be tested on Cloudflare Pages or with Wrangler Pages development. Use dummy details for tests.
