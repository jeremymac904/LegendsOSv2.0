/**
 * Theme system constants and helpers for LegendsOS.
 *
 * Pairs with:
 *   - app/globals.css       (CSS variable definitions for :root, .dark, .light)
 *   - app/layout.tsx        (boot-time FOUC-safe class application)
 *   - components/ui/ThemeProvider.tsx
 *   - components/ui/ThemeToggle.tsx
 */

import {
  DEFAULT_THEME_BODY_BACKGROUNDS,
  THEME_SNAPSHOT_STORAGE_KEY,
  readCachedThemeSnapshot,
} from "@/lib/themeSnapshot";

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
  const cachedSnapshot = readCachedThemeSnapshot();
  if (cachedSnapshot) return cachedSnapshot.mode;
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

const DEFAULT_DARK_BODY_BACKGROUND = DEFAULT_THEME_BODY_BACKGROUNDS.dark.replace(/"/g, '\\"');
const DEFAULT_LIGHT_BODY_BACKGROUND = DEFAULT_THEME_BODY_BACKGROUNDS.light.replace(/"/g, '\\"');

/**
 * Boot script body — applied as an inline <script> in <head> before paint so
 * the correct class is on <html> before React hydrates. Avoids the
 * flash-of-wrong-theme.
 *
 * Read by app/layout.tsx via dangerouslySetInnerHTML.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var html=document.documentElement;var darkBg="${DEFAULT_DARK_BODY_BACKGROUND}";var lightBg="${DEFAULT_LIGHT_BODY_BACKGROUND}";var raw=localStorage.getItem("${THEME_SNAPSHOT_STORAGE_KEY}");if(raw){var s=JSON.parse(raw);var mode=s&&s.themeMode==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):s&&s.mode==="light"?"light":"dark";var defaultBg=mode==="light"?lightBg:darkBg;html.classList.remove("light","dark");html.classList.add(mode);html.style.colorScheme=mode;var vars=[["--primary-gold",s&&s.primaryColor],["--burnt-gold",s&&s.secondaryColor],["--champagne-highlight",s&&s.primaryColor],["--accent-2",s&&s.secondaryColor],["--accent-ember",s&&s.secondaryColor],["--accent-bronze",s&&s.primaryColor],["--glass-border",s&&s.primaryColor],["--theme-sidebar-opacity",s&&s.sidebarOpacity],["--theme-card-opacity",s&&s.cardOpacity],["--theme-glass-intensity",s&&s.glassIntensity],["--bg",mode==="light"?"248 250 252":"9 11 17"],["--fg",mode==="light"?"10 13 21":"242 245 252"],["--muted",mode==="light"?"51 58 78":"160 168 191"],["--muted-text",mode==="light"?"51 58 78":"160 168 191"],["--theme-body-background",defaultBg]];for(var i=0;i<vars.length;i++){var pair=vars[i];if(pair[1]!==undefined&&pair[1]!==null&&pair[1]!==""){html.style.setProperty(pair[0],String(pair[1]));}}}else{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}html.classList.remove("light","dark");html.classList.add(t);html.style.colorScheme=t;html.style.setProperty("--theme-body-background",t==="light"?lightBg:darkBg);}}catch(_){document.documentElement.classList.add("${DEFAULT_THEME}");}})();`;
