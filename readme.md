# NEARLY Studio — multi-page redesign

A static, responsive website with an Apple-inspired minimalist direction (without copying Apple branding): generous whitespace, oversized typography, restrained blue accents, product-style mockups and simple navigation.

## Pages
- `index.html` — studio home
- `landing-pages.html` — focused landing page service
- `business-websites.html` — starter and business websites
- `website-care.html` — maintenance service
- `contact.html` — enquiry form, with service selection prefilled from page links and a flagged international calling-code selector
- `thanks.html` — post-submission confirmation page

## Files
- `styles.css` — shared responsive design system
- `script.js` — mobile navigation, reveal-on-scroll, year and form validation/submission
- `contact-form.js` — enquiry submission and flagged international phone country-code selector

## Before publishing
1. Confirm prices, timelines, included deliverables, revision limits and care plan terms.
2. Confirm public contact details.
3. The enquiry form uses a Cloudflare Pages Function at `/api/enquiry` to send enquiries through Web3Forms. Create a Web3Forms access key for `madebynearly@gmail.com`, then add it to the Cloudflare Pages project's **Settings → Variables and Secrets** as the encrypted secret `WEB3FORMS_ACCESS_KEY`. Never commit the key. Redeploy after configuring the secret. The form reports success only when Web3Forms accepts the submission; confirm delivery in Gmail and check Spam during the first live test.
4. Add a real privacy notice that accurately describes your data handling.
5. Replace illustrative mockups with real work as you have permission to publish it. Concept work should remain clearly labelled.
6. Add favicon/social preview assets, update absolute social-image metadata, and test all pages on mobile and desktop.
7. Deploy as a preview first and test every navigation link and enquiry flow before pointing your main domain at it.

## Run locally
Open `index.html` in a browser to preview the static pages. The enquiry endpoint requires Cloudflare Pages Functions and the `WEB3FORMS_ACCESS_KEY` secret, so the complete form flow must be tested on Cloudflare Pages or with Wrangler Pages development. Use dummy details for tests.
