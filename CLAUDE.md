# LegendsOS v2.0

Internal SaaS platform for The Legends Mortgage Team. Built on Next.js 14,
Supabase, Tailwind CSS, deployed on Netlify.

## Quick reference

- **Repo:** `jeremymac904/LegendsOSv2.0`
- **Production:** `https://legendsos.app`
- **Netlify site:** `legndsosv20` (yes, the typo is real)
- **Owner:** Jeremy McDonald (`jeremy@mcdonald-mtg.com`)

## Architecture

```
app/(app)/       → Authenticated pages (dashboard, atlas, social, email, etc.)
app/api/         → API routes (agents, ai, goat, integrations, webhooks)
components/      → React components organized by domain
lib/             → Business logic, providers, utilities
supabase/        → Migrations and seed files
```

### Key systems

- **Atlas Chat:** `app/api/ai/chat/` + `lib/ai/providers.ts` — the main AI assistant
- **Agent Runtime:** `app/api/agents/` + `lib/agents/runtime.ts` — FLO, Marketing Assistant, Coordinator
- **GOAT API:** `app/api/goat/` + `lib/goat/` — external Custom GPT actions (not used by UI)
- **Knowledge:** `app/(app)/knowledge/` — document upload + keyword retrieval
- **Social/Email Studios:** composer → draft → n8n webhook → publish
- **Training:** `app/(app)/training/` — academy tracks, coaching, AI training videos
- **Chief of Staff:** `app/(app)/chief-of-staff/` + `lib/chiefOfStaff/` — read-only daily "what matters today" briefing (rules over loans, contacts, leads, automations)

### Auth & permissions

- Supabase Auth with RLS on all tables
- Roles: `owner`, `admin`, `loan_officer`, `processor`, `coordinator`, `marketing`, `viewer`
- `lib/permissions.ts` gates sidebar items and page access
- Owner impersonation via `lib/impersonation.ts`

### Navigation

Sidebar has ~19 entries organized into 5 sections (Core, Mortgage, Studios,
Team, Owner). Sub-pages use in-page pill navigation:
- **AdminNav** (11 items): Overview, Setup, Connections, Users, Usage, Assets, Security, n8n, Leads, Memory, Skills
- **SettingsNav** (4 items): Settings, AI Voice, Memory, Skills
- **AcademyNav**: Training sub-sections

## Development

```bash
npm install
npm run dev          # Next.js dev server
npm run lint         # ESLint via next lint
npm run typecheck    # tsc --noEmit
npm run build        # Production build
npm run test:e2e     # Playwright smoke tests
```

**Node version:** 18 or 20 recommended. Next.js 14 does not support Node 22.

## Coding conventions

- Use `getSupabaseServerClient()` for server-side DB access
- Use `getEffectiveProfile()` for impersonation-aware profile loading
- All pages: check `if (!profile) return <EmptyState ... />`
- Owner-only pages: `if (!isOwner(profile)) redirect("/dashboard")`
- Commit messages: `[SECTION] description` (e.g., `[ATLAS] Fix thread loading`)
- Components in `components/ui/` are shared — don't duplicate

## Env vars

See `.env.example` for documented variables. Key ones:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`
- `OPENROUTER_API_KEY` / `DEEPSEEK_API_KEY` / `NVIDIA_API_KEY` / `FAL_KEY`
- `N8N_WEBHOOK_SOCIAL_PUBLISH` / `N8N_WEBHOOK_EMAIL_SEND`
- `GOAT_COMMAND_API_KEY`
- `ALLOW_LIVE_SOCIAL_PUBLISH` / `ALLOW_LIVE_EMAIL_SEND` (safety gates)

## Stub integrations

These are UI-present but not backend-wired. They show "Coming Soon" in the UI:
Zapier, Meta (FB/IG), Google OAuth, Google Drive, Google Calendar, Telegram,
HeyGen, YouTube, Google Business Profile.

## Docs

```
docs/
  architecture/    → System design, security, data models
  features/        → Per-feature docs (atlas, email-intake, loan-brain, etc.)
  goat_architect/  → Vision, PRD, decisions, build log
  archive/         → Point-in-time sprint reports
  video-walkthroughs/
  CHANGELOG.md
```
