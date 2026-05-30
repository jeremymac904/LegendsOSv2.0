# UX Sprint — Commit & Deploy (run on your Mac)

All UX-sprint code is written into the working tree and **verified** (lint ✓, typecheck ✓).
The build agent could **not** commit/push from its environment:

- The repo's `.git` is on a **fuseblk mount** that denies temp-object cleanup, so git object writes (`write-tree`/`commit`) are unreliable there — risk of a corrupt commit, so the agent deliberately did **not** force it.
- **No push credentials** exist in that environment (`git push` → "could not read Username").

Both are normal on your Mac. The branch `feat/ux-theme-academy-polish` is currently at `c06298f` (= `main`; no commits made, nothing corrupted). Run the steps below from the repo root.

```bash
cd "/Volumes/LegendsOS/Jeremy's_2026_Master_Build_Folder/legends-team-builds/legendsos/legendsos-v2"
rm -f .git/index.lock                 # clear any stale lock
git switch feat/ux-theme-academy-polish   # already created; or: git switch -c feat/ux-theme-academy-polish
git config user.name  "Jeremy McDonald"   # if not already set
git config user.email "jeremy@mcdonald-mtg.com"
```

## Commit 1 — universal theme + Atlas full-height layout

```bash
git add app/globals.css app/layout.tsx \
  components/ui/ThemeProvider.tsx components/ui/ThemeToggle.tsx lib/theme.ts \
  components/shell/TopBar.tsx components/shell/Sidebar.tsx \
  components/shell/MobileNav.tsx components/shell/SidebarAtlasThreads.tsx \
  components/atlas/AtlasWorkspace.tsx components/atlas/AtlasShell.tsx \
  components/atlas/AtlasProjectsPanel.tsx components/atlas/ConnectorPanel.tsx \
  components/atlas/LOWorkspace.tsx "app/(app)/dashboard/page.tsx"
git commit -m "feat(ux): universal light/dark theme + Atlas full-height layout"
```

## Commit 2 — Legends Academy + training surfaces

```bash
git add "app/(app)/training/academy" "app/(app)/training/audio" \
  "app/(app)/training/roleplay" "app/(app)/training/scripts" \
  components/training lib/legends lib/navigation.ts
git commit -m "feat(academy): Legends Academy routes, curriculum, and training surfaces"
```

## Commit 3 — Loan Brain UX polish (sample banners, My Loans, coordinator preview)

```bash
git add components/loanbrain/SampleModeBanner.tsx \
  "app/(app)/processing/page.tsx" "app/(app)/coordinator/page.tsx" \
  "app/(app)/my-loans/page.tsx" lib/loanbrain/store.ts components/admin/UserManager.tsx
git commit -m "feat(loan-brain): sample-mode banners, richer My Loans, coordinator role preview"
```

## Commit 4 — chore + docs

```bash
git add .gitignore docs/STATUS.md docs/LEGENDS_*.md docs/UX_SPRINT_COMMIT_AND_DEPLOY.md
git commit -m "chore(ux): ignore *.orig, add UX sprint docs + STATUS update"
```

## Verify, push, PR, deploy

```bash
npm run lint && npm run typecheck && npm run build      # build needs your Mac's RAM
npm run desktop:build:mac                               # produces dist-desktop/*.dmg (macOS only)

git push -u origin feat/ux-theme-academy-polish
gh pr create --base main --head feat/ux-theme-academy-polish \
  --title "UX sprint: theme, Atlas layout, Academy, role polish" \
  --body "Universal light/dark, Atlas full-height composer, Legends Academy live, sample-mode banners, coordinator role preview."
# After CI/preview looks good:
gh pr merge --squash --delete-branch     # Netlify production deploy publishes on merge to main
```

## Left uncommitted on purpose

- `supabase/seeds/legends_assistants.sql` — parent-effort manual seed, not needed for build; commit it separately if you want it in the repo.
- The agent did **not** apply any Supabase migration and did **not** touch Drive/email/social/n8n.
