---
description: Ship one focused LegendsOS sprint end-to-end (chief integrator coordinates parallel tracks, then lint/typecheck/build/commit/push/deploy/verify).
allowed-tools: Bash, Read, Edit, Write, Agent, TaskCreate, TaskUpdate, TaskGet, TaskList, ScheduleWakeup, Skill
argument-hint: "<sprint goal in plain English>"
---

# /legendsos-sprint

Ship one focused sprint against the LegendsOS 2.0 repo using the LegendsOS multi-agent system.

## Pre-flight

```bash
pwd
# Must be /Users/JeremyMcDonald/Desktop/LegendsOSv2.0 — refuse otherwise.

git status --short
# Must be clean OR contain only intentional in-progress edits the integrator can take ownership of.

git log -1 --oneline
# Note the current live commit.
```

If `pwd` is wrong, STOP and tell Jeremy. Do not proceed.

## Step 1 — Read source of truth

Read in this order, only the ones that exist:

1. `STATUS.md`
2. `HANDOFF.md`
3. `NEXT_ACTIONS.md`
4. `docs/CHANGELOG.md`
5. `docs/STATUS.md`
6. `docs/HANDOFF.md`
7. `docs/NEXT_ACTIONS.md`

Restate the sprint goal in one sentence. List the surfaces likely to change.

## Step 2 — Dispatch Chief Integrator

```
Agent({
  subagent_type: "legendsos-chief-integrator",
  description: "Split + dispatch + integrate sprint",
  prompt: `Sprint goal: <restated sprint goal from $ARGUMENTS>.

  Use the LegendsOS workflow:
  1. Decide which specialist agents to dispatch (ui-jarvis-designer,
     atlas-hermes-engineer, marketing-studio-builder, admin-ops-builder,
     knowledge-ingestion-engineer, calendar-planner). Pick only the ones
     whose owned surfaces actually need work.
  2. Dispatch them in parallel ONLY when their owned file sets don't
     overlap. If two specialists need the same file, sequence them.
  3. After all specialists return, run lint + typecheck + build. If any
     fails, hand back to the responsible specialist with the exact error.
  4. Hand to legendsos-smoke-verifier for local regression.
  5. Stage explicit files and commit with a HEREDOC scoped message
     ending in the Co-Authored-By line.
  6. git push origin main.
  7. Poll Netlify state every 12s for up to 5min until ready.
  8. Hand to legendsos-smoke-verifier again, this time against live.
  9. Hand to legendsos-release-reporter for the final report.

  Do not weaken safety: no live publish, no live email send, no secret
  printing, no production data deletion.

  Return only the integrator summary (≤ 6 bullets). The release-reporter
  produces the long-form output that follows.`
})
```

## Step 3 — Run release reporter

The chief integrator should have invoked `legendsos-release-reporter` already. If for some reason it did not, run it now:

```
Agent({
  subagent_type: "legendsos-release-reporter",
  description: "Final report",
  prompt: "The sprint just shipped. Read git log -1 for hash+subject, git diff --stat HEAD~1..HEAD for files, the smoke-verifier table from this session, and the Netlify deploy state. Write the standard 6-section report. No invention."
})
```

## Step 4 — End

Output is the release reporter's report. Nothing else.

---

## Safety reminders the slash command enforces

- Never enable `ALLOW_LIVE_SOCIAL_PUBLISH` or `ALLOW_LIVE_EMAIL_SEND`.
- Never delete Jeremy's profile or his real data.
- Never print `.env.local` or any secret value.
- No new vendor. No HMAC. No quotas. No approval queues. No feature flags.
- If the integrator's transcript shows any of the above attempted, abort and tell Jeremy.

Args you passed: $ARGUMENTS
