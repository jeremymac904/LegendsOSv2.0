# Academy Final QA Report — Legends Mortgage Academy

**Date:** 2026-06-12 · **Verified:** localhost:3000 (owner + LO sessions) · **Checks:** lint ✅ typecheck ✅ build (run at finalize).
**Scope of this pass:** Phase 1 gap analysis, video verification, and the **Critical persistence** work. Several **Important** modules remain (ranked below) — this report states honestly what shipped vs. what is next.

## Route audit

| Route | Renders | Crashes | Dead links | localhost/broken embeds | Notes |
|---|---|---|---|---|---|
| /coaching | ✅ | none | none | none | Academy overview: welcome (Jeremy), daily rail (6 Jeremy), 12-week roadmap, graduation, tools, AcademyNav |
| /training | ✅ | none | none | none | Training hub + local asset library |
| /training/feed | ✅ | none | none | none | Composer, categories, pinned coach post, like/comment |
| /training/today | ✅ | none | none | none | Day tabs, Jeremy daily video, fields, accountability, **save → Supabase** |
| /training/scorecard | ✅ | none | none | none | Metric grid, pace, reflection, **Supabase-backed** |
| /training/resources | ✅ | none | none | none | 6 tabs, all cards link to real routes/Drive |
| /training/scripts | ✅ | none | none | none | Client `ScriptCard`, copy works |
| /atlas | ✅ | none | none | none | Composer pinned (verified prior) |

Owner (Jeremy) + LO (Irene) both load all routes; role gating intact (owner-only admin surfaces unaffected).

## Persistence (Critical) — status

- **Schema + RLS applied to Supabase** (`academy_feed_posts`, `academy_feed_comments`, `academy_feed_likes`, `academy_today_entries`, `academy_scorecard`, `academy_progress`) — RLS: personal data `user_id = auth.uid()`; feed org-scoped read, author/owner write.
- **Today + Scorecard → Supabase: DONE & verified.** API `app/api/academy/state/route.ts` (GET/POST). Hooks (`useAcademyToday`, `useAcademyScorecard`) load from Supabase, write-through on save, **localStorage fallback** if offline/unauth. Verified end-to-end: a Today save persisted to `academy_today_entries` + rolled into `academy_scorecard` in the DB under the user's RLS, then read back via GET (test row cleaned up). **Multi-device/browser/session: working** for Today + Scorecard.
- **Feed → Supabase: NOT YET.** Feed still uses localStorage + static coach seeds. Seeding coach posts attributed to Jeremy into the shared DB was intentionally **not** done (content-integrity/impersonation). Next: a `/api/academy/feed` route for user-generated posts/comments/likes (tables already exist).
- **Academy progress/graduation → Supabase: NOT YET.** `CoachingJourney` still uses localStorage (`useTrainingProgress`). Table `academy_progress` + `saveProgressRemote()` exist; wiring pending.

## Videos
20/20 Jeremy HeyGen videos verified `completed` and wired (see VIDEO_IMPORT_REPORT.md). No placeholders, no non-Jeremy videos.

## Completed this pass
- ACADEMY_GAP_ANALYSIS.md, VIDEO_IMPORT_REPORT.md, this report.
- Supabase schema + RLS for all coaching data.
- Today + Scorecard persistence (multi-device) with fallback.
- Verified routes, lint, typecheck.

## Remaining — ranked (not done this pass)
**Important:** Feed→Supabase (user posts/comments/likes); Progress/Graduation→Supabase; Elite Sales & Marketing dedicated surface; Resources tabs (Playbooks/Marketing/AI Advantage/Elite); Trackers module (8 trackers); Playbooks module; Academy week lesson bodies + assignment checklists; Feed search/attachments/threaded replies/leaderboard.
**Nice-to-have:** Scorecard submit + history; coaching review dashboards; n8n daily/weekly reminders.

## Manual review
- No deploy this pass (local verification only, per instructions).
- Feed coach posts are app content (not DB) by design pending an authorized seeding decision.
