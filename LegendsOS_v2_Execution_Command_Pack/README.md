# LegendsOS v2.0 Execution Command Pack

This pack is for Claude Code, DeepSeek/OpenCode, and ChatGPT Codex working inside the clean `LegendsOSv2.0` project folder.

This is not a continuation of the broken Docker, Cloudflare, injected shell, subdomain studio build.

The mission is to build a real production platform from a clean repo using:

- Next.js
- Supabase
- Netlify
- n8n
- OpenRouter
- DeepSeek
- NVIDIA where useful
- Fal.ai for image generation
- Postiz only as an integration if useful, never as the visible product shell

## Non negotiable decision

Do not rebuild the old architecture.

Do not preserve the old UI.

Do not use Docker or Cloudflare for the application runtime.

Do not use Onyx as the visible app shell.

Do not create subdomain studios.

Do not create borrower, realtor, public intake, LoanFlow, Mortgage Ops, Blog Studio, or extra modules.

## Final app scope

LegendsOS v2.0 has only these core modules:

1. Command Center
2. Atlas Chat, Hermes style internal agent chat
3. Social Studio
4. Image Generation Studio
5. Email Studio
6. Calendar
7. Admin and Usage Tracking
8. Settings and Integrations

Everything else is out of scope unless Jeremy explicitly adds it later.

## How to use this pack

1. Unzip this pack into the root of `LegendsOSv2.0`.
2. Start with `00_AI_CEO_MODE.md`.
3. Read `01_SOURCE_OF_TRUTH.md`.
4. Assign the sub agents in `/agents`.
5. Run the Ralph loop in `/loops/RALPH_LOOP.md`.
6. Do not build until scope, stack, database, and routing are reconciled.
7. Every work session must end with `HANDOFF.md`, `STATUS.md`, and `NEXT_ACTIONS.md`.

## GitHub target

Repository:

`git@github.com:jeremymac904/LegendsOSv2.0.git`

or HTTPS equivalent:

`https://github.com/jeremymac904/LegendsOSv2.0`
