/**
 * Theme system constants and helpers for LegendsOS.
 *
 * Pairs with:
 *   - app/globals.css       (CSS variable definitions for :root, .dark, .light)
 *   - app/layout.tsx        (boot-time FOUC-safe class application)
 *   - components/ui/ThemeProvider.tsx
 *   - components/ui/ThemeToggle.tsx
 */

export type LegendsTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "legendsTheme";

export const DEFAULT_THEME: LegendsTheme = "dark";

export function isLegendsTheme(value: unknown): value is LegendsTheme {
  return value === "dark" || value === "light";
}

/**
 * Read the stored theme if present, otherwise fall back to the user's system
 * preference, otherwise the LegendsOS default (dark). Safe to call on the
 * server — returns DEFAULT_THEME when there is no window.
 */
export function resolveInitialTheme(): LegendsTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isLegendsTheme(stored)) return stored;
  } catch {
    // localStorage can throw in private modes. Fall through.
  }
  try {
    const prefersLight = window.matchMedia?.(
      "(prefers-color-scheme: light)"
    ).matches;
    return prefersLight ? "light" : "dark";
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Boot script body — applied as an inline <script> in <head> before paint so
 * the correct class is on <html> before React hydrates. Avoids the
 * flash-of-wrong-theme.
 *
 * Read by app/layout.tsx via dangerouslySetInnerHTML.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}var html=document.documentElement;html.classList.remove("light","dark");html.classList.add(t);html.style.colorScheme=t;}catch(_){document.documentElement.classList.add("${DEFAULT_THEME}");}})();`;
