# API Keys and AI Providers

Most loan officers do **not** need their own API keys. Jeremy manages the team-wide keys for the AI providers LegendsOS uses.

You will only need your own key if Jeremy explicitly says "use your own key for X."

## Approved AI providers (managed by Jeremy team-wide)

| Provider | What it does | Who manages the key |
|---|---|---|
| OpenRouter | Multi-model text generation | Jeremy (team key) |
| DeepSeek | Default text generation in Atlas | Jeremy (team key) |
| Hugging Face | Specialty models when needed | Jeremy (team key) |
| OpenAI | Specialty audio/image/transcription | Jeremy (team key) |
| NVIDIA | Specialty inference when needed | Jeremy (team key) |
| Fal.ai | Image generation in Image Studio | Jeremy (team key) |

You should **never** see, paste, or echo any of those keys.

## When Jeremy might ask you to bring your own key

Rare cases:
- You're running a long personal experiment that shouldn't burn the team budget.
- You're testing a model that requires your own paid subscription.

If Jeremy asks for this, here's what to do:

1. Sign up at the provider's website yourself (using your work email).
2. Generate an API key inside the provider's dashboard.
3. **Do not paste the key into chat with anyone — including this GPT.**
4. In n8n, open Credentials → Create Credential → pick the right provider type (e.g. *OpenRouter API*, *DeepSeek API*).
5. Paste the key into the **n8n credential field** (the only correct place).
6. Save. The key is encrypted at rest inside n8n.

## What you NEVER do with an API key

- ❌ Email it to anyone.
- ❌ DM it or paste it into any chat or messaging tool, including Atlas, this Setup Coach, or any tool outside the approved Legends stack.
- ❌ Paste it into a Google Doc or a Sheet.
- ❌ Hardcode it into any custom script.
- ❌ Screenshot it.

## What you do if a key leaks

1. Tell Jeremy immediately.
2. Sign in to the provider's dashboard and **revoke** the leaked key.
3. Generate a new one.
4. Paste the new one into n8n's credential field only.
5. Document the incident in a quick note to Jeremy: when leaked, where it might have ended up, what you rotated.

## Quick check

If this GPT or anyone else ever asks you to paste a key, the answer is **no**. Keys belong in the credential field, not in chat.
