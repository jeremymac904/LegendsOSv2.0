# Upload Order — LegendsOS Setup Coach

Follow this order when building the GPT in ChatGPT GPT Builder.

## Step 1 — Create the GPT
1. Open ChatGPT → **Explore GPTs** → **Create**.
2. Switch to the **Configure** tab (skip the chat-builder).

## Step 2 — Paste configuration

| Field | Source |
|-------|--------|
| Name | `NAME.txt` |
| Description | `DESCRIPTION.txt` |
| Instructions | `INSTRUCTIONS.txt` (paste the full file) |
| Conversation Starters | `CONVERSATION_STARTERS.txt` — one line per starter slot |

## Step 3 — Generate the profile image
1. In the image area of GPT Builder, click **Generate** or upload your own.
2. If generating, paste the contents of `IMAGE_PROMPT.txt` as the prompt.

## Step 4 — Upload knowledge files

Upload these in any order (GPT Builder treats them as a flat pool), but make sure every file lands:

1. `knowledge/LEGENDSOS_SETUP_OVERVIEW.md`
2. `knowledge/N8N_TEAM_MEMBER_SETUP.md`
3. `knowledge/GOOGLE_WORKSPACE_CREDENTIALS.md`
4. `knowledge/SOCIAL_MEDIA_CREDENTIALS.md`
5. `knowledge/ZAPIER_MCP_SETUP.md`
6. `knowledge/API_KEYS_AND_AI_PROVIDERS.md`
7. `knowledge/WHAT_NOT_TO_TOUCH.md`
8. `knowledge/TROUBLESHOOTING.md`
9. `knowledge/LEGENDSOS_SECURITY_RULES.md`

## Step 5 — Capabilities

| Capability | Setting | Why |
|------------|---------|-----|
| Web Browsing | OFF | Not needed — the coach uses the knowledge files |
| DALL-E Image Generation | OFF | This GPT does not generate images |
| Code Interpreter | OFF | Not needed |
| Actions | (see `actions/ACTIONS_RECOMMENDATION.md`) | None right now — read the file |

## Step 6 — Visibility

Set to **Only people with a link** (or **Private**) — never **Anyone with the link can find on Search**. This GPT references internal Legends tools and is not a public asset.

## Step 7 — Test

Run the smoke tests in `TEST_PLAN.md`. If anything fails, see `CHANGELOG.md` for the latest fix notes.

## Step 8 — Share

Once tests pass, share the GPT link with the loan officer team. Add a single line: "Use this GPT to walk through setup. Ping Jeremy if it ever says to talk to him."
