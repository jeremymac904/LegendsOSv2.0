# Academy UX Optimization Plan

**Premise:** the framework exists (cloud Feed, Today, Scorecard, Resources w/ 9 tabs, Academy 12-week + graduation, Elite, AI Advantage, AcademyNav, trackers + playbooks panels). This plan is about **UX**, not new shelves: make the Academy feel like one coaching operating system that always answers *"what do I do next?"*

## Current state (verified this pass)
- **Feed** — `/training/feed`, cloud-backed (`academy_feed_posts/comments/likes`, RLS), composer, categories, like/comment/pin/delete, leaderboard (`feed/FeedLeaderboard.tsx`).
- **Today** — `/training/today`, day tabs, Jeremy daily video, fields → Supabase (`academy_today_entries`), auto-rolls into Scorecard.
- **Scorecard** — `/training/scorecard`, metric grid, pace, reflection, submit-to-coach (`academy_scorecard` + submitted/reviewed/coach_note).
- **Academy** — `/coaching` (overview) + `/training/academy`, 12-week roadmap, Jeremy weekly videos, graduation (`academy_progress` + `graduated_at`).
- **Resources** — `/training/resources`, 9 tabs incl. **Trackers** (8 configs, localStorage) + **Playbooks** panels.
- **Nav** — `AcademyNav` (Overview/Feed/Today/Scorecard/Academy/Resources/Elite/AI Advantage/Training).
- **Migration** `20260612130000_academy_coaching_v2.sql` — origin verified (committed `207c4e1`, additive-only). See report below.

## Priority order (from brief) → status & action

| # | Item | Status | Action this pass |
|---|---|---|---|
| 1 | Feed = primary coaching home | ✅ exists | Keep Feed first in nav; it is the cloud home |
| 2 | Today = primary daily workflow | ✅ | — |
| 3 | Scorecard = primary accountability | ✅ | — |
| 4 | Unify Feed/Today/Scorecard/Resources nav | ✅ `AcademyNav` | — |
| 5 | Realtor Tracker | ✅ exists | — |
| 6 | Database Tracker | ❌ missing | **Add** |
| 7 | Follow Up Tracker | ✅ exists | — |
| 8 | Past Client Tracker | ❌ missing | **Add** |
| 9 | Referral Tracker | ❌ missing | **Add** |
| 10 | Playbooks section | ✅ `PlaybooksPanel` | — |
| 11 | Feed persistence → Supabase | ✅ done (cloud feed) | verify |
| 12 | Academy progress tracking | ✅ `academy_progress` | verify |
| 13 | Graduation tracking | ✅ `graduated_at` | verify |
| 14 | Team wins & activity visibility | ◑ FeedLeaderboard | ranked next (owner team dashboard) |
| 15 | Google Calendar into Academy Calendar | ◑ OAuth route exists | ranked next (wire events into Calendar tab) |

## This pass (implement)
1. **Add the 3 named trackers** — Database, Past Client, Referral — to `lib/legends/trackers.ts` and order the 5 brief-named trackers first (Realtor, Database, Follow Up, Past Client, Referral). Generic `TrackersPanel` renders them automatically (add/edit/delete row + CSV).
2. **Verify the full workflow locally** with screenshots: Feed → Today → Scorecard → Resources (Trackers) → Graduation.
3. **Migration report** (below).

## Ranked next (documented, not this pass — large/standalone)
- **Team wins & activity visibility:** owner/coach dashboard reading `academy_feed_posts` (Wins) + `academy_scorecard` activity across the org (RLS owner-select policies already exist).
- **Google Calendar → Academy Calendar:** wire `/api/integrations/google/calendar` events into the Resources → Calendar tab (per-user OAuth already plumbed).
- **Trackers → Supabase** (`academy_trackers` table) for multi-device parity with Feed/Today/Scorecard.
- **Today submit-to-coach + tools deep-links; Scorecard history.**

## Migration report — `20260612130000_academy_coaching_v2.sql`
- **Origin: verified.** Tracked in git, committed in `207c4e1 [ACADEMY] Coaching OS…` (a pass that ran after the prior persistence commit). Authored as part of the Coaching-OS feature set (cloud feed, submit-to-coach, Elite, playbooks/trackers, graduation).
- **Safety: additive-only.** `add column if not exists` (feed `kind`/`ref_key`/`attachment_url`; scorecard `submitted`/`submitted_at`/`reviewed`/`coach_note`; progress `graduated_at`) + `create index if not exists`. No drops, no type changes, no data deletion. Idempotent.
- **Recommendation: safe to keep and apply.** It is already committed and the Coaching-OS code depends on these columns. Verify it is applied to the live DB (checked this pass).
- A sibling `20260612125900_academy_base_schema.sql` captures the base academy tables/RLS from the live DB so the schema is rebuildable from code.
