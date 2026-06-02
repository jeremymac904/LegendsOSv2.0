import type {
  ThemeContrastPreference,
  ThemeModeSetting,
} from "@/types/database";

export type ResolvedThemeMode = "dark" | "light";

export interface ThemeMediaRef {
  path: string | null;
  url: string | null;
}

export interface ResolvedThemeSnapshot {
  mode: ResolvedThemeMode;
  themeMode: ThemeModeSetting;
  textContrast: ThemeContrastPreference;
  primaryColor: string;
  secondaryColor: string;
  glassIntensity: number;
  sidebarOpacity: number;
  cardOpacity: number;
  loginBackgroundEnabled: boolean;
  desktopBackgroundEnabled: boolean;
  bodyBackground: string;
  logo: ThemeMediaRef;
  backgroundImage: ThemeMediaRef;
  backgroundVideo: ThemeMediaRef;
  workspaceSlug: string | null;
  workspaceDomain: string | null;
  workspaceDisplayName: string | null;
  loginHeadline: string | null;
  loginSubheadline: string | null;
  defaultRedirectPath: string;
  source: "default" | "workspace" | "user";
  updatedAt: string | null;
}

export const THEME_SNAPSHOT_STORAGE_KEY = "legendsThemeSnapshot:v1";

export const DEFAULT_THEME_COLORS = {
  primary: "#C79635",
  secondary: "#9B6828",
};

export const DEFAULT_THEME_SNAPSHOT: ResolvedThemeSnapshot = {
  mode: "dark",
  themeMode: "dark",
  textContrast: "high",
  primaryColor: DEFAULT_THEME_COLORS.primary,
  secondaryColor: DEFAULT_THEME_COLORS.secondary,
  glassIntensity: 0.82,
  sidebarOpacity: 0.78,
  cardOpacity: 0.34,
  loginBackgroundEnabled: true,
  desktopBackgroundEnabled: true,
  bodyBackground:
    'linear-gradient(180deg, rgba(5,6,10,0.72) 0%, rgba(5,6,10,0.9) 58%, rgba(5,6,10,0.95) 100%), radial-gradient(70% 55% at 30% 8%, rgba(155,104,40,0.14) 0%, rgba(155,104,40,0) 62%), radial-gradient(45% 50% at 88% 20%, rgba(226,201,120,0.11) 0%, rgba(226,201,120,0) 64%), url("/assets/backgrounds/command-center-futuristic.jpg")',
  logo: { path: null, url: null },
  backgroundImage: {
    path: "/assets/backgrounds/command-center-futuristic.jpg",
    url: "/assets/backgrounds/command-center-futuristic.jpg",
  },
  backgroundVideo: { path: null, url: null },
  workspaceSlug: null,
  workspaceDomain: null,
  workspaceDisplayName: null,
  loginHeadline: null,
  loginSubheadline: null,
  defaultRedirectPath: "/dashboard",
  source: "default",
  updatedAt: null,
};

export interface ThemeStyleVars {
  [key: string]: string;
}

function clampNumber(value: unknown, fallback: number, min = 0, max = 1): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeMode(value: unknown): ThemeModeSetting {
  return value === "light" || value === "system" ? value : "dark";
}

function normalizeContrast(value: unknown): ThemeContrastPreference {
  return value === "normal" || value === "soft" ? value : "high";
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
    if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  }
  return fallback;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim();
  if (!raw) return fallback;
  const normalized = raw.startsWith("#") ? raw : `#${raw}`;
  const match = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(normalized);
  if (!match) return fallback;
  if (match[1].length === 3) {
    const [r, g, b] = match[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return normalized.toUpperCase();
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = normalizeHexColor(hex, DEFAULT_THEME_COLORS.primary).slice(1);
  return [
    Number.parseInt(cleaned.slice(0, 2), 16),
    Number.parseInt(cleaned.slice(2, 4), 16),
    Number.parseInt(cleaned.slice(4, 6), 16),
  ];
}

export function hexToRgbTriplet(hex: string): string {
  return hexToRgb(hex).join(" ");
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function mixHex(a: string, b: string, ratio: number): string {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  const mix = left.map((channel, index) =>
    channel + (right[index] - channel) * Math.min(1, Math.max(0, ratio))
  ) as [number, number, number];
  return rgbToHex(mix);
}

function lightenHex(hex: string, ratio: number): string {
  return mixHex(hex, "#FFFFFF", ratio);
}

function darkenHex(hex: string, ratio: number): string {
  return mixHex(hex, "#000000", ratio);
}

function resolveThemeMode(themeMode: ThemeModeSetting, fallback: ResolvedThemeMode): ResolvedThemeMode {
  if (themeMode === "light") return "light";
  if (themeMode === "dark") return "dark";
  if (typeof window !== "undefined") {
    try {
      return window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function defaultBodyBackground(mode: ResolvedThemeMode): string {
  return mode === "light"
    ? 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(250,251,253,0.92) 55%, rgba(247,248,251,0.98) 100%), radial-gradient(65% 50% at 28% 6%, rgba(155,104,40,0.06) 0%, rgba(155,104,40,0) 60%), radial-gradient(50% 45% at 90% 16%, rgba(226,201,120,0.07) 0%, rgba(226,201,120,0) 62%), radial-gradient(55% 55% at 10% 94%, rgba(226,201,120,0.05) 0%, rgba(226,201,120,0) 62%), url("/assets/backgrounds/command-center-elegant.jpg")'
    : 'linear-gradient(180deg, rgba(5,6,10,0.72) 0%, rgba(5,6,10,0.9) 58%, rgba(5,6,10,0.95) 100%), radial-gradient(70% 55% at 30% 8%, rgba(155,104,40,0.14) 0%, rgba(155,104,40,0) 62%), radial-gradient(45% 50% at 88% 20%, rgba(226,201,120,0.11) 0%, rgba(226,201,120,0) 64%), url("/assets/backgrounds/command-center-futuristic.jpg")';
}

function contrastColors(mode: ResolvedThemeMode, contrast: ThemeContrastPreference) {
  if (mode === "light") {
    switch (contrast) {
      case "soft":
        return { fg: "25 29 42", muted: "80 88 112" };
      case "normal":
        return { fg: "18 22 32", muted: "66 74 95" };
      case "high":
      default:
        return { fg: "12 15 23", muted: "56 64 86" };
    }
  }

  switch (contrast) {
    case "soft":
      return { fg: "220 224 235", muted: "123 131 158" };
    case "normal":
      return { fg: "231 234 242", muted: "140 147 175" };
    case "high":
    default:
      return { fg: "242 245 252", muted: "160 168 191" };
  }
}

export function buildThemeSnapshot(input: {
  themeMode: ThemeModeSetting;
  textContrast?: ThemeContrastPreference;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  glassIntensity?: number | null;
  sidebarOpacity?: number | null;
  cardOpacity?: number | null;
  loginBackgroundEnabled?: boolean | null;
  desktopBackgroundEnabled?: boolean | null;
  logoPath?: string | null;
  logoUrl?: string | null;
  backgroundImagePath?: string | null;
  backgroundImageUrl?: string | null;
  backgroundVideoPath?: string | null;
  backgroundVideoUrl?: string | null;
  workspaceSlug?: string | null;
  workspaceDomain?: string | null;
  workspaceDisplayName?: string | null;
  loginHeadline?: string | null;
  loginSubheadline?: string | null;
  defaultRedirectPath?: string | null;
  source?: ResolvedThemeSnapshot["source"];
  updatedAt?: string | null;
}): ResolvedThemeSnapshot {
  const themeMode = normalizeMode(input.themeMode);
  const mode = resolveThemeMode(themeMode, DEFAULT_THEME_SNAPSHOT.mode);
  const primaryColor = normalizeHexColor(
    input.primaryColor,
    DEFAULT_THEME_COLORS.primary
  );
  const secondaryColor = normalizeHexColor(
    input.secondaryColor,
    DEFAULT_THEME_COLORS.secondary
  );
  const textContrast = normalizeContrast(input.textContrast);
  const glassIntensity = clampNumber(input.glassIntensity, DEFAULT_THEME_SNAPSHOT.glassIntensity);
  const sidebarOpacity = clampNumber(input.sidebarOpacity, DEFAULT_THEME_SNAPSHOT.sidebarOpacity);
  const cardOpacity = clampNumber(input.cardOpacity, DEFAULT_THEME_SNAPSHOT.cardOpacity);
  const loginBackgroundEnabled = normalizeBool(
    input.loginBackgroundEnabled,
    DEFAULT_THEME_SNAPSHOT.loginBackgroundEnabled
  );
  const desktopBackgroundEnabled = normalizeBool(
    input.desktopBackgroundEnabled,
    DEFAULT_THEME_SNAPSHOT.desktopBackgroundEnabled
  );
  const palette = buildAccentPalette(primaryColor, secondaryColor);
  const backgroundImagePath = input.backgroundImagePath ?? null;
  const backgroundImageUrl = input.backgroundImageUrl ?? null;
  const fallbackBackgroundUrl =
    backgroundImageUrl ?? backgroundImagePath ?? DEFAULT_THEME_SNAPSHOT.backgroundImage.url;
  const bodyBackground = defaultBodyBackground(mode).replace(
    /url\(".*?"\)$/,
    `url(${JSON.stringify(fallbackBackgroundUrl)})`
  );

  return {
    mode,
    themeMode,
    textContrast,
    primaryColor,
    secondaryColor,
    glassIntensity,
    sidebarOpacity,
    cardOpacity,
    loginBackgroundEnabled,
    desktopBackgroundEnabled,
    bodyBackground,
    logo: {
      path: input.logoPath ?? null,
      url: input.logoUrl ?? null,
    },
    backgroundImage: {
      path: backgroundImagePath,
      url: backgroundImageUrl,
    },
    backgroundVideo: {
      path: input.backgroundVideoPath ?? null,
      url: input.backgroundVideoUrl ?? null,
    },
    workspaceSlug: input.workspaceSlug ?? null,
    workspaceDomain: input.workspaceDomain ?? null,
    workspaceDisplayName: input.workspaceDisplayName ?? null,
    loginHeadline: input.loginHeadline ?? null,
    loginSubheadline: input.loginSubheadline ?? null,
    defaultRedirectPath: input.defaultRedirectPath ?? "/dashboard",
    source: input.source ?? "default",
    updatedAt: input.updatedAt ?? null,
  };
}

export function buildAccentPalette(primaryHex: string, secondaryHex: string) {
  return {
    primary: primaryHex,
    secondary: secondaryHex,
    champagne: lightenHex(primaryHex, 0.34),
    bronze: mixHex(primaryHex, secondaryHex, 0.48),
    ember: darkenHex(secondaryHex, 0.25),
    glassBorder: lightenHex(primaryHex, 0.58),
  };
}

export function themeSnapshotToCssVars(snapshot: ResolvedThemeSnapshot): ThemeStyleVars {
  const palette = buildAccentPalette(snapshot.primaryColor, snapshot.secondaryColor);
  const contrast = contrastColors(snapshot.mode, snapshot.textContrast);

  return {
    "--primary-gold": hexToRgb(palette.primary).join(" "),
    "--burnt-gold": hexToRgb(palette.secondary).join(" "),
    "--champagne-highlight": hexToRgb(palette.champagne).join(" "),
    "--accent-2": hexToRgb(palette.secondary).join(" "),
    "--accent-ember": hexToRgb(palette.ember).join(" "),
    "--accent-bronze": hexToRgb(palette.bronze).join(" "),
    "--glass-border": hexToRgb(palette.glassBorder).join(" "),
    "--theme-shell-rgb": snapshot.mode === "light" ? "255 255 255" : "5 6 10",
    "--theme-card-rgb": snapshot.mode === "light" ? "255 255 255" : "5 6 10",
    "--theme-sidebar-opacity": snapshot.sidebarOpacity.toFixed(2),
    "--theme-card-opacity": snapshot.cardOpacity.toFixed(2),
    "--theme-glass-intensity": snapshot.glassIntensity.toFixed(2),
    "--bg": snapshot.mode === "light" ? "250 251 253" : "9 11 17",
    "--fg": contrast.fg,
    "--muted": contrast.muted,
    "--muted-text": contrast.muted,
    "--theme-body-background": snapshot.bodyBackground,
  };
}

export function applyThemeSnapshotToDocument(snapshot: ResolvedThemeSnapshot): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const vars = themeSnapshotToCssVars(snapshot);
  root.classList.remove("light", "dark");
  root.classList.add(snapshot.mode);
  root.style.colorScheme = snapshot.mode;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  if (document.body) {
    document.body.style.backgroundImage = snapshot.bodyBackground;
  }
}

export function readCachedThemeSnapshot(): ResolvedThemeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ResolvedThemeSnapshot> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return buildThemeSnapshot({
      themeMode: normalizeMode(parsed.themeMode ?? "dark"),
      textContrast: normalizeContrast(parsed.textContrast ?? "high"),
      primaryColor: parsed.primaryColor ?? undefined,
      secondaryColor: parsed.secondaryColor ?? undefined,
      glassIntensity: parsed.glassIntensity ?? undefined,
      sidebarOpacity: parsed.sidebarOpacity ?? undefined,
      cardOpacity: parsed.cardOpacity ?? undefined,
      loginBackgroundEnabled: parsed.loginBackgroundEnabled ?? undefined,
      desktopBackgroundEnabled: parsed.desktopBackgroundEnabled ?? undefined,
      logoPath: parsed.logo?.path ?? null,
      logoUrl: parsed.logo?.url ?? null,
      backgroundImagePath: parsed.backgroundImage?.path ?? null,
      backgroundImageUrl: parsed.backgroundImage?.url ?? null,
      backgroundVideoPath: parsed.backgroundVideo?.path ?? null,
      backgroundVideoUrl: parsed.backgroundVideo?.url ?? null,
      workspaceSlug: parsed.workspaceSlug ?? null,
      workspaceDomain: parsed.workspaceDomain ?? null,
      workspaceDisplayName: parsed.workspaceDisplayName ?? null,
      loginHeadline: parsed.loginHeadline ?? null,
      loginSubheadline: parsed.loginSubheadline ?? null,
      defaultRedirectPath: parsed.defaultRedirectPath ?? undefined,
      source: parsed.source ?? "default",
      updatedAt: parsed.updatedAt ?? null,
    });
  } catch {
    return null;
  }
}

export function persistThemeSnapshot(snapshot: ResolvedThemeSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      THEME_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(snapshot)
    );
  } catch {
    // Best-effort cache only.
  }
}
