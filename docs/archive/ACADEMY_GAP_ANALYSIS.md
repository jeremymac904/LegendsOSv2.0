# Academy Gap Analysis — Loan Factory Coaching Platform → Legends Mortgage Academy

**A = Loan Factory coaching platform** (`/tmp/lf-coaching`, behavioral blueprint).
**B = Current Legends Mortgage Academy** (LegendsOS `/coaching` + `/training/*`).
**Method:** parallel source comparison (workflow `wrjiv031s`) across surfaces + systems.

Legend: ✅ done · ◑ partial · ❌ missing. Rank: **Critical / Important / Nice-to-have**.

---

## Surfaces

| Surface | A (Loan Factory) | B (LegendsOS now) | Gap | Rank |
|---|---|---|---|---|
| **Feed** | composer, categories, pinned coach posts, comments, likes, **attachments (img/video), polls, threaded replies, leaderboard, search** | composer, categories, pinned, comments, likes, filters | attachments/polls/replies/leaderboard/search ❌ | Important |
| **Today** | day tabs, theme fields, save+**submit to coach**, tools sidebar | day tabs, Jeremy video, fields, accountability, save→scorecard rollup | submit-to-coach, tools sidebar deep-links ◑ | Important |
| **Scorecard** | metric grid, pace, reflection, **submit + history** | metric grid, pace, reflection, auto-rollup | submit-to-coach + history ❌ | Nice |
| **Academy/Classroom** | 12-week **rich lesson bodies + per-step assignment checklists + win conditions + graduation %** | 12-week roadmap (theme, action items, Jeremy video, graduation) | lesson bodies + assignment checklists + win conditions ◑ | Important |
| **Trackers** | 8 editable execution trackers (Daily Execution, Relationship, Deal Flow, Follow-up, Theme Day, Time Block, Greatness, Conversion) | — | whole module ❌ | Important |
| **Playbooks** | step playbooks w/ checkable steps | — | whole module ❌ | Important |
| **Scripts** | searchable library, copy, practice prompts | 4 scripts + copy | search/practice/larger library ◑ | Nice |
| **Resources** | Drive downloads by category | 6 tabs (Scripts/Tools/Training/Podcast/Calendar/Downloads) | add Playbooks/Marketing/AI Advantage/Elite tabs ◑ | Important |
| **AI Advantage** | n/a (Elite repo) | 24 Jeremy videos, sections, thumbnails ✅ | improve UX ◑ | Nice |
| **Elite Sales & Marketing** | 101–601 modules, scripts, marketing PDFs (Elite repo) | not a dedicated surface | dedicated Elite surface ❌ | Important |
| **Coach/Manager/Admin dashboards** | member progress table, review queue, coach notes | LegendsOS `/admin/*` (users/usage/security) | coaching-specific review dashboards ❌ | Nice |

## Cross-cutting systems

| System | A | B now | Gap | Rank |
|---|---|---|---|---|
| **Persistence** | localStorage (per-browser) | localStorage (`useAcademyStore`) | **→ Supabase, multi-device/session** | **Critical** |
| Progress | classroom % + scorecard pace | weeks-done + scorecard pace | server-backed progress | Important |
| Accountability | daily fields + submit | daily fields + accountability prompts | server persistence | Important |
| Completion / Graduation | classroom 100% → graduation | 12/12 weeks → graduation video | server-backed graduation status | Important |
| Community | feed + leaderboard | feed | leaderboard, richer posts | Nice |
| Automations | none real | none | n8n daily/weekly reminders | Nice |
| Navigation | member sidebar (Feed/Today/Scorecard/…) | `AcademyNav` sub-nav across surfaces ✅ | — | — |
| Branding | LO Mastery / Alliance | **Legends Mortgage Academy, Jeremy-only** ✅ | — | — |

---

## Ranked backlog

**Critical (this pass):**
1. **Supabase persistence** for coaching data (Feed user posts/comments/likes, Today entries, Scorecard, Academy progress + graduation) — multi-device/browser/session. *(schema + RLS applied; API + hook rewire in progress)*

**Important (this pass where feasible, else next):**
2. Elite Sales & Marketing dedicated surface + Resources tabs (Playbooks/Marketing/AI Advantage/Elite).
3. Academy week lesson bodies + per-step assignment checklists.
4. Trackers module (8 editable trackers).
5. Playbooks module.
6. Feed: search + attachments + threaded replies + leaderboard.
7. Today: submit-to-coach + tools sidebar deep-links.

**Nice-to-have:**
8. Scorecard submit + history; coaching review dashboards; n8n reminders; AI Advantage/Scripts UX polish.

> Branding, navigation, theme, permissions, and the Feed→Today→Scorecard→Review→Progress→Graduation flow are already native LegendsOS. The defining remaining work is **persistence** (Critical) and the **Trackers/Playbooks/Elite** modules (Important).
