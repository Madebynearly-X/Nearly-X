# NEARLY Studio — multi-page redesign

A static, responsive website with an Apple-inspired minimalist direction (without copying Apple branding): generous whitespace, oversized typography, restrained blue accents, product-style mockups and simple navigation.

## Pages
- `index.html` — studio home
- `landing-pages.html` — focused landing page service
- `business-websites.html` — starter and business websites
- `website-care.html` — maintenance service
- `contact.html` — enquiry form, with service selection prefilled from page links and a searchable international calling-code picker
- `thanks.html` — post-submission confirmation page

## Files
- `styles.css` — shared responsive design system
- `script.js` — mobile navigation, reveal-on-scroll, year and form validation/submission
- `contact-form.js` — enquiry submission and international phone country-code picker; country flags load as Twemoji SVGs from cdnjs
- `functions/api/enquiry.js` — server-side Web3Forms delivery and optional authenticated n8n lead recording
- `workflows/n8n-enquiry-to-google-sheets.json` — importable n8n workflow for adding enquiries to Google Sheets

## Before publishing
1. Confirm prices, timelines, included deliverables, revision limits and care plan terms.
2. Confirm public contact details.
3. The enquiry form uses a Cloudflare Pages Function at `/api/enquiry` to send enquiries through Web3Forms. Create a Web3Forms access key for `madebynearly@gmail.com`, then add it to the Cloudflare Pages project's **Settings → Variables and Secrets** as the encrypted secret `WEB3FORMS_ACCESS_KEY`. Never commit the key. Redeploy after configuring the secret. The form reports success only when Web3Forms accepts the submission; confirm delivery in Gmail and check Spam during the first live test.
4. Add a real privacy notice that accurately describes your data handling.
5. Replace illustrative mockups with real work as you have permission to publish it. Concept work should remain clearly labelled.
6. Add favicon/social preview assets, update absolute social-image metadata, and test all pages on mobile and desktop.
7. Deploy as a preview first and test every navigation link and enquiry flow before pointing your main domain at it.

## Optional: record enquiries in Google Sheets with n8n

The website continues to send enquiries through Web3Forms. Once configured, the Cloudflare Pages Function also sends each enquiry to n8n, which appends it to a private Google Sheet. The existing Web3Forms email remains the email notification; n8n only records the lead. If Google Sheets recording fails, the email remains successful and the form clearly reports that the lead tracker could not be updated.

1. Create a private Google Sheet named `NEARLY Leads` with a tab named `Leads`. Set the first row to these exact headers: `received_at`, `name`, `email`, `phone`, `business`, `package`, `details`, `status`. Restrict access to people who need to see enquiries.
2. In n8n, import `workflows/n8n-enquiry-to-google-sheets.json`.
3. Create an **HTTP Header Auth** credential for the Webhook node. Set the header name to `X-Nearly-Webhook-Token` and choose a long, random value. Keep that value private.
4. Create and select a Google Sheets OAuth2 credential on **Append Lead to Sheet**, then select the `NEARLY Leads` document and its `Leads` tab. Ensure the columns map to the header names above.
5. Save and activate the workflow. Copy its **Production URL** from the Webhook node (not the Test URL). The workflow authenticates requests, writes the row, and only then confirms `{"success":true,"recorded":true}`.
6. In the Cloudflare Pages project's **Settings → Variables and Secrets** for **Production**, add encrypted secrets named `N8N_WEBHOOK_URL` (the n8n Production URL) and `N8N_WEBHOOK_TOKEN` (the same random value used by the n8n credential). Never place either value in this repository or the browser.
7. Redeploy the Pages project. Update the site's privacy notice to cover enquiry storage in Google Sheets, the services processing it, and your retention practices. Submit a clearly marked test enquiry and verify both the existing email and the new row in the Sheet before relying on the workflow.

Until both Cloudflare secrets are set, n8n recording is disabled and the existing email flow is unchanged. If n8n or Google Sheets is unavailable after activation, the enquiry email is still sent; the site reports that lead recording could not be confirmed, and Cloudflare logs a failure without recording enquiry contents.

## Run locally
Open `index.html` in a browser to preview the static pages. The enquiry endpoint requires Cloudflare Pages Functions and the `WEB3FORMS_ACCESS_KEY` secret, so the complete form flow must be tested on Cloudflare Pages or with Wrangler Pages development. Use dummy details for tests.
