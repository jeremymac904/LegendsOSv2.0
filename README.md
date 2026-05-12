# LegendsOS 2.0

Internal AI operating system for **The Legends Mortgage Team powered by Loan Factory**.

One Next.js app. One Supabase project. One sidebar. One source of truth.

> This repo is a clean rebuild. Do **not** import patterns from the old v1
> Docker/Cloudflare/Onyx/subdomain build. See `docs/ARCHITECTURE.md`.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Backend:** Supabase Auth + Postgres + Storage + RLS
- **AI Gateway:** OpenRouter (default), DeepSeek, NVIDIA, Fal.ai — server-side only
- **Automation:** n8n via HMAC-signed webhooks (queue-by-default)
- **Hosting:** Netlify (`@netlify/plugin-nextjs`)

## Modules

| Module           | Route          | Status     |
| ---------------- | -------------- | ---------- |
| Command Center   | `/dashboard`   | scaffold ✓ |
| Atlas Chat       | `/atlas`       | scaffold ✓ |
| Source Knowledge | `/knowledge`   | scaffold ✓ |
| Shared Resources | `/shared`      | scaffold ✓ |
| Social Studio    | `/social`      | scaffold ✓ |
| Image Studio     | `/images`      | scaffold ✓ |
| Email Studio     | `/email`       | scaffold ✓ |
| Calendar         | `/calendar`    | scaffold ✓ |
| Admin Center     | `/admin`       | scaffold ✓ |
| Settings         | `/settings`    | scaffold ✓ |

## Local quick start

```bash
npm install
cp .env.example .env.local       # fill in Supabase keys at minimum
npm run dev                       # http://localhost:3000
```

Then in a separate shell, apply the SQL migrations against your Supabase
project (via dashboard SQL editor or `supabase db push`):

```text
supabase/migrations/20260512000000_init_schema.sql
supabase/migrations/20260512000100_rls_policies.sql
supabase/migrations/20260512000200_storage_buckets.sql
supabase/migrations/20260512000300_bootstrap.sql
```

The bootstrap migration auto-promotes `jeremy@mcdonald-mtg.com` (configurable
via `NEXT_PUBLIC_OWNER_EMAIL`) to the **owner** role on first signup.

## Scripts

```bash
npm run dev          # local dev
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run start        # next start (after build)
npm run test:e2e     # playwright (after install)
```

## Documentation

- `docs/SETUP.md` — full setup walkthrough
- `docs/ARCHITECTURE.md` — architecture and decisions
- `docs/SECURITY.md` — RLS, secrets, audit
- `docs/AUTOMATION.md` — n8n contracts and webhook signing
- `docs/STATUS.md` — what's complete vs incomplete
- `docs/HANDOFF.md` — last work block summary
- `docs/NEXT_ACTIONS.md` — prioritized next steps
- `docs/CHANGELOG.md` — release history

## Owner & team rules (enforced by RLS)

- **Owner** (`jeremy@mcdonald-mtg.com`) sees all users, all data, all jobs.
- **Loan officers** see only their own data plus team-shared resources.
- Provider secrets never reach the browser. The UI only shows status pills
  (`configured`, `missing`, `disabled`, `error`) and masked previews.
- Live publish/send is hard-gated by safety flags
  (`ALLOW_LIVE_SOCIAL_PUBLISH`, `ALLOW_LIVE_EMAIL_SEND`, etc.).

## Repository target

`git@github.com:jeremymac904/LegendsOSv2.0.git`
