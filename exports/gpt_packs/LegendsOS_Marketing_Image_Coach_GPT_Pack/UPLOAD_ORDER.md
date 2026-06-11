# Upload Order — LegendsOS Marketing Image Coach

Follow this order when building the GPT in ChatGPT GPT Builder.

## Step 1 — Create the GPT
1. Open ChatGPT → **Explore GPTs** → **Create**.
2. Switch to the **Configure** tab.

## Step 2 — Paste configuration

| Field | Source |
|-------|--------|
| Name | `NAME.txt` |
| Description | `DESCRIPTION.txt` |
| Instructions | `INSTRUCTIONS.txt` (paste the full file) |
| Conversation Starters | `CONVERSATION_STARTERS.txt` — one line per starter slot |

## Step 3 — Generate the profile image
1. In the image area of GPT Builder, click **Generate**.
2. Paste the contents of `IMAGE_PROMPT.txt` as the prompt.

## Step 4 — Upload knowledge files

Upload these in any order:

1. `knowledge/MARKETING_IMAGE_SYSTEM.md`
2. `knowledge/MORTGAGE_MARKETING_SAFETY_RULES.md`
3. `knowledge/IMAGE_STUDIO_WORKFLOW.md`
4. `knowledge/SOCIAL_IMAGE_PROMPT_LIBRARY.md`
5. `knowledge/PLATFORM_IMAGE_SPECS.md`
6. `knowledge/HEADSHOT_AND_REFERENCE_IMAGE_GUIDE.md`
7. `knowledge/BRAND_STYLE_GUIDE.md`
8. `knowledge/COMPLIANCE_AND_NMLS_RULES.md`
9. `knowledge/PROMPT_TEMPLATES.md`
10. `knowledge/TROUBLESHOOTING.md`

## Step 5 — Capabilities

| Capability | Setting | Why |
|------------|---------|-----|
| Web Browsing | OFF | Knowledge files are the source of truth |
| DALL-E Image Generation | ON | Useful so the LO can preview the prompt before going to Image Studio |
| Code Interpreter | OFF | Not needed |
| Actions | NONE this release | See `actions/ACTIONS_RECOMMENDATION.md` |

## Step 6 — Visibility

Set to **Only people with a link** or **Private** — never publish to the public GPT Store. The brand voice is internal.

## Step 7 — Test

Run the smoke tests in `TEST_PLAN.md`. Pass before sharing.

## Step 8 — Share

Once tests pass, share the GPT link with the loan officer team. Add a line: "Use this to spin up image prompts. Image Studio still does the actual generation."
