# Legends Mortgage Academy — Behavioral Rebuild Review

**Date:** 2026-06-12 · **Mode:** localhost only (port 3000) · **Not deployed.**
Benchmark: the Loan Factory coaching platform (member-area workflow), rebranded to LegendsOS dark/gold and Jeremy-only.

Reviewed routes: `/coaching`, `/training`, `/training/scripts`, `/training/resources`, `/training/today`, `/training/scorecard`, `/training/feed`, `/atlas`.

---

## ✅ Completed

| Module | Route | Behavior |
|---|---|---|
| **Overview** | `/coaching` | Welcome (Jeremy) video, 12-week roadmap with real per-week Jeremy videos, daily coaching rail, graduation, Academy sub-nav. |
| **Feed** | `/training/feed` | Team feed; composer (title/body/category → Wins/Questions/Scripts); category filters (All/Pinned/Daily/Weekly/Wins/Questions/Scripts); pinned Jeremy coach posts; daily/weekly coaching posts; per-post like + comments; localStorage-persisted. |
| **Today** | `/training/today` | Monday→Weekend tabs (defaults to current day); per-day theme + instruction; **Jeremy daily video embedded per tab**; activity fields (text/number/long); time-block fields; accountability questions; Save progress. |
| **Scorecard** | `/training/scorecard` | Editable Mon–Fri metric grid (8 metrics); per-row Total/Goal/Pace% bars; overall completion summary; weekly reflection (biggest win / obstacle / next-week focus / goal). |
| **Rollup** | Today → Scorecard | **Verified live:** numeric Today fields tagged with a metric auto-write into the weekly Scorecard column (Mon logged 7 conversations → Scorecard Mon = 7, pace recomputed). |
| **Resources** | `/training/resources` | Tabs: Scripts, Tools, Training, Podcast, Calendar, Downloads. Every card links to real content (internal routes or Drive PDFs). Calendar tab shows the weekly rhythm. |
| **Training (merged)** | `/training` | One system: **AI Advantage + Legends Mortgage Academy + Elite Sales & Marketing** as visual program cards (AI Advantage uses real video thumbnail) + the 985-asset library below. |
| **Scripts** | `/training/scripts` | Fixed earlier (client `ScriptCard`); 4 scripts with working Copy. |
| **Atlas** | `/atlas` | Composer pinned to viewport bottom (unchanged, still good). |
| **Videos** | — | All **20 Jeremy HeyGen videos** imported (Welcome, Mon–Weekend, Week 1–12, Graduation). No non-Jeremy videos anywhere. |
| **Nav** | all | `AcademyNav` sub-nav (Overview/Feed/Today/Scorecard/Resources/Training) on every Academy surface. Sidebar label = "Legends Mortgage Academy". |

Foundation: `lib/legends/academyContent.ts` (content model), `lib/legends/useAcademyStore.ts` (localStorage hooks + rollup), `lib/legends/coachingVideos.ts` (Jeremy registry).

Checks: **lint ✅ · typecheck ✅ · build ✅** (all new routes compile).

---

## ⚠️ Missing / deferred (next cycle)

- **Trackers, Playbooks, Classroom** — present in the source platform, not yet built as LegendsOS routes.
- **Community extras** — leaderboard + "this week" asides and feed image/video/poll attachments (source had them; current composer is title/body/category only — the store would need attachment support).
- **Elite Sales & Marketing** has no dedicated route — the program card links to `/marketing-materials` (marketing side); the full 101–601 sales catalog lives in the `/training` library index, not a standalone course player.
- **Persistence is local only** — Feed posts, Today entries, and Scorecard are `localStorage` per-browser (no Supabase table yet, so not shared team-wide).
- **Graduation certificate** — plays the Jeremy graduation video; no downloadable certificate artifact.

## ❌ Broken

- None found across the 8 reviewed routes (all return 200, no error overlays).

## 🎨 UI issues (minor)

- Scorecard shows a brief "Loading scorecard…" flash before hydration (expected for localStorage-backed view).
- Pre-existing `<html>` "Extra attributes from the server: style" theme-hydration console warning on every page (unrelated to this work).
- AI Advantage card reads "23 lessons" (uses the data array length) — confirm intended count vs. 24.

## 🔗 Dead links

- None. Every Resources/Training/Academy tile links to a real internal route or a real Drive document.

## 🧪 Placeholder content

- Feed seed posts (Jeremy pinned + sample LO wins/questions) are illustrative starter content; real posts persist on top.
- Scorecard starts empty (0s) by design; fills from Today or manual entry.
- Daily/weekly/per-week/graduation videos are **real Jeremy HeyGen embeds** — no video placeholders remain.
