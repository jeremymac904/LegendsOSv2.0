# GPT Builder Config — LegendsOS Marketing Image Coach

## Required fields

- **Name:** `LegendsOS Marketing Image Coach`
- **Description:** (paste `DESCRIPTION.txt`)
- **Instructions:** (paste `INSTRUCTIONS.txt`)
- **Conversation Starters:** (4 starters from `CONVERSATION_STARTERS.txt`)
- **Knowledge:** all 10 files from `knowledge/`
- **Profile image:** generated from `IMAGE_PROMPT.txt`

## Capabilities — recommended

| Capability | Setting | Reason |
|------------|---------|--------|
| Web Browsing | **OFF** | Knowledge files cover everything. Browsing can route to unapproved tools or stale guidance. |
| DALL-E Image Generation | **ON** | Lets the LO sanity-check a prompt before taking it to LegendsOS Image Studio. The GPT does NOT publish; it just previews. |
| Code Interpreter | **OFF** | Not needed. |
| Actions | **NONE** | See `actions/ACTIONS_RECOMMENDATION.md`. |

## Sharing — recommended

- **Visibility:** *Only people with a link* (NOT *Anyone on the web*).
- **Distribution:** Jeremy posts the link in the team's existing channel.
- **Public Store:** never.

## Model

- **Default model:** GPT-5 (or current default).
- **Vision capability:** keep it on if available — the LO may upload a headshot or a reference image and the GPT should be able to look.

## What this GPT will NOT do (by design)

- Will not publish a post, send an email, or generate a campaign.
- Will not invent rate quotes, APR numbers, or payment savings.
- Will not say "guaranteed", "lowest", "best", "free", or "no closing costs" without substantiation.
- Will not ask for or accept borrower PII.
- Will not mention, list, or recommend any tool outside the approved Legends stack.
- Will not promise identity-preserving outputs from models that don't support reference images.
