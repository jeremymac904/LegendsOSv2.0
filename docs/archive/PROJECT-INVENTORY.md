# Project Inventory

_Generated 2026-05-20 — discovery only, no files edited or moved._

## Project Name

**LegendsOS 2.0** (`package.json` → `name: legendsos-v2`, `version: 2.0.0`).
Internal AI operating system for **The Legends Mortgage Team powered by Loan Factory**.

## Current Folder Path

`/Users/JeremyMcDonald/Desktop/LegendsOSv2.0`

A worktree also exists at `.claude/worktrees/epic-raman-5712ec/` (git index is corrupted there — operate from the main path).

## Git / Repo Info

- **Is this a git repo?** Yes
- **Current branch:** `main`
- **Remote origin:** `https://github.com/jeremymac904/LegendsOSv2.0.git`
- **Uncommitted changes:** Two untracked top-level dirs only — `.codex/` and `exports/` (the GPT-pack bundles and agent reports). No tracked-file modifications.
- **Ahead / behind:** Local `main` is **1 commit behind** `origin/main`. Pull before next sprint.
- **HEAD commit:** `12850af [UIUX] Complete PowerPoint sprint`
- **GitHub repo URL:** https://github.com/jeremymac904/LegendsOSv2.0

## Purpose

LegendsOS 2.0 is the live internal command center for Jeremy McDonald's mortgage team. It bundles ten modules behind a single Next.js + Supabase app:

1. **Command Center** (`/dashboard`) — KPIs, quick launch, recent activity, upcoming content.
2. **Atlas Chat** (`/atlas`) — AI assistant with deterministic tool-router (social / email / calendar drafts + `explain_capabilities`).
3. **Source Knowledge** (`/knowledge`) — team + private collections, retrieval references.
4. **Shared Resources** (`/shared`) — owner-managed prompts, templates, assets.
5. **Social Studio** (`/social`) — multi-channel composer, drafts only, sandboxed n8n queue.
6. **Image Studio** (`/images`) — Fal.ai generation, brand presets, library.
7. **Email Studio** (`/email`) — composer, audience picker, render preview.
8. **Calendar** (`/calendar`) — month grid + week strip, merges social + email + local items.
9. **Admin Center** (`/admin`, `/admin/users`, `/admin/usage`, `/admin/assets`) — owner-only.
10. **Settings** (`/settings`) — profile, safety flags, provider gateway snapshot.

Owner (`jeremy@mcdonald-mtg.com`) sees all data; loan officers see their own data plus team-shared resources. RLS enforces.

## Category

**Legends Team** (Loan Factory umbrella). It is the team's primary internal operating platform.

## Stack

- **Frontend:** Next.js 14.2.15 (App Router) + React 18 + TypeScript 5.6 + Tailwind 3.4 + `lucide-react` icons + `date-fns` + `clsx` + `tailwind-merge`
- **Backend:** Next.js API routes (server-side only for provider secrets), Zod for validation
- **Database:** Supabase Postgres (11 migrations covering schema, RLS, storage buckets, bootstrap, MCP connections, newsletter audiences, etc.)
- **Auth:** Supabase Auth + `@supabase/ssr` + RLS policies + middleware-level protection on every protected path
- **Hosting:** Netlify (live at `https://legndsosv20.netlify.app` per the project's prior verified deploys) using `@netlify/plugin-nextjs`
- **Automation:** n8n (cloud instance at `loanfactoryai.app.n8n.cloud`) via webhooks; HMAC-signing is implemented but currently relaxed per `docs/AUTOMATION.md`
- **AI / model providers:** OpenRouter (default text), DeepSeek, NVIDIA, Fal.ai (images) — all server-side via `lib/ai/providers.ts`
- **Storage:** Supabase Storage — 4 buckets (`uploads`, `knowledge`, `generated_media`, `shared_resources`)
- **Desktop:** Electron 32 + electron-builder (Mac DMG arm64+x64, Win NSIS x64, Linux AppImage). `electron/main.cjs` + `preload.cjs`.
- **Testing:** Playwright 1.48 + custom Node smoke harnesses under `scripts/`
- **Other tools:** `tsx` for TS scripts, `dotenv` for local env loading
- **CI / agent layer:** Claude Code agents under `.claude/agents/` (ten LegendsOS specialists) and commands under `.claude/commands/` (`legendsos-overnight.md`, `legendsos-sprint.md`)

## Key Files Detected

| File | Notes |
|---|---|
| `package.json` | Scripts, electron-builder config, deps |
| `README.md` | High-level overview, modules table, owner email |
| `STATUS.md` / `NEXT_ACTIONS.md` / `HANDOFF.md` | Pointer files → `docs/` |
| `netlify.toml` | Build + headers config |
| `next.config.mjs` | Next config |
| `middleware.ts` | Auth/route protection |
| `playwright.config.ts` | E2E config |
| `tailwind.config.ts` / `postcss.config.mjs` | Styling |
| `tsconfig.json` | TS config |
| `.env.example` | Public template — 23 variables |
| `.env.local` | **Local secrets — gitignored** (do not open) |
| `netlify-production-import.env` | **Production secret bundle — gitignored** (do not open) |
| `n8n-required-webhooks.md` | Required webhook contracts |
| `supabase/migrations/` | 11 SQL migrations |
| `scripts/` | 14 dev/smoke scripts |
| `docs/` | 27 docs (architecture, security, automation, status, etc.) |
| `.claude/agents/` | 10 LegendsOS specialist agents |
| `.claude/commands/` | 2 sprint commands (overnight, sprint) |
| `electron/` | Desktop shell (main, preload, icon, internal package.json) |
| `LegendsOS_v2_Execution_Command_Pack/` (+ zip) | Original v2 execution pack — kept per project rules |
| `exports/` (untracked) | GPT packs (Setup Coach, Marketing Image Coach) and Atlas reports built recently |
| `.codex/` (untracked) | Codex agent workspace |

No `vercel.json`, no `Dockerfile`, no `docker-compose.yml`, no Firebase config — confirmed absent (per project's anti-Docker/anti-Cloudflare rule in `docs/ARCHITECTURE.md`).

## Environment Variables Needed

Variable **names only** (from `.env.example` — values intentionally not printed):

Public (browser-safe):
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_COMPLIANCE_LINE`
- `NEXT_PUBLIC_OWNER_EMAIL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_TEAM_NAME`

Server-only (never exposed to browser):
- `SUPABASE_SECRET_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_DEFAULT_MODEL`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_DEFAULT_MODEL`
- `NVIDIA_API_KEY`
- `FAL_KEY`
- `FAL_DEFAULT_MODEL`

Safety / governance (all default off):
- `ALLOW_LIVE_SOCIAL_PUBLISH`
- `ALLOW_LIVE_EMAIL_SEND`
- `ALLOW_PAID_IMAGE_GENERATION`
- `ALLOW_PAID_TEXT_GENERATION`
- `DAILY_CAP_CHAT_MESSAGES`
- `DAILY_CAP_EMAIL_DRAFTS`
- `DAILY_CAP_IMAGE_GENERATIONS`
- `DAILY_CAP_SOCIAL_POSTS`

n8n webhook URLs + tokens (per `docs/AUTOMATION.md` and `n8n-required-webhooks.md`) are referenced as additional `N8N_*` variables in production; these are NOT in `.env.example` and live only in `netlify-production-import.env` and Netlify env settings.

## Secrets Risk

Files that contain or could contain secrets — **paths only**, contents not opened:

- `/Users/JeremyMcDonald/Desktop/LegendsOSv2.0/.env.local` (3,195 bytes — gitignored)
- `/Users/JeremyMcDonald/Desktop/LegendsOSv2.0/netlify-production-import.env` (gitignored)
- `/Users/JeremyMcDonald/Desktop/LegendsOSv2.0/.git/config` (may contain a remote URL with a credential helper reference — does not store the secret itself)

`.gitignore` correctly covers:
- `.env`
- `.env*.local`
- `netlify-production-import.env`

Provider secrets in Netlify are stored in Netlify's encrypted env panel (out-of-repo). The repo's UI/render path never reads `SUPABASE_SECRET_KEY` etc. into the browser.

## External Connections

- **Supabase** — Auth, Postgres, Storage, RLS (project URL stored in `NEXT_PUBLIC_SUPABASE_URL`).
- **Netlify** — Hosting + Next.js plugin + Atlas-checked `/api/health`. Production deploy URL: `https://legndsosv20.netlify.app` (per recent verified deploys).
- **n8n** — `https://loanfactoryai.app.n8n.cloud` (per `docs/AUTOMATION.md` + recent agent reports). Workflows execute social-draft / email-send queues in sandbox mode unless `ALLOW_LIVE_*` flags flip.
- **OpenRouter / DeepSeek / NVIDIA** — Text AI providers (server-side via `lib/ai/providers.ts`).
- **Fal.ai** — Image generation provider.
- **GitHub** — `jeremymac904/LegendsOSv2.0` (push target).
- **Atlas / Hermes** — Reports to `/Users/JeremyMcDonald/.hermes/atlas/agent_reports/` (per Atlas handoff convention).
- **Claude Code MCP servers (project-level):** the `.claude/agents/` roster expects access to plugin MCPs like `chrome-devtools-mcp`, `playwright`, `desktop-commander`, `supabase`, and the n8n MCP at `loanfactoryai.app.n8n.cloud/mcp-server/http`.

No GoHighLevel, HubSpot, Pipedrive, Mailchimp, Klaviyo, or other CRM/file-share third parties — anti-pattern per `docs/ARCHITECTURE.md`.

## Local Run Commands

From `package.json` (do not run as part of inventory; listing only):

| Command | Purpose |
|---|---|
| `npm install` | install deps |
| `npm run dev` | local dev → `http://localhost:3000` |
| `npm run build` | production build |
| `npm run start` | next start (after build) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Playwright suite |
| `npm run test:e2e:install` | install Chromium for Playwright |
| `npm run index-assets` | tsx scripts/index-local-assets.ts |
| `npm run seed-assistants` | tsx scripts/seed-atlas-assistants-from-local.ts |
| `npm run import-local-knowledge` | tsx scripts/import-local-knowledge.ts |
| `npm run desktop:dev` | run Electron against the deployed Netlify build |
| `npm run desktop:dev:local` | run Electron against `http://localhost:3000` |
| `npm run desktop:build` | electron-builder all targets |
| `npm run desktop:build:mac` | Mac DMG (arm64 + x64) + repair script |
| `npm run desktop:build:windows` | Windows NSIS x64 |
| `npm run desktop:rebuild-icon` | regenerate `electron/icon.png` via `sips` |

Plus 14 smoke / dev scripts under `scripts/` (atlas-smoke.mjs, asset-smoke.mjs, knowledge-smoke.mjs, users-smoke.mjs, impersonation-smoke.mjs, `_e2e_smoke.mjs`, etc.) — invoke via `node scripts/<file>` or `tsx scripts/<file>` with the right env loaded.

## Deployment Info

- **Hosting:** Netlify with `@netlify/plugin-nextjs`.
- **Site URL (per recent agent verifications):** `https://legndsosv20.netlify.app`.
- **Deploy trigger:** push to `origin/main` → automatic Netlify build → site live (~2 min).
- **Pre-deploy gates:** local `lint + typecheck + build` per the project's sprint rules; no manual approval needed for `main`.
- **Desktop builds:** local artifact under `dist-desktop/` (gitignored output dir per `package.json` build config).

## Production Risk

**HIGH — this is the team's live production platform.** Any change has the potential to affect:

- Live loan officer logins (Supabase auth, owner role policies).
- Owner role for `jeremy@mcdonald-mtg.com` (RLS-enforced — must not be revoked or deleted).
- Drafted social posts, email campaigns, calendar items in production tables.
- Knowledge collections with team-shared content.
- Atlas chat threads and tool-call audit logs.
- n8n sandboxed automation queues (currently inactive `ALLOW_LIVE_*` flags — flipping any of them would publish real social posts or send real email).
- The 6 inactive n8n workflows recently created (Daily Coaching Email, Daily Ops Summary, LO Support Deflection, Post-Onboarding Routing, LO Feedback Routing, Lender Escalation Audit Log) — must remain inactive unless Jeremy explicitly activates each.
- Netlify env values (`SUPABASE_SECRET_KEY`, provider API keys) — rotating any of these will break the live site instantly.

Do not:
- Edit Supabase migrations retroactively (write new migrations instead).
- Flip any `ALLOW_LIVE_*` or `ALLOW_PAID_*` flag without Jeremy's direct approval.
- Push to `main` without lint + typecheck + build + smoke green.
- Touch `netlify-production-import.env`, `.env.local`, or any file under `.git/`.
- Activate or delete n8n workflows in `loanfactoryai.app.n8n.cloud` without instruction.

## Recommended Destination in Master Folder

`/Volumes/LegendsOS/Jeremy's_2026_Master_Build_Folder/Legends_Team/LegendsOSv2.0/`

Rationale: this is the Legends Mortgage Team's primary internal OS. It deserves a first-class slot under `Legends_Team/`, separate from personal AI builds (Atlas/Hermes, BlackFrame, Portable AI) and separate from coaching content. The folder name should match the GitHub repo for cross-reference.

## Copy / Move Recommendation

**Leave in place** (with a **safe-to-copy-later snapshot** option).

Reasons:
1. The live working tree is at `~/Desktop/LegendsOSv2.0`. Hermes, Atlas, and the `.claude/agents/` roster all reference that path. Moving it would break the agent-report convention and the broken-worktree path.
2. The repo is wired to GitHub and Netlify — the build pipeline assumes this path.
3. Untracked `.codex/` and `exports/` directories contain in-flight deliverables; moving the parent would scatter them.

**Suggested approach for the master folder:** create a **clone snapshot** under `Legends_Team/LegendsOSv2.0_snapshot_2026-05-20/` (a fresh `git clone` of the GitHub repo) so the master folder has a clean reference copy. The working development tree stays at `~/Desktop/LegendsOSv2.0`.

## Notes / Open Questions

- **`main` is 1 commit behind `origin/main`.** Confirm with Jeremy whether he wants a `git pull --ff-only` before the next sprint to bring the local tree to parity. I did **not** run it as part of this inventory.
- **Untracked directories** (`.codex/`, `exports/`) are intentionally not committed — they hold the Codex workspace and the GPT-pack export bundles. Confirm whether either should be added to `.gitignore` explicitly (they currently rely on default ignores plus the implicit "untracked" status).
- **`.claude/worktrees/epic-raman-5712ec/`** has a corrupted git index. Decide whether to garbage-collect with `git worktree prune` (out of scope for this discovery).
- **Desktop artifacts** (`build/`, `dist-desktop/`, `test-results/`) are present at top-level — confirm they're gitignored (they appear to be, based on the absence of git status noise).
- **Netlify-production-import.env** lives in the repo root. Confirm Jeremy is aware it's gitignored AND that he has a separate backup (e.g. 1Password vault) — losing this file means re-collecting every provider key.
- **GPT-pack bundle** under `exports/gpt_packs/` is the cleaned, scrubbed source for ChatGPT Builder. It's not part of the deployed app — it's a build artifact for Jeremy to upload manually. Decide whether to ship a copy into the master folder under `Legends_Team/GPT_Packs/` for easy retrieval later.
- **No SignalCraft, BlackFrame, or Portable AI code is in this repo** — confirmed clean separation per the Atlas project-ownership map.
- **The .claude/agents and .claude/commands roster** is part of the repo and tracked — it's the agent system that powers `/legendsos-overnight` and `/legendsos-sprint`. Treat it as production code.
