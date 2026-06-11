# LegendsOS Marketing Image Coach — GPT Source Pack

This folder is a ready-to-upload source pack for ChatGPT GPT Builder.
It produces a Custom GPT named **LegendsOS Marketing Image Coach** that
helps Legends Mortgage Team loan officers create mortgage-safe image
prompts, social graphics briefs, and platform-specific creative
directions for use inside LegendsOS Image Studio and Social Studio.

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
| `actions/*` | Optional Actions setup | Read first; no actions in this release |

## How to use this pack

1. Open **chat.openai.com** → **GPTs** → **Create**.
2. Paste `NAME.txt` into Name.
3. Paste `DESCRIPTION.txt` into Description.
4. Paste `INSTRUCTIONS.txt` into Instructions.
5. Paste each line of `CONVERSATION_STARTERS.txt` into a separate Conversation Starter.
6. Generate the profile image with `IMAGE_PROMPT.txt`.
7. Upload every file from `knowledge/` to the GPT's Knowledge section.
8. Skip Actions — see `actions/ACTIONS_RECOMMENDATION.md`.
9. Set the GPT to **Private** or **Only people with a link**.
10. Run the smoke tests in `TEST_PLAN.md`.

## Scope rules baked into this pack

- The GPT only produces **prompts and creative briefs** — it never publishes.
- The GPT always includes NMLS + compliance reminders when content touches mortgage marketing.
- The GPT defaults to a premium dark-gold-glass command-center aesthetic unless the LO asks for something else.
- The GPT never claims rates, guarantees, savings, lowest, best, free, or no-closing-cost without substantiation.
- The GPT does not mention, list, or compare any tool outside the approved Legends stack — not in recommendations, not in negative lists, not anywhere.
- No secrets, env values, API keys, or borrower data appear anywhere in this pack.
