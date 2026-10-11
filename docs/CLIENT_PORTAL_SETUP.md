# Client Portal Setup Guide

This guide explains how to set up the Cloudflare D1 database and client portal for Nearly Studio.

## Prerequisites

- Cloudflare account with Pages already configured
- Wrangler CLI installed: `npm install -g wrangler`
- Authentication with Cloudflare: `wrangler login`

## Step 1: Create D1 Database

```bash
# Create the database
wrangler d1 create nearly-studio-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nearly-studio-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

## Step 2: Run Database Migrations

```bash
# Execute the initial schema migration
wrangler d1 execute nearly-studio-db --file=migrations/0001_initial_schema.sql
```

## Step 3: Configure Environment Variables

Add these secrets to your Cloudflare Pages project (via Cloudflare dashboard or `wrangler pages secret`):

- `ADMIN_API_KEY`: A random string for admin API authentication (generate with: `openssl rand -base64 32`)
- Existing secrets (for enquiry form):
  - `TURNSTILE_SECRET_KEY`: Turnstile secret for the contact form
  - `WEB3FORMS_ACCESS_KEY`: Web3Forms access key for email delivery
  - `GOOGLE_SHEETS_WEBHOOK_URL`: Optional Google Sheets webhook URL
  - `GOOGLE_SHEETS_WEBHOOK_TOKEN`: Optional Google Sheets webhook token

## Step 4: Update Cloudflare Pages Project

Since you're using Cloudflare Pages with Functions, you need to add the D1 binding to your Pages project.

Via Cloudflare Dashboard:
1. Go to your Pages project
2. Settings → Functions → D1 database bindings
3. Add binding:
   - Variable name: `DB`
   - D1 database: `nearly-studio-db`

Or via CLI (requires project ID):
```bash
wrangler pages deployment create --project-name=nearly-x \
  --d1-binding=DB:nearly-studio-db
```

## Step 5: Create First Client

Use the API endpoint to create a client account (requires authentication system to be implemented first).

## Verification

To verify the database is working:

```bash
# List tables
wrangler d1 execute nearly-studio-db --command="SELECT name FROM sqlite_master WHERE type='table'"

# Should output: clients, projects, milestones, tasks
```

## Security Notes

- Never commit the real `database_id` to this repository
- Keep `SESSION_SECRET` secure and rotate it periodically
- Use strong password hashing (bcrypt) for client passwords
- All client portal pages require authentication
