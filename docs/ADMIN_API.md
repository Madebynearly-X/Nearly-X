# Admin API Documentation

This document describes the admin API endpoints for managing clients and projects.

## Authentication

All admin endpoints require an `Authorization` header with a Bearer token:

```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

The `ADMIN_API_KEY` must be configured as a Cloudflare Pages secret.

## Endpoints

### Create Client Account

**POST** `/api/admin/create-client`

Create a new client account with login credentials.

**Request Body:**
```json
{
  "name": "Client Name",
  "email": "client@example.com",
  "phone": "+27 78 394 0421",
  "business": "Business Name",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "client": {
    "id": 1,
    "name": "Client Name",
    "email": "client@example.com",
    "phone": "+27 78 394 0421",
    "business": "Business Name"
  }
}
```

**Requirements:**
- `name`, `email`, and `password` are required
- Email must be valid and unique
- Password must be at least 8 characters

### Create Project

**POST** `/api/admin/create-project`

Create a new project for an existing client.

**Request Body:**
```json
{
  "client_id": 1,
  "name": "Website Redesign",
  "package": "business-website",
  "status": "pending"
}
```

**Response:**
```json
{
  "success": true,
  "project": {
    "id": 1,
    "client_id": 1,
    "name": "Website Redesign",
    "package": "business-website",
    "status": "pending"
  }
}
```

**Requirements:**
- `client_id`, `name`, and `package` are required
- `client_id` must refer to an existing client
- `status` defaults to "pending" if not provided

## Example Usage

### Using curl

```bash
# Create a client
curl -X POST https://nearly-x.pages.dev/api/admin/create-client \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "business": "Acme Corp",
    "password": "SecurePassword123"
  }'

# Create a project
curl -X POST https://nearly-x.pages.dev/api/admin/create-project \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "name": "Landing Page",
    "package": "landing-page",
    "status": "in-progress"
  }'
```

### Lead-to-Client Workflow

When you receive an enquiry via the contact form and convert them to a client:

1. Review the enquiry and confirm you want to work with them
2. Generate a secure password for their client portal access
3. Use the `/api/admin/create-client` endpoint to create their account
4. Email them their login credentials (consider using a temporary password they can change)
5. Use `/api/admin/create-project` to create their project once the scope is agreed
6. Optionally create milestones and tasks via direct database operations

## Security Notes

- Keep `ADMIN_API_KEY` secure and rotate it periodically
- Never share admin keys or client passwords in unencrypted communications
- Consider implementing a password reset flow for clients
- All admin operations should be logged for audit purposes
