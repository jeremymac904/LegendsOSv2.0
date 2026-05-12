# n8n Automation contracts

The app talks to n8n via plain JSON HTTP webhooks. The current workflows are
sandbox-mode (no live sending, no Gmail, no real social publishing). HMAC
signing and the shared `N8N_WEBHOOK_SECRET` have been removed — the only
trust boundary is the server-issued UUID `job_id` we include in the payload.

```
POST <webhook_url>
Content-Type: application/json
X-Legendsos-Job-Id: <automation_jobs.id>
```

n8n posts results back to:

```
POST <APP_URL>/api/automation/callback
Content-Type: application/json

{
  "job_id": "uuid",
  "ok": true | false,
  "external_id": "string",
  "error": "string | null",
  "social_post_status": "published | failed",
  "external_post_ids": { "facebook": "..." }
}
```

The callback updates the `automation_jobs` row by id and propagates status
to `social_posts` / `email_campaigns` as applicable. External actions stay
gated by `ALLOW_LIVE_SOCIAL_PUBLISH` and `ALLOW_LIVE_EMAIL_SEND`; with both
off, the app saves drafts and queues `automation_jobs` rows but never calls
n8n.

## Workflows

### 1. social_publish

Trigger: app POST when a social post is scheduled and `ALLOW_LIVE_SOCIAL_PUBLISH=true`.

Body:
```json
{
  "post_id": "uuid",
  "body": "text",
  "channels": ["facebook", "instagram", "google_business_profile", "youtube"],
  "scheduled_at": "iso",
  "idempotency_key": "uuid"
}
```

Steps:
1. Verify signature.
2. Switch on channel; call `gbp_post`, `facebook_post`, `instagram_post`,
   `youtube_post` sub-workflows.
3. Aggregate channel results.
4. POST `/api/automation/callback` with `ok`, `external_post_ids`, error.

### 2. gbp_post / facebook_post / instagram_post / youtube_post

Sub-workflows. Each takes `post_id` plus channel-specific identifiers and
returns `{ ok, external_post_id, error }`.

### 3. email_send

Trigger: app POST when `ALLOW_LIVE_EMAIL_SEND=true`.

Body:
```json
{
  "campaign_id": "uuid",
  "subject": "text",
  "recipient_list": "string",
  "idempotency_key": "uuid"
}
```

Steps:
1. Pull HTML body from Supabase (service role) using `campaign_id`.
2. Send through Gmail / MailerLite / other connector.
3. POST callback.

### 4. daily_usage

Schedule: daily 08:00 local. Optional.

Pulls `usage_events` rollups via the Supabase REST API (service role) and
emails / Slacks a summary to the owner. Read-only.

### 5. provider_health

Schedule: hourly. Pings each provider's status endpoint (Supabase, OpenRouter,
Fal, n8n itself). Writes any errors to `audit_logs` via the callback.

### 6. content_reminder

Schedule: daily. Lists scheduled posts/emails due in next 24h. Optional.

### 7. failed_publish_recovery

Trigger: callback with `ok=false`. The callback endpoint already updates the
job; this workflow optionally notifies the owner.

## Signature helper (Node n8n function node)

```js
const crypto = require('crypto');
const body = JSON.stringify($json);
const sig = crypto
  .createHmac('sha256', $env.LEGENDSOS_SECRET)
  .update(body)
  .digest('hex');
const incoming = $headers['x-legendsos-signature'];
if (sig !== incoming) {
  throw new Error('Invalid signature');
}
return [{ json: $json }];
```

## Idempotency

Every dispatched payload includes `idempotency_key`. n8n workflows that
publish externally should de-duplicate on this key for at least 24h.
