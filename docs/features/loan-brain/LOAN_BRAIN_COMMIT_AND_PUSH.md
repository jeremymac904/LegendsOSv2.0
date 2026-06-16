# Loan Brain — Commit & Push Handoff

The build agent **verified everything but could not commit or push from its environment** for two hard reasons:

1. The repo is on a **FUSE-mounted volume** where `.git/index.lock` exists and cannot be unlinked (`rm` → "Operation not permitted"), so `git add`/`commit` fail.
2. **No push credentials** are present in that environment (no credential helper, no `~/.git-credentials`, no SSH key).

Both go away in **your Mac Terminal**, where git and your GitHub auth work normally. Run the steps below from the repo root.

```bash
cd "/Volumes/LegendsOS/Jeremy's_2026_Master_Build_Folder/legends-team-builds/legendsos/legendsos-v2"

# 0. Clear the stale lock (safe — no git process is running)
rm -f .git/index.lock

# 1. Confirm branch
git branch --show-current   # -> feature/loan-brain-drive-browser
```

## Commit 1 — data model + RLS + types

```bash
git add \
  supabase/migrations/20260530000000_mortgage_data_model.sql \
  supabase/migrations/20260530000100_mortgage_rls_policies.sql \
  types/database.ts
git commit -m "feat(loan-brain): add mortgage data model and RLS"
```

## Commit 2 — read-only Drive browser + role workflows

```bash
git add \
  app/\(app\)/loan-brain/ \
  app/\(app\)/processing/ \
  app/\(app\)/coordinator/ \
  app/\(app\)/my-loans/ \
  app/api/loanbrain/ \
  components/loanbrain/ \
  components/processing/ \
  components/coordinator/ \
  components/settings/DriveLoanBrainSetup.tsx \
  lib/loanbrain/ \
  lib/navigation.ts \
  lib/permissions.ts \
  "app/(app)/settings/page.tsx"
git commit -m "feat(loan-brain): add read-only drive browser and role workflows"
```

> Note: `lib/navigation.ts` also contains a one-item "Legends Academy" nav entry that belongs to the parent theme/academy work. It's harmless and the build passes with it. If you want it out of this commit, edit `lib/navigation.ts` to drop the `/training/academy` item before staging — otherwise leave as-is.

## Commit 3 — docs

```bash
git add \
  docs/MORTGAGE_DATA_MODEL.md \
  docs/LOAN_BRAIN_DRIVE_BROWSER.md \
  docs/ASHLEY_FLO_WORKFLOW.md \
  docs/GERALDINE_COORDINATOR_WORKFLOW.md \
  docs/LOAN_BRAIN_NEXT_ACTIONS.md \
  docs/LOAN_BRAIN_COMMIT_AND_PUSH.md
git commit -m "docs(loan-brain): document mortgage operations foundation"
```

## Commit 4 — desktop CI + e2e smoke (new files this agent added)

```bash
git add .github/workflows/desktop-build.yml tests/e2e/loan-brain-smoke.spec.ts
git commit -m "ci(loan-brain): desktop build workflow and route smoke tests"
```

## Push

```bash
git push -u origin feature/loan-brain-drive-browser
```

Then open the PR on GitHub. **Do not merge to main** until you've confirmed the Netlify deploy preview and decided how to handle the parent theme/academy work (see below).

## Deliberately LEFT UNCOMMITTED (unrelated parent-branch work)

Do **not** fold these into the Loan Brain commits. They are a separate effort (light mode, Legends Academy, training, persona system) carried onto this branch before Loan Brain work began:

- Modified: `app/(app)/dashboard/page.tsx`, `app/globals.css`, `app/layout.tsx`, `components/atlas/*`, `components/shell/*`, `docs/STATUS.md`, `tests/e2e/smoke.spec.ts`
- Untracked: `app/(app)/training/{academy,audio,roleplay,scripts}/`, `components/training/`, `components/ui/ThemeProvider.tsx`, `components/ui/ThemeToggle.tsx`, `lib/legends/`, `lib/theme.ts`, `docs/LEGENDS_*.md`, `supabase/seeds/legends_assistants.sql`

Recommended: after pushing the Loan Brain branch, stash or branch these into `feat/theme-academy` so they get their own review. The Loan Brain code does not import any of them (verified) and the production build passes regardless.

## Supabase migrations — NOT applied

The two migrations are validated but **were not applied** to any Supabase project. Apply them yourself, in order, only when ready:

```
20260530000000_mortgage_data_model.sql      (tables, indexes, coordinator enum, triggers)
20260530000100_mortgage_rls_policies.sql    (RLS + can_view_loan/owns_loan helpers)
```

via the Supabase SQL editor or `supabase db push`. The app runs on safe sample data until then (store falls back on `42P01`).
