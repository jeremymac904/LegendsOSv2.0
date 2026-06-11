# GPT Builder Config — LegendsOS Setup Coach

Recommended settings for the **Configure** tab in ChatGPT GPT Builder.

## Required fields

- **Name:** `LegendsOS Setup Coach`
- **Description:** (paste `DESCRIPTION.txt`)
- **Instructions:** (paste `INSTRUCTIONS.txt`)
- **Conversation Starters:** (4 starters from `CONVERSATION_STARTERS.txt`)
- **Knowledge:** all 9 files from `knowledge/`
- **Profile image:** generated from `IMAGE_PROMPT.txt`

## Capabilities — recommended

| Capability | Setting | Reason |
|------------|---------|--------|
| Web Browsing | **OFF** | Knowledge files are the source of truth. Browsing could route LOs to unapproved tools. |
| DALL-E Image Generation | **OFF** | This GPT is text-only. Image work belongs to the Marketing Image Coach. |
| Code Interpreter | **OFF** | LOs are not running code. |
| Actions | **NONE** (this release) | See `actions/ACTIONS_RECOMMENDATION.md`. No live actions are configured. |

## Sharing — recommended

- **Visibility:** *Only people with a link* (NOT *Anyone on the web*).
- **Share method:** Jeremy posts the GPT link in the team's existing channel.
- **Do NOT** publish to the public GPT Store.

## Model

- **Default model:** GPT-5 (or whichever is the current GPT Builder default).
- **Reasoning:** Not required for this assistant — it's a setup walkthrough, not deep reasoning.

## Privacy + safety toggles

- **"Use conversation data to improve our models for everyone":** Off if available at the workspace level.
- **Custom instructions for personal account:** Not required — this GPT runs the same way for every LO.

## What this GPT will NOT do (by design)

- Will not send live email, publish social, or activate n8n workflows.
- Will not read live LegendsOS data.
- Will not ask for or accept secrets in chat.
- Will not mention, list, or recommend any tool outside the approved Legends stack.
