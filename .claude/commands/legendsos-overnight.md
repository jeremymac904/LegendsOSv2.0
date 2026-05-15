---
description: Aggressive overnight LegendsOS sprint — UI polish + Atlas Hermes + Marketing + Calendar + Admin/Users + Assets/Knowledge + smoke + commit + push + deploy + live verify. Multi-track, multi-commit, autonomous.
allowed-tools: Bash, Read, Edit, Write, Agent, TaskCreate, TaskUpdate, TaskGet, TaskList, ScheduleWakeup, Skill
argument-hint: "[optional theme — e.g. 'demo polish' or 'tool calls']"
---

# /legendsos-overnight

Run an aggressive overnight LegendsOS sprint across every surface that has open work. Multiple commits are fine. Multiple deploys are fine. Each commit must lint + typecheck + build + smoke green before push.

## Pre-flight (identical to /legendsos-sprint)

```bash
pwd  # must be /Users/JeremyMcDonald/Desktop/LegendsOSv2.0
git status --short  # clean or known-intentional
git log -1 --oneline  # note live commit
```

## Tracks to run (in this priority order, may parallelize when files don't overlap)

1. **UI polish** → `legendsos-ui-jarvis-designer`
   Walk every authenticated surface as Jeremy via chrome-devtools-mcp. Capture
   BEFORE screenshots. Fix obvious spacing / hierarchy / mobile bugs. Skip a
   surface if you find no concrete gap.

2. **Atlas Hermes runtime** → `legendsos-atlas-hermes-engineer`
   Extend Atlas with at least one new tool call (draft-only side effect:
   create_social_draft OR create_email_draft OR create_calendar_item). Wire
   citations / tool-call chips into AtlasShell. Smoke with atlas-smoke.mjs.

3. **Marketing studios** → `legendsos-marketing-studio-builder`
   Tighten Social composer reopen UX. Tighten Email composer audience UX
   (the new "Latest newsletter" card on dashboard already deep-links here).
   Verify `request_test` still routes only to owner.

4. **Calendar planning** → `legendsos-calendar-planner`
   Confirm the 7-day upcoming feed pulls from social + email + calendar_items
   correctly. Add a week view if missing. No Google sync.

5. **Admin + Users** → `legendsos-admin-ops-builder`
   Make sure non-owner GET on /admin/** redirects, every privileged write
   logs an audit row, and impersonation still only sets the cookie.

6. **Assets + Knowledge** → run BOTH in parallel:
   - `legendsos-admin-ops-builder` for `/admin/assets` (usage chip math, upload UX).
   - `legendsos-knowledge-ingestion-engineer` for `/knowledge` (any new file
     types to support, retrieval scoring tweaks, citation surfacing).

7. **Smoke verification** → `legendsos-smoke-verifier`
   Full regression A–F local. Report PASS or pinpoint a failure.

## Orchestration

Dispatch the Chief Integrator with a multi-track brief:

```
Agent({
  subagent_type: "legendsos-chief-integrator",
  description: "Overnight multi-track sprint",
  prompt: `Theme (if any): <$ARGUMENTS or "general polish">.

  Run the seven tracks above. Group into commits BY TRACK — one commit
  per track, scoped message, HEREDOC, Co-Authored-By line. After every
  commit: lint + typecheck + build. If green, push. Then move to the
  next track.

  Sequencing rules:
  - Tracks 1 (UI) and 2 (Atlas runtime) may overlap on AtlasShell.tsx — sequence them.
  - Tracks 3 (Marketing) and 4 (Calendar) often touch dashboard.tsx — sequence them.
  - Tracks 5 (Admin) and 6 (Assets+Knowledge) are independent — parallelize.

  After each push:
  - Poll Netlify state every 12s until ready (max 5min).
  - Hand to legendsos-smoke-verifier for live regression on that surface.
  - Move to next track.

  After all tracks shipped:
  - Run legendsos-smoke-verifier for full regression A–F live.
  - Hand to legendsos-release-reporter for ONE consolidated final report
    listing every commit in order, surface by surface.

  Safety:
  - Never enable live publish or live send.
  - Never delete Jeremy's profile or any production row.
  - Never print secrets.
  - Never add HMAC, quotas, feature flags, approval queues, or new vendors.
  - If any track produces a regression, ROLL BACK that single commit
    (git revert <hash> && push) before moving on.`
})
```

## Reporting cadence

The Chief Integrator must produce a SHORT update after each commit (one paragraph). The Release Reporter produces ONE long-form consolidated report at the end. Do not write incremental long-form reports.

## End conditions

- All seven tracks attempted (some may legitimately produce no diff if the surface is already clean).
- All commits passed lint/typecheck/build before push.
- All live deploys ready.
- Final smoke regression PASS.

Args you passed: $ARGUMENTS
