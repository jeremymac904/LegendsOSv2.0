# Video Import Report — Legends Mortgage Academy

**Date:** June 12, 2026
**Source:** HeyGen folder `b4b032f18ddd48cf81e4a1288f376b0e` ("Photo Avatar — Jeremy" set), verified via HeyGen MCP (`list_videos`).
**Presenter:** Jeremy McDonald only — no non-Jeremy videos (Edward/John/Craig/Andre/Thuan removed in a prior pass).
**Registry:** [lib/legends/coachingVideos.ts](lib/legends/coachingVideos.ts) — the single source of truth for all Academy video slots (embed = `https://app.heygen.com/embeds/{id}`).

## Verification method (this pass)

1. **Exists** — every video ID confirmed via the HeyGen API: `status: completed`, real duration, thumbnail present, no failure codes.
2. **Loads** — every stable embed URL fetched over HTTP: **20/20 returned 200**, zero failures.
3. **Attached** — every slot mapped to its surface(s) below; wiring verified by the Phase 2 production build (typecheck + lint + build all pass) and by the 19 seeded `academy_feed_posts` rows (idempotent `(kind, ref_key)` upserts — reseeding never duplicates).

## Slot inventory — 20/20 verified

| Slot | HeyGen title | Video ID | Duration | Status | Attached to |
|---|---|---|---|---:|---|
| Welcome | Welcome — Jeremy Main | `57c3b85fa90c43e988568d3904a17732` | 1:16 | ✅ completed · embed 200 | `/coaching` hero + pinned **Start Here** feed post (`kind=coach, ref_key=welcome`) |
| Monday | Mon — Jeremy Main | `d8d31b56ce6b4d75bfb2b550108621c0` | 0:46 | ✅ | Today (Monday tab) + daily feed post (`ref_key=monday`) |
| Tuesday | Tues — Jeremy Main | `b33aedaa04f345c7ab723ff37c106d70` | 0:46 | ✅ | Today (Tuesday) + daily feed post |
| Wednesday | Wed — Jeremy Main | `fa607503b21e4b8a94f3e2440c87ae4a` | 0:40 | ✅ | Today (Wednesday) + daily feed post |
| Thursday | Thur — Jeremy Main | `041b04da0be745b9ac62b99a67affe79` | 0:32 | ✅ | Today (Thursday) + daily feed post |
| Friday | Fri — Jeremy Main | `ebb7e78e1b9e429195b7116c84c7b39a` | 0:31 | ✅ | Today (Friday) + daily feed post |
| Weekend | Weekend — Jeremy Main | `3f9da2c46ad8465fb6e1ae2b6edfe533` | 0:33 | ✅ | Today (Weekend) + daily feed post |
| Week 1 | w1 — Jeremy Voice — Final May 2026 | `f3294896b7a0401eacc4054c4c2b1216` | 1:14 | ✅ | Academy Week 1 (journey) + weekly feed post (`ref_key=w1`) |
| Week 2 | w2 | `119d7e20a9ba4f04b68db835f217476f` | 0:59 | ✅ | Academy Week 2 + weekly feed post |
| Week 3 | w3 | `06d7189b1c58440abcfe039c4c40d5ea` | 0:53 | ✅ | Academy Week 3 + weekly feed post |
| Week 4 | w4 | `c4cee8a30d66446cba1fa6de0f194bef` | 0:48 | ✅ | Academy Week 4 + weekly feed post |
| Week 5 | w5 | `ed24bfc4b5bf4dfdbde842f53ab6b090` | 0:47 | ✅ | Academy Week 5 + weekly feed post |
| Week 6 | w6 | `630c1f55c77f4153b61d5feff61d399d` | 0:45 | ✅ | Academy Week 6 + weekly feed post |
| Week 7 | w7 | `f0db13c81d9c47759f57e89f117672e2` | 0:41 | ✅ | Academy Week 7 + weekly feed post |
| Week 8 | w8 | `e2930ea8af1a4c2a8779f0220eecdba2` | 0:39 | ✅ | Academy Week 8 + weekly feed post |
| Week 9 | w9 | `0573ae30eecc45bb8ae7ade980b63757` | 0:33 | ✅ | Academy Week 9 + weekly feed post |
| Week 10 | w10 | `b7c6cdfb218047e08af5ac95d460826b` | 0:31 | ✅ | Academy Week 10 + weekly feed post |
| Week 11 | w11 | `3ae5ec9bcc014021a2733540b915b77f` | 0:31 | ✅ | Academy Week 11 + weekly feed post |
| Week 12 | w12 | `c9c7394db73d4d6b8fa842706693c00a` | 0:48 | ✅ | Academy Week 12 + weekly feed post |
| Graduation | Graduation — Jeremy Main | `f0618de9647d4e1fa45a138e370672dc` | 1:31 | ✅ | Academy graduation state (12/12 weeks complete) |

**Totals:** 20/20 completed · 20/20 embeds load (HTTP 200) · 0 placeholders · 0 missing · 0 failed.

## Notes

- Embeds use the **stable** `app.heygen.com/embeds/{id}` URLs — never the expiring signed `video_url` MP4s.
- Feed coach posts (1 welcome + 6 daily + 12 weekly = 19 rows) are seeded in `academy_feed_posts` with Jeremy as author; the feed renders today's daily and the current week's weekly post at the top of "All".
- Audio podcasts (26 episodes, Resources → Podcasts) stream from Supabase Storage (public `podcasts` bucket) — verified separately; not part of the HeyGen set.
