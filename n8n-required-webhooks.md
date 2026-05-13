# n8n Environment Variables for LegendsOS 2.0

Import these into Netlify when n8n webhook URLs are ready.

## Required for n8n to show as "configured"

- `N8N_WEBHOOK_BASE_URL` — URL of your n8n instance (e.g. `https://n8n.yourdomain.com`)
- `N8N_WEBHOOK_SECRET` — shared secret for webhook request signing

The app checks `N8N_WEBHOOK_SECRET && N8N_BASE_URL` to determine if n8n is active.

## Individual webhook paths

These are **optional** — if empty, the app records the intent but does not make outbound calls. Add them as you set up each n8n workflow.

| Variable | Purpose |
|---|---|
| `N8N_WEBHOOK_SOCIAL_PUBLISH` | Social media publishing trigger |
| `N8N_WEBHOOK_EMAIL_SEND` | Email campaign send trigger |
| `N8N_WEBHOOK_DAILY_USAGE` | Daily usage summary webhook |
| `N8N_WEBHOOK_PROVIDER_HEALTH` | Provider health check webhook |
| `N8N_WEBHOOK_CONTENT_REMINDER` | Content reminder webhook |
| `N8N_WEBHOOK_FAILED_PUBLISH_RECOVERY` | Failed publish retry webhook |

## Also available but not yet wired to live workflows

- `N8N_WEBHOOK_GBP_POST` — Google Business Profile post
- `N8N_WEBHOOK_FACEBOOK_POST` — Facebook post
- `N8N_WEBHOOK_INSTAGRAM_POST` — Instagram post
- `N8N_WEBHOOK_YOUTUBE_POST` — YouTube post

## Legacy fallback for base URL

- `N8N_BASE_URL` — the app reads `N8N_WEBHOOK_BASE_URL` first, then falls back to `N8N_BASE_URL`

## Import note

Use Netlify's "Import from a .env file" feature. You can bulk-import these directly:
```
N8N_WEBHOOK_BASE_URL=
N8N_WEBHOOK_SECRET=
N8N_WEBHOOK_SOCIAL_PUBLISH=
N8N_WEBHOOK_EMAIL_SEND=
N8N_WEBHOOK_DAILY_USAGE=
N8N_WEBHOOK_PROVIDER_HEALTH=
N8N_WEBHOOK_CONTENT_REMINDER=
N8N_WEBHOOK_FAILED_PUBLISH_RECOVERY=
N8N_WEBHOOK_GBP_POST=
N8N_WEBHOOK_FACEBOOK_POST=
N8N_WEBHOOK_INSTAGRAM_POST=
N8N_WEBHOOK_YOUTUBE_POST=
N8N_BASE_URL=
```
