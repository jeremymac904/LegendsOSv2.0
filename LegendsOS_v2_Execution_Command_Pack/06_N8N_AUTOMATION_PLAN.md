# n8n Automation Plan

n8n is used for automation execution, not app UI.

The app sends controlled webhook requests to n8n and receives status updates.

## Workflow 1: Publish Social Post

Trigger:

- App webhook from Social Studio

Input:

```json
{
  "post_id": "uuid",
  "user_id": "uuid",
  "channels": ["facebook", "instagram", "google_business_profile", "youtube"],
  "caption": "text",
  "image_url": "url",
  "scheduled_at": "iso timestamp"
}
```

Steps:

1. Validate post id
2. Pull post data from Supabase
3. Publish or schedule per channel
4. Return execution id
5. Update social_posts status

## Workflow 2: Google Business Profile Post

Input:

```json
{
  "business_profile_id": "string",
  "caption": "text",
  "image_url": "url",
  "cta_url": "url"
}
```

Output:

```json
{
  "ok": true,
  "platform": "google_business_profile",
  "external_post_id": "string"
}
```

## Workflow 3: Facebook Page Post

Input:

```json
{
  "page_id": "string",
  "caption": "text",
  "image_url": "url"
}
```

## Workflow 4: Instagram Business Post

Input:

```json
{
  "ig_business_account_id": "string",
  "caption": "text",
  "image_url": "url"
}
```

## Workflow 5: YouTube Community or Shorts Draft

Input:

```json
{
  "channel_id": "string",
  "title": "text",
  "description": "text",
  "asset_url": "url"
}
```

## Workflow 6: Email Newsletter Send

Input:

```json
{
  "email_draft_id": "uuid",
  "subject": "text",
  "html": "string",
  "recipient_list_id": "string"
}
```

## Workflow 7: Daily Usage Summary

Schedule:

- Daily 8 AM

Output:

- Usage summary to Jeremy
- Module usage
- inactive users
- failed automations

## Workflow 8: Provider Health Check

Schedule:

- Hourly

Checks:

- Supabase
- OpenRouter
- Fal
- n8n
- Postiz if used

## Workflow 9: Content Calendar Reminder

Schedule:

- Daily

Finds:

- social posts due today
- email drafts pending approval
- empty content days

## Workflow 10: Failed Publish Recovery

Trigger:

- Failed social post status

Steps:

- identify failed channel
- retry if safe
- notify owner if not safe

## n8n security

All webhooks must require a shared secret or signed token.

Do not expose public unauthenticated publishing webhooks.
