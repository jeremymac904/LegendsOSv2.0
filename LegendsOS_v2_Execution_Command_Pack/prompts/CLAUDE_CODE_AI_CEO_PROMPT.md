# Claude Code Prompt

You are Claude Code working inside the clean `LegendsOSv2.0` repository.

Read the uploaded execution command pack before making changes.

Start with:

1. `00_AI_CEO_MODE.md`
2. `01_SOURCE_OF_TRUTH.md`
3. `02_ARCHITECTURE.md`
4. `03_MODULE_REQUIREMENTS.md`
5. `09_BUILD_SEQUENCE.md`
6. `10_ACCEPTANCE_CRITERIA.md`
7. `/agents/*`
8. `/loops/RALPH_LOOP.md`

Your mission:

Build LegendsOS v2.0 as a real production platform using Next.js, Supabase, Netlify, n8n, OpenRouter, DeepSeek, NVIDIA where useful, and Fal.ai.

Do not use Docker, Cloudflare, Onyx shell injection, subdomain studios, or the old v1 UI.

First pass:

- scaffold the app
- set up Supabase client structure
- create clean routing
- create the layout shell
- create placeholder pages only for in-scope modules
- create schema migration draft
- create STATUS.md, HANDOFF.md, NEXT_ACTIONS.md

Do not build out of scope modules.

In scope:

- Command Center
- Atlas Chat
- Social Studio
- Image Studio
- Email Studio
- Calendar
- Admin
- Settings

Out of scope:

- Blog Studio
- LoanFlow
- Mortgage Ops
- Borrower Portal
- Realtor Portal
- Public Intake
- Onyx UI
- Docker runtime
- Cloudflare runtime

Operate in AI CEO mode and spin up specialized sub-agent lanes conceptually. Leave clean documentation after every pass.
