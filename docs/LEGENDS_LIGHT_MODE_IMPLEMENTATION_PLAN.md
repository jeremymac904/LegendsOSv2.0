# Legends Light Mode — Implementation Plan

**Status:** Planning. No code authorized yet. Dark mode must remain the default and must not regress at any point.
**Date:** 2026-05-22
**Target:** LegendsOSv2.0
**Risk class:** Visual regression risk only — no auth/data/RLS impact.

---

## 1. Current state (audited)

### Tailwind config (`tailwind.config.ts`)
- `darkMode: "class"` is **already set**. This is the right primitive — we add light mode by removing the `dark` class from `<html>` when the user picks light.
- Brand color scale `ink` (950 → 100) and `accent` (gold/champagne/orange/ember/bronze) is hard-coded in the Tailwind theme. These colors are reused across modes; they do not need a light variant.
- `boxShadow` and `backgroundImage` entries use dark-leaning rgb values.

### Root layout (`app/layout.tsx`)
- `<html lang="en" className="dark">` — class is **hardcoded**. This must become dynamic.
- `<body className="min-h-screen bg-ink-950 font-sans text-ink-100 antialiased">` — `bg-ink-950` and `text-ink-100` are hardcoded dark values that need `dark:` qualifiers or to read from CSS variables.

### Global stylesheet (`app/globals.css`)
- Defines CSS variables at `:root` for dark only: `--bg: 5 6 10; --fg: 231 234 242; ...`
- `color-scheme: dark` is set on `:root`.
- `body` has a fixed dark gradient + `command-center-futuristic.jpg` background image.
- Component classes (`.card`, `.btn-primary`, `.input`, `.chip*`, `.nav-item-active`) all use dark-leaning values: `bg-ink-950/30`, `bg-ink-800/80`, `border-accent-champagne/10`, etc.

### Components
- Sidebar / TopBar / MobileNav use hardcoded `ink-XXX` classes.
- All module pages use hardcoded `text-ink-100`, `text-ink-300`, `bg-ink-950/...` strings throughout.
- Login page (`app/login/page.tsx`) and Setup page (`app/setup/page.tsx`) likely have additional hardcoded dark styling.

### What works in our favor

- `darkMode: "class"` lets us use the `dark:` variant for every dark-mode-only declaration.
- CSS variables in `:root` give us a single place to swap palette values.
- The brand colors (ink scale, accent gold) are intentionally the same across both modes — they're brand identity, not theme.

## 2. Strategy

A two-layer approach:

### Layer A: CSS variable swap

Move all "atmosphere" values (page background, surface background, text color, border defaults) into CSS variables, defined twice in `globals.css`:

```css
:root, .dark {
  color-scheme: dark;
  --bg-page: 5 6 10;
  --bg-surface: 14 17 25;        /* ink-850 */
  --bg-surface-elevated: 19 23 36; /* ink-800 */
  --fg-primary: 231 234 242;      /* ink-100 */
  --fg-secondary: 188 193 212;    /* ink-200 */
  --fg-muted: 140 147 175;        /* ink-300 */
  --border-default: 26 31 48;     /* ink-700 */
  --border-subtle: 19 23 36;      /* ink-800 */
  --bg-gradient-1: 5 6 10;
  --bg-gradient-2: 8 9 13;
  --backdrop-image: url("/assets/backgrounds/command-center-futuristic.jpg");
  --backdrop-overlay-opacity: 0.72;
  --glow-strength: 1;
}

.light {
  color-scheme: light;
  --bg-page: 248 249 252;         /* warm off-white */
  --bg-surface: 255 255 255;
  --bg-surface-elevated: 250 250 252;
  --fg-primary: 14 17 25;         /* deep ink */
  --fg-secondary: 51 58 78;
  --fg-muted: 100 107 130;
  --border-default: 224 228 238;
  --border-subtle: 235 238 246;
  --bg-gradient-1: 248 249 252;
  --bg-gradient-2: 240 243 250;
  --backdrop-image: url("/assets/backgrounds/command-center-light.jpg"); /* TODO: source light bg */
  --backdrop-overlay-opacity: 0.4;
  --glow-strength: 0.5;
}
```

Brand accents (gold, champagne, orange, bronze, ember) stay the same — they're brand, not theme.

### Layer B: Tailwind `dark:` rewrite for component classes

Component-level classes in `globals.css` (and any hardcoded `ink-XXX` Tailwind strings in `.tsx` files) are rewritten to use the CSS variables OR use Tailwind's `dark:` qualifier.

Two patterns, applied case-by-case:

**Pattern 1: CSS-var-driven (preferred for backgrounds, text, borders)**
```css
.card {
  @apply relative rounded-2xl border backdrop-blur-xl shadow-card transition-colors;
  background-color: rgb(var(--bg-surface) / 0.3);
  border-color: rgb(var(--border-default) / 0.6);
  color: rgb(var(--fg-primary));
}
```

**Pattern 2: Tailwind `dark:` variant (for component .tsx files where the existing class is already in markup)**
```tsx
<div className="bg-white text-ink-900 border-ink-200 dark:bg-ink-950/30 dark:text-ink-100 dark:border-ink-700">
```

The repo currently has many Pattern-2 sites because dark is hardcoded everywhere. Adding light values is a mechanical pass.

## 3. Phases

### Phase 1 — Token plumbing (zero visual change in dark mode)

**Acceptance:** Dark mode looks identical to today. `light` class on `<html>` produces a working light page even if some component pages are not yet polished.

Tasks:
1. Extend `globals.css` with the `:root, .dark` and `.light` variable blocks above.
2. Rewrite **only the global layer** of `globals.css` to use the variables (`html, body` background, `body` gradient, scrollbar styling if present).
3. Source or commission a light alternate of `command-center-futuristic.jpg` for `--backdrop-image`. Until that exists, fall back to a CSS gradient via `--bg-gradient-1` / `--bg-gradient-2` in light mode.
4. **Do not rewrite component classes (`.card`, `.btn-*`, `.chip*`, `.nav-item*`) yet.** They stay dark-leaning. Acceptable visual debt for the toggle landing.

Files touched:
```
app/globals.css                       ← only the global layer + variable defs
public/assets/backgrounds/            ← add command-center-light.jpg (or use gradient fallback)
```

Verification:
- `npm run lint`, `npm run typecheck`, `npm run build` — all green.
- Manual: visit `/login` in dark (unchanged) and forced light (page background light, components still dark-leaning) — both load.

### Phase 2 — Theme toggle wiring

**Acceptance:** A toggle in TopBar flips between light/dark, persists in localStorage, respects `prefers-color-scheme` on first load.

Tasks:
1. New component `components/ui/ThemeProvider.tsx` — client-side context provider that:
   - Reads `localStorage.legendsTheme` on mount.
   - Falls back to `window.matchMedia('(prefers-color-scheme: light)')` if no stored preference.
   - Adds/removes `dark` and `light` classes on `<html>`.
   - Exposes `useTheme()` returning `{ theme, setTheme }`.
2. Update `app/layout.tsx`:
   - Remove hardcoded `className="dark"` from `<html>`.
   - Add a small inline script in `<head>` that sets the initial class before paint (avoids FOUC):
     ```html
     <script dangerouslySetInnerHTML={{ __html: `
       (function(){
         try {
           var t = localStorage.getItem('legendsTheme');
           if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
           document.documentElement.classList.add(t);
         } catch(e) { document.documentElement.classList.add('dark'); }
       })();
     `}} />
     ```
   - Wrap children with `<ThemeProvider>`.
3. New component `components/ui/ThemeToggle.tsx` — sun/moon icon button (lucide-react `Sun` + `Moon`). On click, toggle `theme` via context.
4. Mount `<ThemeToggle />` in `components/shell/TopBar.tsx`.
5. Update `app/layout.tsx` viewport `themeColor` to be conditional (the viewport API doesn't support runtime conditionals; either ship a `<meta name="theme-color">` that updates via `useEffect`, or accept dark themeColor for now). Acceptable to defer.

Files touched:
```
app/layout.tsx
components/ui/ThemeProvider.tsx       ← NEW
components/ui/ThemeToggle.tsx         ← NEW
components/shell/TopBar.tsx
lib/theme.ts                          ← NEW (helpers/constants)
```

### Phase 3 — Component pass for light mode polish

**Acceptance:** All `(app)/*` and `/login`, `/setup` routes look intentional in both modes. No "broken-dark-card-on-light-bg" surfaces. Lighthouse contrast checks pass for primary text.

Tasks (per route, repeat for each):
1. Find every `bg-ink-XXX`, `text-ink-XXX`, `border-ink-XXX` in `.tsx` files.
2. Where the dark intent is correct, leave it (it inherits via the existing `.dark` class).
3. Where the surface needs a light counterpart, add light counterpart via `dark:` prefix or migrate to a CSS-var class.
4. For `.card`, `.btn-*`, `.chip*`, `.nav-item-active` in `globals.css`: refactor to use `rgb(var(--bg-surface) / 0.3)` for backgrounds, `rgb(var(--fg-primary))` for text, `rgb(var(--border-default))` for borders. Brand accent classes stay literal.
5. Body background image: in light mode, swap to the light alternate (or pure gradient). Already wired via `var(--backdrop-image)` from Phase 1.

Recommended pass order (highest visibility first):
1. `/login`
2. `/dashboard`
3. Shell (`Sidebar`, `TopBar`, `MobileNav`)
4. `/atlas` + `/atlas/[threadId]`
5. `/training`, `/marketing-materials`, `/lf-resources`
6. `/social`, `/email`, `/calendar`
7. `/admin/*`
8. `/settings`
9. `/knowledge`, `/shared`, `/images`

Each route gets a Playwright visual smoke check in both modes.

### Phase 4 — Asset adjustments

Tasks:
1. Logo: ensure `legends-os-logo.png` works on light backgrounds. If the current logo only reads on dark, source a dark-on-light variant and load conditionally via `useTheme()`.
2. Backgrounds: produce or source `command-center-light.jpg`.
3. Glow effects: scale down via `--glow-strength` in light mode (already set up in the variable block).
4. Status pills (`status-ok`, `status-warn`, `status-err`): verify contrast against light backgrounds. Adjust the `/10` opacity if pills look washed out.

### Phase 5 — Verification + ship

Tasks:
1. Playwright authenticated smoke in both modes for the route list above.
2. Lighthouse contrast pass (basic — Playwright has `getByRole` checks for visible text contrast).
3. Take screenshots of all surfaces in both modes for the design review.
4. Update `docs/STATUS.md` with a "Light mode shipped" section.
5. Default behavior: respects system preference for new users; existing users get dark by default (because `localStorage` key absent → default dark per the boot script logic). Acceptable; user can flip explicitly.

## 4. Production safety

This is **visual only**. No security/data/auth surface changes. Verification gate is:

- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run build` ✓ — Next.js build output unchanged size to within 1 KB except for the new files
- `npm run test:e2e` ✓ — extended smoke tests in both modes
- Manual screenshot pass on `/login`, `/dashboard`, `/atlas` in both modes before merge

No Netlify auto-deploy is triggered by this discovery doc. Build sprint will:
- Work on feature branch `feat/legends-light-mode`.
- Open PR for Jeremy.
- Do not push to `main` until Jeremy approves.

## 5. Rollback plan

If light mode introduces regressions:
- Remove `<ThemeToggle />` from TopBar — toggle disappears, default dark resumes.
- Revert `app/layout.tsx` to hardcoded `className="dark"`.
- `globals.css` extra variables are harmless to keep — they sit unused under `.light` which no element wears.

Rollback is a 3-line change. Zero data impact.

## 6. Out of scope

- Reduced-motion variant (separate accessibility pass).
- High-contrast mode (separate accessibility pass).
- Per-user theme stored server-side (Phase 6 if needed).
- Light mode for the Electron desktop chrome (uses host OS chrome — already adapts).
- Print stylesheet.

## 7. Open questions for Jeremy

1. Default behavior for new users: system preference vs always-dark vs always-light.
2. Light background image: source one (paid asset?) or settle for a clean gradient.
3. Light-mode logo: produce a dark-on-light variant or use the same logo.
4. Toggle position: TopBar (recommended) vs Settings page only vs both.
5. Do we want a "system" option in the toggle (3-state: light / dark / system) or just 2-state?

## 8. Estimated cost

| Phase | Effort | Risk |
|---|---|---|
| Phase 1 — Token plumbing | 0.5 day | Low — no component changes |
| Phase 2 — Toggle wiring | 0.5 day | Low — additive |
| Phase 3 — Component pass | 1.5–2 days | Medium — touches many files; visual regression risk per route |
| Phase 4 — Assets | 0.5 day (excl. design asset sourcing) | Low |
| Phase 5 — Verification | 0.5 day | Low |

**Total:** ~3.5–4 dev days for a fully polished light mode across all 18 routes.
