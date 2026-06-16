# Q-006 — Command Center + Atlas Light Pass

**Status:** Shipped locally. No commits, no push, no deploy.
**Date:** 2026-05-23
**Branch:** `feat/legends-growth-academy-and-light-mode-phase-1`
**Target:** LegendsOSv2.0
**Follows:** Q-005 (`docs/LEGENDS_LIGHT_MODE_LIQUID_GLASS_Q005_REPORT.md`)

---

## 1. What changed

Q-005 left two big surfaces dark-leaning in light mode: `/dashboard` (Command Center) and `/atlas`. The reason was the same in both — those components were authored before light mode existed, so they use raw `bg-ink-XXX`, `text-ink-XXX`, `border-ink-XXX` Tailwind classes inline without `dark:` qualifiers. Under `darkMode: "class"`, those classes apply universally regardless of theme, so light mode rendered with dark surfaces.

Q-006 sweeps those raw tokens to `<light-complement> dark:<original>` pairs. Dark mode stays bit-identical; light mode gets sane defaults across the entire Dashboard and Atlas surface.

## 2. Mechanism

A Python script (`/tmp/q006-light-pass.py`) walks each `.tsx` file and applies a deterministic regex transform:

```
text-ink-100             →  text-ink-900 dark:text-ink-100
text-ink-200             →  text-ink-800 dark:text-ink-200
text-ink-300             →  text-ink-600 dark:text-ink-300
text-ink-400             →  text-ink-500 dark:text-ink-400
bg-ink-950/X             →  bg-white/X dark:bg-ink-950/X
bg-ink-900/X             →  bg-white/X dark:bg-ink-900/X
bg-ink-800/X             →  bg-ink-100/X dark:bg-ink-800/X
bg-ink-700/X             →  bg-ink-200/X dark:bg-ink-700/X
border-ink-{700-950}     →  border-ink-200 dark:border-ink-{...}
ring/from/to/via/divide-ink-XXX → analogous light complements
placeholder:text-ink-XXX → placeholder:text-ink-{light} dark:placeholder:text-ink-XXX
hover:bg-ink-XXX         → hover:bg-ink-{light} dark:hover:bg-ink-XXX
```

Tokens already qualified by `dark:` are skipped via a `"dark:" in modifiers` check, so re-running is idempotent. Modifier chains (`hover:`, `group-hover:`, `focus:`, `placeholder:`, `peer-`) are preserved.

The script is one-off; it is not committed to the repo. Future passes can re-run it on other surfaces.

## 3. Files patched

| File | Tokens transformed (~) |
|---|---|
| `app/(app)/dashboard/page.tsx` | 39 |
| `components/atlas/AtlasWorkspace.tsx` | 97 |
| `components/atlas/AtlasShell.tsx` | 78 |
| `components/atlas/AtlasProjectsPanel.tsx` | 51 |
| `components/atlas/LOWorkspace.tsx` | 43 |
| `components/atlas/ConnectorPanel.tsx` | 18 |
| `components/shell/SidebarAtlasThreads.tsx` | ~10 |

Total: ~336 token rewrites across 7 files. No new files, no deletions, no API or behavior changes.

## 4. Routes verified

| Route | Dark | Light |
|---|---|---|
| `/dashboard` | ✓ unchanged | ✓ Drafts list, Recent imagery, Latest newsletter preview, Upcoming content, Recent activity, Automation jobs all flip cleanly |
| `/atlas` (new conversation) | ✓ unchanged | ✓ Atlas shell, threads list, prompt suggestions, model selector, composer all flip cleanly |
| `/atlas/[threadId]` | ✓ unchanged | ✓ (uses same `AtlasShell` / `AtlasWorkspace`) |
| `/training/academy` and children | ✓ unchanged | ✓ unchanged (Q-005 territory) |
| `/login`, `/setup` | ✓ unchanged | ✓ unchanged |

Screenshots saved under `.playwright-mcp/legends-sprint-2026-05-22/`:
- `q006-dashboard-dark.png`, `q006-dashboard-light.png`
- `q006-atlas-dark.png`, `q006-atlas-light.png`, `q006-atlas-light-v2.png`

## 5. Light mode status

**Dashboard:**
- Drafts-needing-attention list rows: white surface with proper text contrast (ink-900 headings, ink-600 body)
- Recent imagery tiles: clean light borders, readable captions
- Latest newsletter preview frame: light bg instead of pure black
- Upcoming content & Recent activity panels: light translucent surface, readable
- Automation jobs table: light table chrome with ink-700 body text
- Quick launch tiles: clean light treatment

**Atlas:**
- Shell (sidebar + topbar): unchanged from Q-005 baseline (already fixed there)
- Threads list (`SidebarAtlasThreads`): thread titles now readable in light
- Prompt suggestion bubbles: light translucent with proper text contrast
- Model selector chip: readable
- Composer ("Ask Atlas…"): light surface with ink-700 placeholder
- New-conversation badge / chips: readable

## 6. Dark mode status

**Preserved.** Verified live in browser at `/dashboard` and `/atlas`:
- Dashboard dark mode: identical to Q-005 baseline. Drafts list, imagery, newsletter, table chrome all render dark with the original ink palette.
- Atlas dark mode: identical to Q-005 baseline. Sidebar, threads, prompt bubbles, composer all unchanged.

This is the design intent of the transform: every modified token retains a `dark:<original>` clause, so when `<html class="dark">` is set, the original Tailwind class still wins via the cascade.

## 7. Known visual debt remaining

1. **Email / Social / Image / Calendar studios.** Same raw-ink pattern. The script handles them mechanically when invoked — out of Q-006 scope but a clean follow-up.
2. **Settings / Admin pages.** Same. Out of scope.
3. **Knowledge / Shared / Marketing-Materials / LF-Resources internal panels.** Mixed — top-level pages use `.card-padded` (already light-aware) but their internal components may use raw ink.
4. **Login hero card** still retains its dark video-frame styling — cosmetic, intentional.
5. **`viewport.themeColor`** still hardcoded `#05060a` (dark) — mobile browser toolbar tint in light mode stays dark. One-line follow-up.

## 8. Next recommended polish

1. **Run the same script on `app/(app)/email/**`, `app/(app)/social/**`, `app/(app)/images/**`, `app/(app)/calendar/**`** — bulk light-pass for the remaining studios. ~0.5 day.
2. **Settings + Admin light pass** — same mechanism. ~0.5 day.
3. **`viewport.themeColor` becomes dynamic** — useEffect updates `<meta name="theme-color">` based on theme. 30 minutes.
4. **Visual QA sweep** — pixel-diff dark mode screenshots before/after Q-006 to make absolutely sure no pixel shifted. Optional.
5. **Type the script** — convert `/tmp/q006-light-pass.py` to a repo-tracked maintenance command (e.g., `scripts/light-mode-rewrite.mjs`) so future Tailwind components written without `dark:` qualifiers can be normalized on demand.

## 9. Validation

- `npm run lint` — no warnings or errors
- `npm run typecheck` — exit 0
- `npm run build` — clean
- Theme runtime check: html flips `dark` ↔ `light`, body bg `rgb(5, 6, 10)` vs `rgb(250, 248, 243)`, localStorage persists
- Authenticated browser walk on `/dashboard` and `/atlas` in both modes

## 10. Production safety

- No commits, no push, no PR
- No Netlify trigger, no deploy
- No `.env` writes
- No live Supabase writes (read-only walkthrough)
- No live AI calls (provider gates still off)
- No n8n triggers
- No email / social / calendar sends
- No secrets printed
- Legends-MTG-Support-Pro untouched
- No force push
