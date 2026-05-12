# Architecture

## Target architecture

One unified Next.js application hosted on Netlify with Supabase as backend.

```text
User Browser
  -> Netlify hosted Next.js app
      -> Supabase Auth
      -> Supabase Postgres
      -> Supabase Storage
      -> Server routes or edge functions
      -> AI provider gateway
      -> n8n webhooks
      -> Postiz API if used
```

## App structure

```text
/app
  /(auth)
  /dashboard
  /atlas
  /social
  /images
  /email
  /calendar
  /admin
  /settings
/components
/lib
  /supabase
  /ai
  /n8n
  /postiz
  /usage
  /permissions
/types
/supabase
  /migrations
  /seed
/docs
/tests
```

## Authentication

Use Supabase Auth.

Roles:

- owner
- admin
- loan_officer

Role data stored in `profiles`.

All sensitive data protected by RLS.

## Backend

Use Supabase for:

- users and roles
- chat sessions
- chat messages
- uploaded files
- generated images
- social drafts
- email drafts
- calendar items
- provider configs
- usage events
- audit logs

Use server side routes for provider calls so API keys never hit browser.

## AI Gateway

All AI calls go through one gateway.

Providers:

- OpenRouter for text
- DeepSeek through OpenRouter or direct if configured
- Fal.ai for image generation
- NVIDIA endpoints if configured
- Optional future providers

The gateway must enforce:

- auth
- role permissions
- daily caps
- cost estimates
- metadata logging
- error normalization

## n8n

n8n should handle automations, not core app rendering.

Use n8n for:

- social publishing
- newsletter send workflows
- lead follow up later if needed
- scheduled reports
- Google Business Profile workflows
- YouTube workflows

The app sends requests to n8n webhooks and records returned status.

## Storage

Use Supabase Storage.

Buckets:

- avatars
- uploads
- generated-images
- social-assets
- email-assets
- exports
- system-logs

## Deployment

Primary:

- GitHub repo: `jeremymac904/LegendsOSv2.0`
- Netlify connected to main or production branch
- Supabase project for backend

No Docker required for runtime.

No Cloudflare required for runtime.
