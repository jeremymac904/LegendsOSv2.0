# LegendsOS 2.0 — Setup

## Prerequisites

- Node 18.18+ (project pins Node 20 for Netlify builds)
- npm 9+
- A Supabase project (free tier works for local dev)

## 1. Install

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.example .env.local
```

Required to boot at all:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required for server-side privileged operations (admin reads, automation jobs,
service-role audit writes):

- `SUPABASE_SERVICE_ROLE_KEY`

Optional but recommended:

- `NEXT_PUBLIC_OWNER_EMAIL` (defaults to `jeremy@mcdonald-mtg.com`)
- AI provider keys: `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `FAL_KEY`
- `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`, and per-workflow URLs

Safety flags default to `false` — flip them only when you are ready for live
external actions:

- `ALLOW_LIVE_SOCIAL_PUBLISH`
- `ALLOW_LIVE_EMAIL_SEND`
- `ALLOW_PAID_IMAGE_GENERATION`
- `ALLOW_PAID_TEXT_GENERATION`

## 3. Apply Supabase migrations

Open the Supabase SQL editor and run, in order:

1. `supabase/migrations/20260512000000_init_schema.sql`
2. `supabase/migrations/20260512000100_rls_policies.sql`
3. `supabase/migrations/20260512000200_storage_buckets.sql`
4. `supabase/migrations/20260512000300_bootstrap.sql`

Or with the Supabase CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

The bootstrap migration:

- Creates the **"The Legends Mortgage Team"** organization
- Installs a trigger so every new `auth.users` row gets a `profiles` row
- Auto-promotes `NEXT_PUBLIC_OWNER_EMAIL` (default `jeremy@mcdonald-mtg.com`)
  to the **owner** role and links the organization
- Seeds `provider_credentials` placeholders so Settings has something to render

## 4. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. You'll land on `/login`. Sign up using the owner
email so you get owner privileges immediately. Other team members signed up
afterward will start as `loan_officer` and can be promoted via:

```sql
select public.promote_owner('newowner@example.com');
```

## 5. Verify

- `/api/health` returns `{ ok: true, supabaseConfigured: true }`
- The dashboard at `/dashboard` shows your name and role
- Settings → Providers reflects the env vars you have set

## 6. Deploy to Netlify

1. Push the repo to GitHub.
2. Import the repo in Netlify; build command and publish dir come from
   `netlify.toml`.
3. Add the same env vars in Netlify → Site → Environment.
4. Add `https://<your-netlify-url>/auth/callback` to Supabase Auth → URL
   Configuration → Redirect URLs.

## Troubleshooting

- **`Missing required environment variable`** in the server log — the named env
  var is unset. Add it to `.env.local` or your Netlify env.
- **`No active profile`** after login — your `auth.users` row didn't trigger
  the bootstrap. Re-run `20260512000300_bootstrap.sql` and sign in again.
- **`provider_not_configured`** from the AI gateway — set the matching env
  var and reload the server.
