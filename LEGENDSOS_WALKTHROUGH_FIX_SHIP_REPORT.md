# LegendsOS Walkthrough Fix Ship Report

Date: 2026-06-18

## Status

The safe, high-impact walkthrough fixes are merged and deployed to production.

- Production URL: https://legendsos.app
- PR 41: https://github.com/jeremymac904/LegendsOSv2.0/pull/41
- PR 42: https://github.com/jeremymac904/LegendsOSv2.0/pull/42
- Current deployed app commit: `370396a9bc855fb8ecd804db5666b12909784088`
- Netlify production deploy: `6a334409ef7851000848b265`
- Netlify deploy URL: https://main--legndsosv20.netlify.app

## What Was Fixed

1. Login/onboarding branding
   - Replaced the green/beige platform feel with the Legends black, gold, silver, and white direction.
   - Improved fallback login shell contrast and brand balance.

2. Global light-mode readability
   - Improved shared status colors, card surfaces, border contrast, and readable text states.
   - Preserved dark mode while making light mode safer for onboarding.

3. Settings and My Connections
   - Added a clear loan-officer-friendly My Connections area for Gmail, Google Drive, Google Calendar, and Zapier MCP.
   - Hid owner/team-only setup noise from non-admin users.
   - Kept provider gateway, team branding, external action flags, and advanced setup behind owner/admin scope.

4. Zapier MCP truth
   - Changed saved MCP endpoint language from implied connected status to saved/not verified.
   - Kept Zapier as the recommended social publishing path.
   - Removed confusing setup-needed language around optional direct Google social APIs.

5. Social publishing truth
   - Reframed social publishing as draft-only unless Jeremy verifies and enables an external route.
   - Kept Zapier recommended and direct platform APIs clearly advanced.

6. Atlas provider reliability
   - Reordered provider fallback toward DeepSeek/OpenRouter/MiniMax.
   - Made NVIDIA fallback opt-in instead of surprising users.
   - Added more actionable provider setup messaging.

7. Loan officer navigation and role scope
   - Removed Marketing Assistant, Email Studio, and LF Resources from default LO navigation.
   - Added Connection Center to owner/admin navigation.
   - Reduced admin automation noise for loan officers.

8. My Loans intake
   - Added manual borrower/loan draft intake.
   - Added CSV preview/import validation and a downloadable sample CSV template.
   - Added local audit logging.
   - Kept this intentionally non-LOS and non-CRM: no external writes.

9. Atlas workflow polish
   - Made Atlas projects visible by default.
   - Added mortgage-specific project starters.
   - Replaced generic LO shortcuts with borrower, realtor, pipeline, and social draft workflows.

10. Knowledge, Training, and Resources polish
    - Added clearer Knowledge source trust, provenance, indexed/stored labels, and light-mode-safe cards.
    - Simplified Training navigation to Feed, Today, Scorecard, and Resources.
    - Tightened Training Today and Scorecard layouts.
    - Refocused Marketing Materials as an LO Asset Library.
    - Hid owner/source project folders from non-owner users.

## What Was Intentionally Hidden Or Labeled

- Zapier MCP: saved/not verified until a real endpoint is verified.
- Social publishing: draft-only unless live routes are explicitly verified.
- Google Social APIs: optional advanced direct integration.
- Loan Brain/live intelligence: no new claim that Drive intelligence or LOS sync is live.
- Loan officers: owner/team-only setup controls are hidden from the main Settings experience.

## What Was Not Safe To Fix Today

- Full AI runtime unification.
- Live social publishing.
- Direct Google Business Profile and YouTube destination productionization.
- LOS-level My Loans complexity.
- Production database migrations.
- External CRM, LOS, or social writes.

## Validation Results

Passed locally in a clean clone:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Passed in GitHub/Netlify:

- PR 42 GitHub Action: `Lint, Typecheck, Build` passed.
- PR 42 Netlify deploy preview passed.
- Production Netlify deploy is ready.

Passed against production:

- `PLAYWRIGHT_BASE_URL=https://legendsos.app npx playwright test tests/e2e/smoke.spec.ts tests/e2e/loan-brain-smoke.spec.ts`
- Result: 27 passed.

Known infrastructure caveat:

- The main-branch Supabase Preview check reported remote/local migration drift: `Remote migration versions not found in local migrations directory.`
- This was not caused by the walkthrough UI changes; PR 42 did not change `supabase/`.
- This should be handled as a separate Supabase migration reconciliation task before future schema work.

## Files Changed In PR 41

- `app/(app)/admin/setup/page.tsx`
- `app/(app)/chief-of-staff/page.tsx`
- `app/(app)/my-loans/page.tsx`
- `app/(app)/settings/page.tsx`
- `app/(app)/social/page.tsx`
- `app/api/loans/intake/route.ts`
- `app/login/page.tsx`
- `components/atlas/AtlasShell.tsx`
- `components/atlas/AtlasWorkspace.tsx`
- `components/atlas/LOWorkspace.tsx`
- `components/loanbrain/LoanIntakePanel.tsx`
- `components/settings/IntegrationConnections.tsx`
- `components/settings/MCPConnections.tsx`
- `components/social/SocialComposer.tsx`
- `lib/ai/providers.ts`
- `lib/navigation.ts`
- `tailwind.config.ts`
- `LEGENDSOS_WALKTHROUGH_FIX_SHIP_REPORT.md`

## Files Changed In PR 42

- `app/(app)/knowledge/[collectionId]/page.tsx`
- `app/(app)/marketing-materials/[materialId]/page.tsx`
- `app/(app)/marketing-materials/page.tsx`
- `app/(app)/training/resources/page.tsx`
- `app/(app)/training/scorecard/page.tsx`
- `app/(app)/training/today/page.tsx`
- `components/atlas/AtlasProjectsPanel.tsx`
- `components/atlas/AtlasWorkspace.tsx`
- `components/atlas/LOWorkspace.tsx`
- `components/resources/ResourceDetail.tsx`
- `components/resources/ResourceLibrary.tsx`
- `components/training/AcademyNav.tsx`
- `components/training/AcademyResources.tsx`
- `components/training/AcademyScorecard.tsx`
- `components/training/AcademyToday.tsx`
- `lib/legends/academyContent.ts`

## Manual Owner Click Testing

Before team onboarding, Jeremy should manually verify:

1. Log in as owner.
2. Log in as at least one loan officer.
3. Open Dashboard, Chief of Staff, Atlas, Settings, My Connections, My Loans, Training, Knowledge, and LO Asset Library.
4. Confirm LO Settings does not show owner-only setup clutter.
5. Confirm Atlas project starters feel useful for LO workflows.
6. Add one manual My Loans draft.
7. Download the sample CSV and preview one valid import.
8. Confirm Zapier MCP says saved/not verified unless a real MCP connection has been verified.
9. Confirm Social Studio reads as draft-only and does not imply live publishing.
10. Confirm Training resource playback and Knowledge source cards feel clear.

## Go / No-Go Recommendation

GO for guided team onboarding, with clear talking points:

- Atlas, Training, Knowledge, My Loans draft intake, Settings/My Connections, and the LO Asset Library are safe to demo.
- Social publishing should be described as draft-first with Zapier recommended.
- Loan Brain and automations should not be presented as live LOS/Drive intelligence unless Jeremy has verified the connected data path.
- Direct Google social destination discovery should not be demoed as a required setup path.
