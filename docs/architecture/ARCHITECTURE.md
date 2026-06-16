# Architecture

## Goals

- One Next.js app, one Supabase project, one domain, one sidebar.
- Role-aware UI; **RLS is the security layer**, not the UI gate.
- Every external action is owner-gated and audited.
- No Docker/Cloudflare/Onyx leakage from the v1 era.

## Layers

```
Browser
  └─ Next.js (App Router)
       ├─ Server Components → Supabase (RLS-respecting, cookie session)
       ├─ Server Routes /api/* → Supabase (anon) + service role for privileged ops
       │     ├─ AI Gateway (OpenRouter, DeepSeek, NVIDIA, Fal)
       │     ├─ Social/Email submit endpoints
       │     └─ n8n callback receiver (HMAC verified)
       └─ Client Components → Supabase browser client (RLS-respecting)

n8n
  └─ HMAC-signed inbound webhooks
       └─ POST back to /api/automation/callback with same HMAC
```

## Directory map

```
/app
  /(app)              # protected layout (sidebar + topbar)
    /dashboard
    /atlas
    /knowledge
    /shared
    /social
    /images
    /email
    /calendar
    /admin
    /settings
  /login              # public
  /setup              # shown when Supabase env is missing
  /auth/callback      # magic-link / OAuth code exchange
  /api
    /health
    /ai/chat
    /ai/image
    /ai/status
    /social
    /email
    /automation/callback
/components
  /auth
  /shell              # Sidebar, TopBar, MobileNav
  /atlas
  /knowledge
  /shared
  /social
  /images
  /email
  /calendar
  /ui                 # StatCard, StatusPill, EmptyState, SectionHeader
/lib
  /supabase           # client.ts, server.ts, middleware.ts
  /ai                 # providers.ts, types.ts
  /automation         # n8n.ts (HMAC sign + dispatch + verify)
  env.ts
  navigation.ts
  permissions.ts
  usage.ts            # logUsage, recordAudit, checkDailyCap
  utils.ts
/types
  database.ts         # hand-typed schema mirror
/supabase
  /migrations
    20260512000000_init_schema.sql
    20260512000100_rls_policies.sql
    20260512000200_storage_buckets.sql
    20260512000300_bootstrap.sql
/docs                 # SETUP, ARCHITECTURE, SECURITY, AUTOMATION, STATUS, etc.
```

## Data model snapshot

19 tables + 1 view, listed in `04_DATA_MODEL.md`:

`organizations`, `profiles`, `organization_members`, `atlas_assistants`,
`chat_threads`, `chat_messages`, `uploaded_files`, `knowledge_collections`,
`knowledge_items`, `retrieval_references`, `assistant_knowledge_access`,
`shared_resources`, `generated_media`, `social_posts`, `email_campaigns`,
`calendar_items`, `automation_jobs`, `usage_events`, `audit_logs`,
`provider_credentials` (plus the `provider_credentials_public` view).

## RLS summary

- Each user can `select` only their own rows in user-scoped tables.
- `is_owner()` and `is_admin_or_owner()` SECURITY DEFINER functions guard
  organization-wide reads.
- `provider_credentials` revokes column access from `authenticated`; only the
  service role can read `encrypted_secret`. Clients read the
  `provider_credentials_public` view.
- Storage policies bucket by `<user_id>/...` prefix; the `shared_resources`
  bucket is owner-write, all-read.

## Safety gates (server env)

| Flag                          | Default | Effect                                         |
| ----------------------------- | ------- | ---------------------------------------------- |
| `ALLOW_LIVE_SOCIAL_PUBLISH`   | false   | n8n social webhook is queued, not dispatched   |
| `ALLOW_LIVE_EMAIL_SEND`       | false   | n8n email webhook is queued, not dispatched    |
| `ALLOW_PAID_IMAGE_GENERATION` | false   | Fal.ai calls return `live_action_blocked`      |
| `ALLOW_PAID_TEXT_GENERATION`  | false   | OpenRouter/DeepSeek/NVIDIA calls are blocked   |

Even when flags are off the app still records `automation_jobs`, `usage_events`,
and `audit_logs` so Jeremy has full visibility before flipping anything on.

## Out of scope (do not build)

- Blog Studio
- LoanFlow
- Mortgage Ops
- Borrower Portal
- Realtor Portal
- Public Intake
- Onyx UI / subdomain studios
- Docker / Cloudflare runtime dependencies
- Approval queue table, compliance review layer, feature flags table,
  quota table, contact-list system

See `01_SOURCE_OF_TRUTH.md` for the authoritative list.
