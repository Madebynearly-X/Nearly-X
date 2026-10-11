# NEARLY Studio maintenance

Run this checklist monthly and record the date and any follow-up action.

## Monthly checklist

- [ ] Send a clearly marked test enquiry using a real production test address. Confirm the success response, then confirm both the email arrives and the matching row arrives in the private Leads sheet. Turnstile, Web3Forms and Apps Script can each fail silently or independently, so check all three parts.
- [ ] Check the enquiry warning and error paths in the browser if any delivery or sheet issue is found. Review Cloudflare Pages Function logs, Web3Forms delivery status and Apps Script execution logs before retrying.
- [ ] Check the main navigation, footer links, service links, contact links, privacy link, concept demo links and any external email/WhatsApp links. Use a link checker or crawl the deployed site.
- [ ] Run Lighthouse on the home page, contact page and one service page on mobile and desktop. Note performance, accessibility, best-practice and SEO regressions.
- [ ] Review analytics and conversion events, if analytics is enabled. Compare enquiry submissions with confirmed Function responses and treat WhatsApp clicks as clicks, not confirmed conversations.
- [ ] Note the next renewal dates for the domain, business email, SSL/custom hostname and any other paid service. Confirm billing contacts and payment methods remain current.
- [ ] Review prices, service scope, contact details, privacy wording, structured data and illustrative-concept labels for accuracy.
- [ ] Check the current production deployment and the latest successful `main`-branch workflow run.

## Free uptime monitoring

UptimeRobot's free plan is a practical choice for a small site. Create an HTTP(s) monitor for the production homepage, set a five-minute interval if that is available on the current plan, and add an email alert contact. Use the final custom-domain URL rather than only the Pages preview URL. Also add a second monitor for `/api/health` only if that endpoint is intentionally public and belongs to the service being monitored; do not expose protected admin endpoints just to monitor them.

After creating the monitor, confirm the first check is `Up`, then use UptimeRobot's test-alert option or temporarily monitor a deliberately invalid URL to confirm the alert reaches the intended inbox. Restore the real URL immediately and record the monitor name, URL and alert recipient here or in the team's password/operations record—never in source control if it contains sensitive data.
