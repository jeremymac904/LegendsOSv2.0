# LegendsOS Setup Coach — GPT Source Pack

This folder is a ready-to-upload source pack for ChatGPT GPT Builder.
It produces a Custom GPT named **LegendsOS Setup Coach** that helps
Legends Mortgage Team loan officers set up their LegendsOS account,
connect approved Google Workspace tools, connect approved social
accounts, and (only when assigned) connect n8n or Zapier MCP.

## What's in this pack

| File | What it is | Used in GPT Builder |
|------|------------|---------------------|
| `NAME.txt` | The GPT name | Paste into the **Name** field |
| `DESCRIPTION.txt` | The GPT description | Paste into the **Description** field |
| `INSTRUCTIONS.txt` | The full system instructions | Paste into the **Instructions** field |
| `CONVERSATION_STARTERS.txt` | The 4 starter prompts | Paste each into a **Conversation Starter** slot |
| `IMAGE_PROMPT.txt` | The profile image generation prompt | Use to generate the GPT profile picture |
| `KNOWLEDGE_INDEX.md` | List of knowledge docs in upload order | Reference while uploading |
| `UPLOAD_ORDER.md` | Step-by-step build order | Follow when setting up |
| `GPT_BUILDER_CONFIG.md` | Recommended GPT Builder settings | Reference for capabilities + privacy |
| `ACTIONS_RECOMMENDATION.md` | Actions guidance | See `actions/` folder |
| `TEST_PLAN.md` | Post-build smoke tests | Run after creation |
| `CHANGELOG.md` | Version history of this pack | Updated when content changes |
| `knowledge/*.md` | The actual knowledge base | Upload all to the **Knowledge** section |
| `actions/*` | Optional Actions setup | Read first; most LOs do not need actions |

## How to use this pack

1. Open **chat.openai.com** → **GPTs** → **Create**.
2. Paste `NAME.txt` into Name.
3. Paste `DESCRIPTION.txt` into Description.
4. Paste `INSTRUCTIONS.txt` into Instructions.
5. Paste each line of `CONVERSATION_STARTERS.txt` into a separate Conversation Starter.
6. Generate the profile image with `IMAGE_PROMPT.txt`.
7. Upload every file from `knowledge/` to the GPT's Knowledge section.
8. Skip Actions for now — see `actions/ACTIONS_RECOMMENDATION.md`.
9. Set the GPT to **Private** or **Only people with a link** depending on Jeremy's call.
10. Run the smoke tests in `TEST_PLAN.md`.

## Scope rules baked into this pack

- Only Legends-approved tools are mentioned: LegendsOS, n8n, Google Workspace, Meta (Facebook + Instagram), Google Business Profile, YouTube, OpenRouter / DeepSeek / Hugging Face / OpenAI / NVIDIA / Fal.ai, Zapier MCP (when assigned), Canva (only if Jeremy approves).
- Anything outside the approved Legends stack is intentionally not mentioned, listed, or compared to — not in recommendations, not in negative lists, not anywhere.
- No secrets, API keys, OAuth tokens, env values, production credentials, or borrower data appear anywhere in this pack.
- Loan officers are explicitly told NOT to create, edit, delete, publish, or activate n8n workflows.
