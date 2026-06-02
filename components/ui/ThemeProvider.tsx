"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DEFAULT_THEME, THEME_STORAGE_KEY, isLegendsTheme, type LegendsTheme } from "@/lib/theme";
import {
  applyThemeSnapshotToDocument,
  buildThemeSnapshot,
  DEFAULT_THEME_SNAPSHOT,
  persistThemeSnapshot,
  readCachedThemeSnapshot,
  type ResolvedThemeSnapshot,
} from "@/lib/themeSnapshot";

interface ThemeContextValue {
  theme: LegendsTheme;
  snapshot: ResolvedThemeSnapshot;
  setTheme: (next: LegendsTheme) => void;
  toggleTheme: () => void;
  refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function rebuildSnapshot(
  snapshot: ResolvedThemeSnapshot,
  overrides: Partial<Pick<ResolvedThemeSnapshot, "themeMode">> = {}
): ResolvedThemeSnapshot {
  return buildThemeSnapshot({
    themeMode: overrides.themeMode ?? snapshot.themeMode,
    textContrast: snapshot.textContrast,
    primaryColor: snapshot.primaryColor,
    secondaryColor: snapshot.secondaryColor,
    glassIntensity: snapshot.glassIntensity,
    sidebarOpacity: snapshot.sidebarOpacity,
    cardOpacity: snapshot.cardOpacity,
    loginBackgroundEnabled: snapshot.loginBackgroundEnabled,
    desktopBackgroundEnabled: snapshot.desktopBackgroundEnabled,
    logoPath: snapshot.logo.path,
    logoUrl: snapshot.logo.url,
    backgroundImagePath: snapshot.backgroundImage.path,
    backgroundImageUrl: snapshot.backgroundImage.url,
    backgroundVideoPath: snapshot.backgroundVideo.path,
    backgroundVideoUrl: snapshot.backgroundVideo.url,
    workspaceSlug: snapshot.workspaceSlug,
    workspaceDomain: snapshot.workspaceDomain,
    workspaceDisplayName: snapshot.workspaceDisplayName,
    loginHeadline: snapshot.loginHeadline,
    loginSubheadline: snapshot.loginSubheadline,
    defaultRedirectPath: snapshot.defaultRedirectPath,
    source: snapshot.source,
    updatedAt: snapshot.updatedAt,
  });
}

function applySnapshot(next: ResolvedThemeSnapshot, persist = true) {
  applyThemeSnapshotToDocument(next);
  if (persist) {
    persistThemeSnapshot(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next.mode);
    } catch {
      // Best-effort only.
    }
  }
}

/**
 * ThemeProvider keeps the current LegendsOS theme snapshot in sync with the
 * document, the local cache used by the desktop shell, and the live server
 * theme endpoint. This preserves the existing light/dark toggle while adding
 * user and workspace-specific theme state.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshotState] = useState<ResolvedThemeSnapshot>(() => {
    const cached = readCachedThemeSnapshot();
    if (cached) return cached;
    return DEFAULT_THEME_SNAPSHOT;
  });

  const [theme, setThemeState] = useState<LegendsTheme>(() => {
    const cached = readCachedThemeSnapshot();
    if (cached) return cached.mode;
    return DEFAULT_THEME;
  });

  const commitSnapshot = useCallback(
    (next: ResolvedThemeSnapshot, persist = true) => {
      setSnapshotState(next);
      setThemeState(next.mode);
      applySnapshot(next, persist);
    },
    []
  );

  useEffect(() => {
    // Keep the DOM aligned with the cached snapshot immediately on hydrate.
    applySnapshot(snapshot, false);
  }, [snapshot]);

  const refreshTheme = useCallback(async () => {
    try {
      const res = await fetch("/api/theme", {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; theme?: ResolvedThemeSnapshot }
        | null;
      if (!res.ok || !data?.ok || !data.theme) return;
      commitSnapshot(rebuildSnapshot(data.theme), true);
    } catch {
      // Offline or unauthenticated login state. Keep the cached snapshot.
    }
  }, [commitSnapshot]);

  useEffect(() => {
    // Refresh from the live theme endpoint after hydration so the desktop
    // shell and authenticated web shell pick up the persisted settings.
    void refreshTheme();
  }, [refreshTheme]);

  const setTheme = useCallback(
    (next: LegendsTheme) => {
      if (!isLegendsTheme(next)) return;
      commitSnapshot(rebuildSnapshot(snapshot, { themeMode: next }), true);
    },
    [commitSnapshot, snapshot]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, snapshot, setTheme, toggleTheme, refreshTheme }),
    [refreshTheme, setTheme, snapshot, theme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="relative min-h-screen">
        <div className="relative z-0">
          <ThemeBackdrop />
        </div>
        <div className="relative z-10">{children}</div>
      </div>
    </ThemeContext.Provider>
  );
}

function ThemeBackdrop() {
  const { snapshot } = useTheme();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const path =
    typeof window !== "undefined" ? window.location.pathname : "";
  const isLogin = path.startsWith("/login");
  const enabled = isLogin
    ? snapshot.loginBackgroundEnabled
    : snapshot.desktopBackgroundEnabled;

  if (!enabled || reducedMotion || !snapshot.backgroundVideo.url) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-[0.18] mix-blend-screen"
        src={snapshot.backgroundVideo.url}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,10,0.18),rgba(5,6,10,0.58))] dark:bg-[linear-gradient(180deg,rgba(5,6,10,0.2),rgba(5,6,10,0.72))]" />
    </div>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
