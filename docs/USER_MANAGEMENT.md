# User Management

How LegendsOS adds, edits, deactivates, and "previews-as" users — without
ever shipping the Supabase service-role key to the browser.

## Where it lives

- **UI:** `/admin/users` (owner only). Implemented in
  `app/(app)/admin/users/page.tsx` + `components/admin/UserManager.tsx`.
- **API:** `app/api/admin/users/route.ts` (single endpoint, `action`
  discriminator).
- **Impersonation:** `app/api/admin/impersonate/route.ts`, banner in
  `components/admin/ImpersonationBanner.tsx`, server helper in
  `lib/impersonation.ts`.

## Roles

| Value (DB) | UI label | What they see |
| --- | --- | --- |
| `owner` | Owner | Everything. Only one per org. |
| `admin` | Admin | Full app, can't change roles or providers. |
| `loan_officer` | LO | Atlas, social, image, knowledge. |
| `processor` | Processor | Operations team — read-mostly. |
| `marketing` | Marketing | Owns social, email, image, audience. |
| `viewer` | Viewer | Read-only dashboards. |

Roles live in the Postgres enum `public.user_role`. The migration
`20260513000000_extend_user_roles.sql` adds the four new ones to the
original three (`owner`, `admin`, `loan_officer`). RLS already uses
`current_role()` for gating, so policies pick up the new values
automatically.

## Operations

### Add a user

```
POST /api/admin/users
{ "action": "add", "email": "...", "full_name": "...", "role": "loan_officer" }
```

1. Server confirms the caller is the owner.
2. `supabase.auth.admin.createUser({ email, email_confirm: true })` creates
   the auth row. No password is set — the user signs in via magic link.
3. The bootstrap trigger inserts a matching `profiles` row; the API
   updates `role` / `organization_id` / `full_name` to match the form.
4. `supabase.auth.admin.generateLink({ type: 'magiclink' })` returns an
   invite URL. The UI shows it for manual delivery in case Supabase email
   isn't configured.
5. An `audit_logs` row is recorded.

### Change role

```
POST /api/admin/users
{ "action": "update_role", "user_id": "...", "role": "marketing" }
```

Routes through the user-scoped Supabase client so the UPDATE shows up
under the owner's session. `profiles.role` is updated; RLS handles the
rest.

To **promote** a user to `owner`, run from the Supabase SQL editor:

```sql
select public.promote_owner('teammate@example.com');
```

The UI deliberately does not let you create new owners — that decision
should be deliberate and SQL-logged.

### Deactivate

```
POST /api/admin/users
{ "action": "set_active", "user_id": "...", "is_active": false }
```

1. `profiles.is_active = false` — the UI gating (everything reads this
   column) immediately stops showing the app to that user.
2. `supabase.auth.admin.updateUserById(user_id, { ban_duration: '876000h' })`
   blocks the actual sign-in. Reactivation sets `ban_duration: 'none'`.

### Reset password

```
POST /api/admin/users
{ "action": "reset_password", "user_id": "..." }
```

Returns a recovery action_link the owner can deliver out-of-band. The
user clicks it and is prompted to set a new password.

## Preview-as-user (impersonation)

> This is a **UI-level preview only**. It does NOT swap your Supabase
> session. RLS still treats you as the owner, so you'll see what the user
> would see if their role had owner-equivalent read access. Use it to
> verify sidebar items, role gates, and visible dashboards — not to test
> RLS enforcement.

How it works:

1. Owner clicks the "eye" button next to a user on `/admin/users`.
2. Browser POSTs `/api/admin/impersonate { user_id }`.
3. Server sets a `legendsos-impersonate` cookie (HttpOnly, SameSite=Lax,
   24h) whose value is the target user_id.
4. `getEffectiveProfile()` in `lib/impersonation.ts` reads the cookie on
   every request. If present and the real user is owner, it loads the
   target user's profile via the service-role client and returns that as
   the "effective" profile.
5. The protected layout renders the orange `ImpersonationBanner` and
   passes the impersonated profile to all child components, so sidebar +
   role gates render as that user.
6. Clicking "Stop preview" POSTs the same endpoint with `user_id: null`,
   which clears the cookie. `DELETE /api/admin/impersonate` also works.

Audit log entries are recorded as `impersonation_started` /
`impersonation_ended`.

### Why not a real session swap?

Swapping the auth session would require:

- Issuing a refresh token for the target user via Auth Admin API.
- Rewriting `sb-<ref>-auth-token` cookies in the browser.
- Trusting that we restore the owner's session correctly when "Stop
  preview" is clicked.

Each step is a footgun. The UI-only approach keeps the owner firmly in
control of the actual session, while still letting them verify
role-based views.

### Sharp edges

- A non-owner cookie is ignored. If a user's role is downgraded after
  the cookie was set, the next request silently treats them as their
  current role.
- Writes happen as the owner. Don't use preview mode to test access
  denial — use a real test user instead.
- The cookie expires after 24h. Re-click the preview button to refresh.

## Security model

- `SUPABASE_SECRET_KEY` (a.k.a. `SUPABASE_SERVICE_ROLE_KEY`) only ever
  lives in the server environment. The Auth Admin client is created in
  `getSupabaseServiceClient()`.
- The owner gate (`isOwner(profile)`) is checked on every privileged
  route before any service-role action runs.
- The cookie is HttpOnly + SameSite=Lax. JavaScript on the page can't
  read it; cross-site requests don't carry it.
- All mutations are recorded in `audit_logs`.

## Manual operations cheat sheet

Sometimes the SQL editor is faster:

```sql
-- Promote a user to owner (only owners can call this function)
select public.promote_owner('teammate@example.com');

-- Manually deactivate
update public.profiles set is_active = false where email = '…';

-- Change role
select public.set_user_role(
  (select id from public.profiles where email = '…'),
  'marketing'
);

-- See who's an active member of your org
select email, role, is_active, last_seen_at
  from public.profiles
 where organization_id = (
   select organization_id from public.profiles where email = 'jeremy@…'
 )
 order by role, created_at;
```
