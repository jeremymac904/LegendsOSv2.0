# AI Provider Gateway

## Purpose

All AI calls must go through a server side gateway.

Do not call AI providers directly from the browser.

## Approved providers

### Text

- OpenRouter
- DeepSeek through OpenRouter or direct when configured
- NVIDIA where useful

### Images

- Fal.ai

### Optional future

- Other OpenRouter models
- Provider specific endpoints only if needed

## Excluded unless Jeremy later approves

- Gemini as image generation default
- ElevenLabs voice
- any paid provider without explicit key and cost cap

## Gateway responsibilities

- Validate authenticated user
- Validate role
- Check provider configuration
- Enforce daily cap
- Estimate cost
- Execute request
- Store output if required
- Write usage event
- Return normalized response

## Daily caps

Suggested defaults:

- text chats: 100 messages per user per day
- image generations: 10 per user per day
- social post generations: 50 per user per day
- email drafts: 25 per user per day

Owner can override caps.

## Error format

All provider errors should return:

```json
{
  "ok": false,
  "error": "provider_not_configured",
  "provider": "fal",
  "message": "Fal.ai is not configured. Add FAL_KEY in Settings.",
  "env_var": "FAL_KEY"
}
```

## Success format

```json
{
  "ok": true,
  "provider": "fal",
  "model": "model-name",
  "asset_id": "uuid",
  "url": "signed-url-or-storage-path",
  "usage": {
    "daily_count": 1,
    "daily_limit": 10
  }
}
```

## Logging

Log metadata only.

Do not store raw secrets.

Do not store sensitive borrower data in AI logs.

For image prompts, store prompt only if user confirms project policy allows it. Otherwise store prompt hash and summary metadata.
