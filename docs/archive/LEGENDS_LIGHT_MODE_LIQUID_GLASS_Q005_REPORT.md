# Q-005 — Light Mode Contrast + Liquid Glass UI Pass

**Status:** Shipped locally. No commits, no push, no deploy.
**Date:** 2026-05-22
**Branch:** `feat/legends-growth-academy-and-light-mode-phase-1`
**Target:** LegendsOSv2.0
**Pairs with:** `LEGENDS_LIGHT_MODE_IMPLEMENTATION_PLAN.md`, prior Q-003 sprint log in `docs/STATUS.md`

---

## 1. What changed

Two layers of fixes:

**A. CSS variable + reusable class layer (`app/globals.css`)**

- Light-mode token block `.light` rebalanced toward a **warm champagne cream palette** (`--bg: 250 248 243`) instead of the prior cool blue-white. Removes the "corporate Bootstrap" feel and matches the Legends gold accent system.
- `.light body` rewritten with a **three-radial warm gradient** (burnt-gold top-left, champagne top-right, soft champagne bottom-left) over a soft cream base. Gives the page a "breathing" premium feel instead of a flat slab.
- `.light .card` upgraded to a **champagne-tinted liquid-glass surface** — translucent enough to let the body's gradient breathe through, sharp enough to keep text crisp. Added inset highlight + soft drop shadow with warm undertone.
- New `.glass-card` and `.glass-card-padded` classes — a **more pronounced liquid-glass variant** for Academy/Training surfaces. Stronger backdrop-blur, frosted bg, gold hairline, warm hover glow. Dark variant is full liquid-glass; light variant is high-translucency cream with gold-bordered shine.
- New `.glass-panel` class for nested translucent panels inside cards.
- `.light .btn-ghost` icon color bumped from `rgb(91, 99, 128)` → `rgb(51, 58, 78)` for **strong icon contrast on light backgrounds** (Bell, Moon/Sun, LogOut).
- `.light .chip` gained a subtle white-to-cream gradient + gold border for premium chip feel.
- `.light .nav-item-active` gradient warmed (cream + gold) and gained a soft drop shadow for active state pop.
- `.light .label`, `.light .field-label`, `.light .section-title p` muted text colors strengthened to ink-600 / ink-700 ranges for **legible secondary text** without losing the muted feel.

**B. Markup layer (TopBar / Sidebar / MobileNav)**

The shell chrome had **hardcoded `bg-ink-950/X` and `text-ink-XXX` Tailwind classes** that applied in both modes — so in light mode the entire header/sidebar still rendered dark. Each consumer was rewritten with `dark:` variants:

- `TopBar` (`components/shell/TopBar.tsx`)
  - Header bar: `bg-white/75 dark:bg-ink-950/65`, `border-ink-900/10 dark:border-accent-champagne/10`
  - Eyebrow caption: `text-ink-500 dark:text-ink-400`
  - Page title: `text-ink-900 dark:text-ink-100`
  - Search input: light glass surface (`bg-white/70 dark:bg-ink-950/40`), search icon and placeholder upgraded for light
  - ⌘ K hint chip: light bg, ink-600 text in light mode
  - Profile chip: same light/dark treatment
  - Role pill color: `text-accent-orange dark:text-accent-champagne` for stronger contrast on light bg
  - `<ThemeToggle />` already in place from Q-003

- `Sidebar` (`components/shell/Sidebar.tsx`)
  - Sidebar bg: `bg-white/75 dark:bg-ink-950/78`
  - Borders: `border-ink-900/10 dark:border-accent-champagne/10`
  - Logo container surface lifted in light mode (champagne border, white bg)
  - Section headers, nav-item icons, ChevronRight all flip to ink-600/ink-900 in light
  - User card at bottom: light glass treatment with proper dark text and gold accent

- `MobileNav` (`components/shell/MobileNav.tsx`)
  - Backdrop and drawer chrome both flip for light/dark
  - Nav item icons follow the same active/inactive light/dark pattern

**C. Academy / Training surfaces (`components/training/*`, `app/(app)/training/**`)**

- All Academy components swapped from `card-padded` → `glass-card-padded` for the premium frosted treatment:
  - `AcademyTrackCard.tsx`
  - `ModuleListItem.tsx`
  - `LegendsAssistantsCatalog.tsx`
  - `app/(app)/training/academy/page.tsx`
  - `app/(app)/training/academy/[track]/page.tsx`
  - `app/(app)/training/academy/[track]/[module]/page.tsx`
  - `app/(app)/training/scripts/page.tsx`
  - `app/(app)/training/roleplay/page.tsx`
  - `app/(app)/training/audio/page.tsx`

No other consumers of `.card-padded` were touched — Command Center, Dashboard, Settings, etc. continue to use `.card-padded` (which itself received a refined `.light` override but no new design token).

## 2. Theme tokens / classes adjusted

| Token | Dark | Light (new) | Light (old) |
|---|---|---|---|
| `--bg` | `5 6 10` | `250 248 243` (warm cream) | `248 249 252` (cool blue-white) |
| `--fg` | `231 234 242` | `14 17 25` | `14 17 25` |
| `--muted` | `140 147 175` | `71 78 102` (deeper) | `91 99 128` |
| `--dark-charcoal` | `8 9 13` | `245 240 230` (warm) | `240 243 250` (cool) |
| `--black-glass` | `5 6 10` | `255 255 255` | `255 255 255` |
| Brand accents | unchanged across modes | unchanged | unchanged |

New reusable classes:
- `.glass-card` — premium liquid-glass surface, dark + light variants
- `.glass-card-padded` — `.glass-card` + `p-5`
- `.glass-panel` — unbordered nested translucent surface

Updated component-class light overrides (`.light .X { … }`):
- `.card`, `.card::before`, `.card:hover`
- `.glass-card`, `.glass-card::before`, `.glass-card:hover`
- `.glass-panel`
- `.btn`, `.btn:hover`, `.btn-primary`, `.btn-secondary`, `.btn-secondary:hover`, `.btn-ghost`, `.btn-ghost:hover`
- `.input`, `.input:focus`, `.textarea`, `.textarea:focus`, placeholder colors
- `.label`, `.field-label`
- `.chip` (added gradient), `.chip-active`
- `.section-title h2`, `.section-title p`
- `.divider`
- `.nav-item`, `.nav-item:hover`, `.nav-item-active` (warmer gradient + soft shadow)
- `.scrollbar-thin::-webkit-scrollbar-thumb`

## 3. Routes checked

Browser walked in both modes via Chrome DevTools MCP (authenticated session):

| Route | Dark | Light |
|---|---|---|
| `/dashboard` (Command Center) | ✓ unchanged | ✓ shell + .card surfaces flip; some internal Command Center components still use raw ink classes — see §6 |
| `/training/academy` (Academy landing) | ✓ premium glass | ✓ premium glass |
| `/training/academy/sales` | ✓ premium glass | ✓ premium glass |
| `/training/academy/sales/sales-101` | ✓ premium glass | ✓ premium glass |
| `/training/academy/marketing`, `/ai`, `/mastery` | (same template as `/sales`) | (same) |
| `/training/scripts`, `/training/roleplay`, `/training/audio` | (same glass-card pattern) | (same) |
| `/login`, `/setup` | ✓ unchanged | ✓ shell-less, body bg flips correctly |

Screenshots saved under `.playwright-mcp/legends-sprint-2026-05-22/`:
- `q005-academy-dark.png`, `q005-academy-light.png`
- `q005-sales-dark.png`, `q005-sales-light.png`
- `q005-dashboard-dark.png`, `q005-dashboard-light.png`
- `q005-module-light.png`

## 4. Light mode status

**Premium and readable.** The Academy / Training surfaces now feel intentional in light mode:

- Body has a warm champagne wash with gold radials — not a flat slate.
- Sidebar and TopBar flip to a light-glass surface with dark, readable text and icons.
- All Bell / Sun / Moon / LogOut icons are clearly visible in the TopBar.
- Glass-card surfaces have soft champagne shine, gold-tinted borders, and high-contrast text.
- Chips have subtle white-to-cream gradients with gold borders.
- Active nav item has a warm gradient and a soft glow.
- The "Sign out" button is now ink-700-ish text with a subtle cream hover bg.

## 5. Dark mode status

**Preserved.** Dark mode is structurally unchanged:

- `:root` token block intact.
- `.card`, `.glass-card`, `.btn*`, `.chip*`, `.nav-item*` dark styles unchanged.
- Sidebar / TopBar / MobileNav: the markup-level `dark:` variants explicitly preserve the previous dark classes (`dark:bg-ink-950/65`, `dark:bg-ink-950/78`, `dark:border-accent-champagne/10`, `dark:text-ink-XXX`).
- Body gradient + command-center-futuristic.jpg image still load only in dark.
- Glass-card adds **new** styling for the Academy surfaces in both modes — dark Academy cards now feel a tier more "frosted" than dark Command Center cards, which is the intentional design direction.

Verified live in browser: body bg `rgb(5, 6, 10)` in dark, `rgb(250, 248, 243)` in light. No visual regression on dark Dashboard, Academy, or Sales-track screenshots.

## 6. Known visual debt

1. **Dashboard internal components.** Some Command Center widgets (e.g., the "Drafts needing attention" list rows, "Latest newsletter" preview frame, "Upcoming content" / "Recent activity" panels) use raw `bg-ink-XXX` and `text-ink-XXX` Tailwind classes inline rather than `.card`. They still render dark in light mode. Acceptable for this sprint — user directive was "preserve Command Center if it already looks good" and Command Center was not in scope. Next sprint can sweep these to either `.card-padded` or `dark:` variants.

2. **Atlas Workspace.** `/atlas` uses a complex client-side workspace component (`AtlasWorkspace`) with its own internal panels and chat composer. Many of its sub-surfaces use raw ink classes. Out of Q-005 scope — flagged for a dedicated `/atlas` light-mode pass.

3. **Email / Social / Image / Calendar Studios.** Same pattern — their internal frames use raw ink classes. Out of scope for Q-005.

4. **Login hero card.** The `/login` page hero card has its own bg-image styling (kept the dark video frame). Cosmetic; the surrounding cards flip correctly.

5. **Theme-color meta tag.** `viewport.themeColor` in `app/layout.tsx` is still hardcoded `#05060a` (dark). Browser toolbar tint on mobile in light mode is therefore dark. Easy follow-up: switch to dynamic via `useEffect` or accept dark as a permanent identity choice.

## 7. Next recommended UI polish

In priority order:

1. **Dashboard / Command Center light pass.** Sweep internal widgets (drafts list, recent imagery, upcoming content) to use `.card-padded` or `dark:` Tailwind variants. ~0.5 day.
2. **Atlas Workspace light pass.** Dedicated pass through `AtlasWorkspace`, `AtlasComposer`, threads list, chat bubble styles, and the projects/resources side rails. ~1 day.
3. **Email / Social / Image / Calendar Studio light pass.** Mostly mechanical — replace raw ink classes with `dark:` variants. ~1 day across all four studios.
4. **Refine `.light` button gradient stops** so `.btn-primary` reads as a slightly more saturated gold against the cream body (currently the gradient is identical to dark mode; on cream bg it sits a touch flat).
5. **Add reduced-motion respect** to the `.gold-shimmer` and `command-glow` keyframes.

Each is additive. None require touching dark mode.

## 8. Validation

- `npm run lint` — no warnings or errors
- `npm run typecheck` — exit 0
- `npm run build` — clean (had one mid-pass fix for invalid Tailwind opacity values like `/8`, `/12`, `/14`, `/26`, `/92` — corrected to the standard scale)
- HTTP probe — all routes resolve, authenticated session walks Dashboard / Academy / Sales / Module pages cleanly
- Theme runtime check — `<html>` flips `dark` ↔ `light`, `--bg` resolves to `250 248 243` / `5 6 10`, localStorage persists

## 9. Production safety

- No commits, no push, no PR.
- No Netlify trigger, no deploy.
- No live Supabase writes — read-only browser walkthrough.
- No live AI calls — provider gates still false.
- No n8n triggers.
- No email / social / calendar sends.
- No `.env` writes.
- No secrets printed.
- Legends-MTG-Support-Pro untouched.
