# Platform setup handoff

Last updated: 2026-10-10

This document records the external-platform setup work completed for NEARLY Studio so it can be continued in another session or tool if needed. It contains no passwords, verification codes, OAuth tokens, API secrets, or private session URLs.

## LinkedIn

### Current account state

- The LinkedIn account was reactivated successfully.
- The active member profile is named `Nearly Studio` and is located in South Africa.
- Profile URL: https://www.linkedin.com/in/nearly-studio-7120a4443/
- This is a personal/member profile, not a LinkedIn Company Page.

### Company Page attempt

- Correct creation flow: https://www.linkedin.com/company/setup/new
- The Company page type was selected.
- LinkedIn blocked creation with this message:

  > If you recently created your LinkedIn account, please wait at least one day before trying again.

- The flow was retried and the same restriction remained.
- No Company Page was created yet.
- No LinkedIn developer app was created yet.

### Continue later

1. Wait at least 24 hours after the account reactivation/new-account restriction.
2. Open the Company Page creation flow again.
3. Create a Company page for `NEARLY Studio`.
4. Use only verified business details:
   - Website: `https://nearly-x.pages.dev/`
   - Location: Pretoria, Gauteng, South Africa, if LinkedIn asks for the business location
   - Public description: use the factual description on the website
   - Privacy policy: `https://nearly-x.pages.dev/privacy`
5. Use the NEARLY logo as the page and app logo. Do not use a personal photo.
6. After the Company Page exists, open https://www.linkedin.com/developers/apps/new.
7. Create the developer app only after the Company Page can be selected and verified as the associated page.
8. Request only the LinkedIn API products and permissions actually needed for approved, owner-triggered publishing. Do not publish automatically until OAuth, permissions, approval, token storage, revocation, and a test post are configured.

### Launch copy

Launch post drafts are saved in [LAUNCH-POSTS.md](./LAUNCH-POSTS.md). They contain:

- Two LinkedIn variants: story-led and offer-led
- A Facebook local-business-group post
- A WhatsApp Status text
- An email signature line

The copy uses factual services and prices only and does not claim past clients, results, testimonials, numbers, or logos.

## Google Business Profile API

### Cloud project created

- Project name: `NEARLY Business Profile`
- Project ID: `nearly-business-profile`
- Project number: `805106436714`
- A free-trial offer was not started and billing was not added.

### Current blocker

Google requires the Business Profile to be verified and active for at least 60 days before Basic API Access can be requested. The profile was still awaiting verification during setup.

Official prerequisites: https://developers.google.com/my-business/content/prereqs

### Continue later

1. Complete and wait for Google Business Profile verification.
2. Keep the profile complete and accurate for at least 60 days.
3. Request Basic API Access using project number `805106436714`.
4. After approval, enable the approved Business Profile APIs.
5. Create OAuth 2.0 credentials using the `business.manage` scope.
6. Connect the API through a protected admin workflow, never through the public website.

## Google Business Profile details already entered

- Business name: Nearly Studio
- Category: Web Designer
- Service area: South Africa
- Website: `https://nearly-x.pages.dev/`
- Phone: the existing verified business number
- WhatsApp chat: `https://wa.me/27783940421`
- Services:
  - Landing page design
  - Starter website design
  - Business website design
  - Website care and maintenance

The profile still showed Saturday as open 24 hours, which makes Google summarise the business as open 24 hours. Correct this only after confirming the actual business hours.

## Safety notes

- Never put LinkedIn or Google OAuth secrets in the public website repository.
- Do not use a personal LinkedIn profile as the Company Page associated with a developer app.
- Do not invent client results, testimonials, business hours, addresses, social links, opening dates, or credentials.
- Confirm every external save and API response before reporting that a change is live.
