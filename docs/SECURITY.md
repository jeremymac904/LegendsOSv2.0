# Security model

## Authentication

- Supabase Auth (email + password and magic link).
- Sessions are stored in HTTP-only cookies; the middleware in
  `middleware.ts` refreshes the session on every request.

## Authorization

Three roles in `profiles.role`:

- `owner` — Jeremy. Cross-team read on everything in the organization.
  Manage users, providers, audit logs.
- `admin` — Optional. Read access to admin views the owner explicitly grants.
- `loan_officer` — Default. Only sees own rows, plus team-shared content.

Helper functions used in policies (all `SECURITY DEFINER`):

- `public.current_role()` → role of `auth.uid()`
- `public.is_owner()` → boolean
- `public.is_admin_or_owner()` → boolean
- `public.current_org_id()` → uuid

These bypass RLS on `profiles` and are safe to call from policies (no recursion).

## Row Level Security

RLS is enabled on **every** application table. Patterns:

- User-scoped tables (`chat_threads`, `social_posts`, `email_campaigns`,
  `calendar_items`, `generated_media`, `uploaded_files`,
  `knowledge_collections`, `knowledge_items`) — `user_id = auth.uid()` for
  read/write, plus an `is_owner()` read policy for the owner.
- Shared content (`shared_resources`) — read for everyone in the org;
  write only for the owner.
- Cross-user reads through joins (`chat_messages` joined on `chat_threads`,
  `retrieval_references` joined on `chat_messages`).
- Sensitive tables (`audit_logs`, `provider_credentials`) — owner read only;
  inserts/updates must go through the service role.

The `profiles_self_update` policy critically prevents self-promotion:

```sql
with check (id = auth.uid() and role = public.current_role())
```

A user can update their own profile, but `role` is forced to match what it
already is. Promotion happens through `public.promote_owner('email')` (run as
service role) or `profiles_owner_update`.

## Provider secrets

`provider_credentials.encrypted_secret` is **not granted** to the
`authenticated` role. Clients only ever see the
`provider_credentials_public` view, which strips that column. The encrypted
secret is reserved for server-side code using the service role.

The browser never sees provider keys; all third-party requests go through
server routes under `/api/ai/*`, `/api/social`, `/api/email`,
`/api/automation/*`.

## Storage policies

Bucket convention: object paths start with `<user_id>/...`. Policies derive
ownership from `storage.foldername(name)[1]`. The owner can read any bucket;
the team-shared bucket (`shared_resources`) is owner-write and all-read.

## n8n webhook signing

- All outbound webhooks include a header
  `X-Legendsos-Signature: <hex hmac sha256>` computed against the JSON body
  using `N8N_WEBHOOK_SECRET`.
- The inbound callback endpoint (`/api/automation/callback`) verifies this
  signature with constant-time-ish equality (Node `crypto`).
- Without `N8N_WEBHOOK_SECRET` set, dispatch is refused and jobs stay queued.

## Safety flags

Live external actions are double-gated:

1. The corresponding `ALLOW_*` env flag must be `true`.
2. A webhook URL must be configured for the workflow.

If either condition fails, the row is queued with `status='queued'` so the
owner can review it. Failure mode is "save and notify", not "drop and forget".

## Audit logging

`recordAudit(...)` in `lib/usage.ts` writes a row to `audit_logs` for every
sensitive action:

- `social_publish_requested`
- `email_send_requested`
- (extend as new sensitive actions are added)

These are visible only to the owner.
