# LegendsOS v2.0 Production Hotfix Sprint Results

**Date:** 2026-06-11
**Sprint Lead:** Claude (Principal SW Architect / QA Lead / Security Auditor)

---

## Track 1: Google Social Destinations ("Setup Needed")

**Root Cause:** NOT A BUG -- this is a missing feature. The entire Google Social publishing path (YouTube, GBP) was designed as an ENV-var-only stub delegating to n8n webhooks. There is:
- No Google OAuth callback handler for social account linking
- No `social_account_connections` database table
- No YouTube Data API or GBP API client code
- No destination discovery logic anywhere in the codebase

**Status:** The "Setup Needed" pills are CORRECT -- they reflect that `N8N_WEBHOOK_YOUTUBE_POST`, `N8N_WEBHOOK_GBP_POST`, `GBP_ACCOUNT_ID`, `GBP_LOCATION_ID`, and `YOUTUBE_CHANNEL_ID` env vars are not set.

**Fix Path (Zapier-First):** Per Track 6, all direct social publishing should go through Zapier MCP. The Zapier MCP connector is already available via connected tools. No code changes needed -- wire up Zapier actions for YouTube/GBP posting via the MCP connection in Settings, and set the corresponding env vars.

---

## Track 2: Blank Screen Pages

**Root Cause:** 21 pages in `app/(app)/` had `if (!profile) return null;` which renders a completely blank page when `getCurrentProfile()` returns null (session timeout, temporary DB issue). The global error boundary (`app/error.tsx`) does NOT catch this because `return null` is a valid React return -- it's not an error.

**Fix Applied:** Created `components/ui/ProfileError.tsx` -- a client component that shows "Unable to load your profile" with Refresh and Sign In buttons. Replaced `return null` with `return <ProfileError />` in all 21 pages:

| Page | File |
|------|------|
| Dashboard | `app/(app)/dashboard/page.tsx` |
| Atlas | `app/(app)/atlas/page.tsx` |
| Atlas Thread | `app/(app)/atlas/[threadId]/page.tsx` |
| Calendar | `app/(app)/calendar/page.tsx` |
| Social Studio | `app/(app)/social/page.tsx` |
| Social Post | `app/(app)/social/[postId]/page.tsx` |
| Email Studio | `app/(app)/email/page.tsx` |
| Email Campaign | `app/(app)/email/[campaignId]/page.tsx` |
| Email Audiences | `app/(app)/email/audiences/page.tsx` |
| Audience Detail | `app/(app)/email/audiences/[audienceId]/page.tsx` |
| Image Studio | `app/(app)/images/page.tsx` |
| Knowledge | `app/(app)/knowledge/page.tsx` |
| Collection Detail | `app/(app)/knowledge/[collectionId]/page.tsx` |
| Settings | `app/(app)/settings/page.tsx` |
| Training | `app/(app)/training/page.tsx` |
| Training Detail | `app/(app)/training/[resourceId]/page.tsx` |
| LF Resources | `app/(app)/lf-resources/page.tsx` |
| LF Resource Detail | `app/(app)/lf-resources/[resourceId]/page.tsx` |
| Marketing Materials | `app/(app)/marketing-materials/page.tsx` |
| Material Detail | `app/(app)/marketing-materials/[materialId]/page.tsx` |
| Shared Resources | `app/(app)/shared/page.tsx` |

**Note:** `/admin/security` does not exist -- there are only `/admin`, `/admin/assets`, `/admin/usage`, `/admin/users`. None of these have the blank screen pattern.

### Additional Finding: RSC Icon Serialization (NEXT SPRINT)

The blank screen diagnosis also revealed that `/social`, `/knowledge`, and `/images` may crash in production due to Lucide icon components being passed as props across the React Server Component boundary to `"use client"` components (same bug fixed for `/admin` in commit `571f773`). This is NOT fixed in this sprint -- it requires removing `icon:` props from data objects passed to client components, matching the pattern from PR #37.

---

## Track 3: Production Readiness Audit Fixes

### 3a. Webhook Vulnerability (CRITICAL -- FIXED)

**Root Cause:** `verifyN8nSignature()` in `lib/automation/n8n.ts` was a no-op returning `true` unconditionally. The `/api/automation/callback` route used the Supabase service-role client (bypasses RLS) with zero authentication.

**Fix Applied:**
- Replaced `verifyN8nSignature()` with real HMAC-SHA256 verification using `crypto.timingSafeEqual`. Falls back to accepting callbacks only when `N8N_WEBHOOK_SECRET` is not configured (preserving current behavior for existing setups).
- Added signature verification at the top of the POST handler in `app/api/automation/callback/route.ts`. Invalid signatures now return 401.

### 3b. Open Redirect (MEDIUM -- FIXED)

**Root Cause:** `app/auth/callback/route.ts` accepted any `next` query parameter without validation and used it in `NextResponse.redirect()`.

**Fix Applied:** Added validation: `next` must start with `/` and must NOT start with `//` (protocol-relative URL). Falls back to `/dashboard` on invalid input.

### 3c. Localhost Fallback in Production (HIGH -- FIXED)

**Root Cause:** `lib/env.ts` line 70 had `"http://localhost:3000"` as the hardcoded fallback for `APP_URL`. If neither `NEXT_PUBLIC_APP_URL` nor `NEXT_PUBLIC_SITE_URL` is set in the hosting environment, all server-generated URLs (including magic link redirects) would point to localhost.

**Fix Applied:** Changed fallback to `"https://legendsos.app"`.

### 3d. MCP Token Encryption (HIGH -- NOT FIXED, OWNER ACTION REQUIRED)

**Finding:** `mcp_connections.auth_token` stores bearer tokens as plain TEXT in Supabase. This should be encrypted at rest using `pgsodium` or similar. Requires a Supabase migration and corresponding encryption/decryption logic.

**Owner Action:** Create a migration to add `pgcrypto` or `pgsodium` encryption to the `auth_token` column.

---

## Track 4: Irene Login Issue (ERR_CONNECTION_REFUSED)

**Root Cause:** Supabase dashboard "Site URL" is likely still set to `http://localhost:3000`. When Supabase generates magic links or OAuth redirects, it uses this Site URL. Users clicking those links get redirected to localhost, which is not running on their machine.

**Fix Applied (Code Side):** Changed the APP_URL fallback in `lib/env.ts` from `http://localhost:3000` to `https://legendsos.app`.

**Owner Action Required:**
1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Change "Site URL" from `http://localhost:3000` to `https://legendsos.app`
3. Add `https://legendsos.app/**` to "Redirect URLs" list
4. Set `NEXT_PUBLIC_APP_URL=https://legendsos.app` in Netlify environment variables

---

## Track 5: UX Optimization Findings

### HIGH Priority (recommend fixing in next sprint)
1. **4 resource library pages should be 1 page with tabs** -- `/training`, `/marketing-materials`, `/lf-resources`, `/shared` all use the same `ResourceLibrary` component and `shared_resources` table, differing only by `resource_type` filter.
2. **12 empty video placeholder slots in Settings** -- "Tutorial placeholder" cards dominate the settings page with unfinished content.
3. **Sidebar "Team" section overloaded** -- 5 items, 4 of which are resource libraries.

### MEDIUM Priority
4. **TopBar search bar (Cmd+K) is non-functional** -- no event handlers
5. **Knowledge page empty video tutorial slot** -- shows when `NEXT_PUBLIC_KNOWLEDGE_TUTORIAL_URL` is unset
6. **Admin page duplicates Settings provider table** -- remove from admin

### LOW Priority
7. **Login page "Welcome video coming soon"** -- show brand card instead
8. **TopBar notification bell non-functional** -- remove until notifications exist
9. **Zapier MCP "Coming Soon" connector** -- change to "Not configured"

---

## Track 6: Zapier-First Strategy

**Finding:** All direct social integrations are stubs:
- **Meta/Instagram:** `publishStub()` in `lib/integrations/meta.ts` always returns `{ ok: false }` -- explicitly labeled "DISABLED-by-default stub"
- **YouTube/GBP:** Zero API client code exists. No OAuth, no publishing, no destination discovery.
- **n8n broker:** Real and working -- saves `automation_jobs` rows and POSTs to configured webhook URLs.
- **Zapier MCP:** Scaffolded (UI panels, API routes, DB table) but stubs return `not_configured`.

**Recommendation:** The Zapier MCP server is already connected to this session with Facebook Pages, Instagram, YouTube, Google Business Profile, LinkedIn, Gmail, and Google Calendar tools available. The direct social API code should be removed in favor of routing through Zapier/n8n. No code changes made in this sprint -- this is a feature direction decision.

---

## Track 7: Production Validation

### Files Changed (26 total)
- **1 new file:** `components/ui/ProfileError.tsx`
- **21 page fixes:** Blank screen `return null` -> `return <ProfileError />`
- **3 security fixes:** `lib/automation/n8n.ts`, `app/api/automation/callback/route.ts`, `app/auth/callback/route.ts`
- **1 config fix:** `lib/env.ts` (localhost fallback)

### Validation Results
- **Lint:** Pending
- **TypeCheck:** Pending
- **Build:** Pending (will run after lint/typecheck pass)

---

## Owner Action Items (Cannot Be Fixed in Code)

| # | Action | Priority | Where |
|---|--------|----------|-------|
| 1 | Change Supabase Site URL to `https://legendsos.app` | CRITICAL | Supabase Dashboard > Auth > URL Configuration |
| 2 | Add `https://legendsos.app/**` to Redirect URLs | CRITICAL | Supabase Dashboard > Auth > URL Configuration |
| 3 | Set `NEXT_PUBLIC_APP_URL=https://legendsos.app` in Netlify | HIGH | Netlify > Site Settings > Environment Variables |
| 4 | Set `N8N_WEBHOOK_SECRET` in production | HIGH | Netlify env vars + n8n workflow config |
| 5 | Set YouTube/GBP env vars OR wire Zapier MCP for social publishing | MEDIUM | Netlify env vars or Zapier actions |
| 6 | Encrypt `mcp_connections.auth_token` column | MEDIUM | Supabase migration |
