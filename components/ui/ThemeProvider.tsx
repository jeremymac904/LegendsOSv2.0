"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isLegendsTheme,
  type LegendsTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: LegendsTheme;
  setTheme: (next: LegendsTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * ThemeProvider keeps the `light`/`dark` class on <html> in sync with the
 * user's chosen theme and persists the choice in localStorage. The boot
 * script in app/layout.tsx applies the initial class before paint to avoid
 * a flash; this provider takes over once the client hydrates.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<LegendsTheme>(DEFAULT_THEME);

  useEffect(() => {
    // Reflect the class that the boot script applied so React state matches
    // what the user actually sees, then keep them in sync going forward.
    const html = document.documentElement;
    const initial: LegendsTheme = html.classList.contains("light")
      ? "light"
      : "dark";
    setThemeState(initial);
  }, []);

  const applyTheme = useCallback((next: LegendsTheme) => {
    const html = document.documentElement;
    html.classList.remove("light", "dark");
    html.classList.add(next);
    html.style.colorScheme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable in private mode; ignore.
    }
  }, []);

  const setTheme = useCallback(
    (next: LegendsTheme) => {
      if (!isLegendsTheme(next)) return;
      setThemeState(next);
      applyTheme(next);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
