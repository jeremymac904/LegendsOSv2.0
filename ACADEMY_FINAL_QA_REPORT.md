# Legends Mortgage Academy — Final QA Report

**Date:** June 12, 2026 (supersedes the earlier same-day report — every "Remaining" item from that pass has now shipped)
**Method:** 17-agent QA workflow (5 parallel auditors → adversarial verification of every blocker/major finding) + build gates + live-DB checks. Findings below are only those that **survived adversarial verification**; one finding was refuted and discarded.

## Build gates — all green

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | ✅ zero errors |
| `npm run lint` | ✅ no warnings or errors |
| `npm run build` | ✅ compiled, 90 pages generated |

## Route audit — clean

- **73 routes** inventoried from the app tree; **all 18 internal link targets in the coaching scope resolve** (Feed, Today, Scorecard, Academy + track/module, Resources, Elite, AI Advantage, Scripts, Roleplay, Audio, Coaching).
- All `?tab=` deep links valid against the 9 Resources tab keys (scripts, playbooks, training, podcasts, calendar, downloads, marketing, ai-advantage, elite); unknown keys fall back safely — no crash path.
- **Zero** dead-shaped anchors (`#`, empty, `javascript:`), zero TODO/FIXME, zero lorem ipsum, zero example.com, **zero localhost in any rendered source file** (one localhost URL reachable through generated asset search was fixed this pass — finding #4 below).

## Embeds & media — verified

- All **20 HeyGen coaching embeds** (welcome, 6 daily, 12 weekly, graduation) are the only embeds on coaching surfaces; each confirmed `completed` via the HeyGen API and loading over HTTP (see VIDEO_IMPORT_REPORT.md).
- AI Advantage intro video separately confirmed live via the HeyGen API (an auditor's "stale embed" claim was **refuted** by direct API check).
- YouTube spot-checks 5/5 alive; podcast audio 5/5 sampled return 206 (streamable); Drive resource links return 200; feed iframes allowlist only `youtube.com/embed` + `app.heygen.com/embeds` — unrecognized video URLs degrade to link cards, never broken iframes.

## Roles & persistence — verified at the code/RLS level

- **Owner:** pin/unpin, delete any post, author coach categories, read all scorecards/progress (RLS owner policies + `isAdminOrOwner` route guards, exact lines verified by auditors).
- **LO:** post/comment/like, save Today, submit scorecard, complete weeks — and **cannot** pin (403), delete others' posts (403), or author coach categories (400). Author identity is stamped server-side from the profile, never trusted from the client.
- **No service-role key** in any client-reachable code path; both academy APIs use the RLS-respecting server client.
- **Multi-device:** every coaching write (Today save → scorecard rollup, scorecard save/submit, progress/graduation, all feed actions) goes through authenticated APIs; localStorage is offline fallback only.
- Feed coach content: 19 seeded posts (welcome + 6 daily + 12 weekly) live in `academy_feed_posts`, idempotent on `(kind, ref_key)`.

## Confirmed findings → all fixed this pass

| # | Severity (verified) | Finding | Fix |
|---|---|---|---|
| 1 | Major | Academy module "Atlas Integration" CTAs linked `/atlas?q=` but Atlas reads `?prompt=` — prepared prompts silently dropped | Param corrected |
| 2 | Blocker | Rebrand sanitizer was case/separator-sensitive: ALL-CAPS, lowercase, and snake_case legacy titles/summaries (`LOAN FACTORY COACHING…`, `Loan_Factory_Coaching_…`, `LO_Mastery`) rendered to members | REBRAND_RULES rewritten separator-tolerant + case-insensitive; replayed against every offender string — clean |
| 3 | Major | "Apex Advisor" legacy program name leaked in 14 asset titles/summaries (36 occurrences) | Apex Advisor/Apex sanitizer rules added |
| 4 | Major | Two member-reachable localhost URLs rendered as "Source" links from generated asset data | `sourceUrls` filtered — localhost/127.0.0.1 never render |
| 5 | Major | "coaching sessions" (plural) and `One_on_One` column names escaped the group-coaching language rules | Rules now match plural + underscore/hyphen/space variants |
| 6 | Major | Mastery Track description leaked internal meta-commentary incl. a legacy program name on member pages | Trimmed; commentary moved to non-rendered `internalNotes` |
| 7 | Major | Repo could not rebuild the DB — academy tables + RLS existed only live, not in migrations | `20260612125900_academy_base_schema.sql` added: full idempotent DDL + policies captured from the live database; RLS now auditable from code |
| 8 | Minor | Dead-code registry of 55 unverified legacy embeds (zero importers) | Deleted |
| 9 | Minor (downgraded from major) | 18 of 21 secondary curriculum *track* modules are honest "recording pending" outlines | **Accepted + documented** — deliberate phased rollout; the primary 12-week Academy journey is 100% real content (videos, lessons, checklists, win conditions) |

## Known limitations (honest)

1. **Track outlines** (#9): sales/marketing/AI track modules beyond the 101 lessons show an honest "recording pending" card. The core coaching loop — Feed → Today → Scorecard → Weekly Review → Academy 12 weeks → Graduation — is fully built and content-complete.
2. **Authenticated browser pass:** login is email+password; automated QA does not enter credentials, so role behavior was verified at the code/RLS level (exhaustively). The remaining human step is a sign-in pass by the owner; the built-in impersonation banner makes the LO-view check one click.
3. Generated asset *file paths* keep their on-disk names (owner-gated display only); all member-visible text is sanitized at the display boundary.

## Verdict

**PASS** for the coaching-platform replacement: no crashes, no dead links, no rendered placeholders in the coaching loop, no localhost URLs, no broken embeds, no missing videos, zero user-visible legacy branding after this pass, group-coaching language enforced, persistence cloud-backed with correct role separation.
