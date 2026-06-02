"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  ImageIcon,
  Loader2,
  MonitorCheck,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { useTheme } from "@/components/ui/ThemeProvider";
import { hexToRgbTriplet, type ResolvedThemeSnapshot } from "@/lib/themeSnapshot";
import type {
  BrandWorkspaceSettings,
  Profile,
  ThemeContrastPreference,
  ThemeModeSetting,
} from "@/types/database";

type UploadKind = "logo" | "background_image" | "background_video";

interface PersonalDraft {
  theme_mode: ThemeModeSetting;
  text_contrast: ThemeContrastPreference;
  primary_color: string;
  secondary_color: string;
  background_image_path: string;
  background_video_path: string;
  glass_intensity: number;
  sidebar_opacity: number;
  card_opacity: number;
  login_background_enabled: boolean;
  desktop_background_enabled: boolean;
}

interface WorkspaceDraft {
  display_name: string;
  primary_color: string;
  secondary_color: string;
  logo_path: string;
  background_image_path: string;
  background_video_path: string;
  login_headline: string;
  login_subheadline: string;
  default_redirect_path: string;
  status: BrandWorkspaceSettings["status"];
}

interface ThemeCustomizationPanelProps {
  profile: Profile;
  initialTheme: ResolvedThemeSnapshot;
  workspaceTheme: ResolvedThemeSnapshot;
  workspace: BrandWorkspaceSettings | null;
  canManageWorkspace: boolean;
}

function colorToRgb(hex: string, alpha: number): string {
  return `rgba(${hexToRgbTriplet(hex).replace(/ /g, ", ")}, ${alpha})`;
}

function sourceTone(source: ResolvedThemeSnapshot["source"]) {
  switch (source) {
    case "user":
      return { tone: "ok" as const, label: "personal override" };
    case "workspace":
      return { tone: "info" as const, label: "workspace branding" };
    default:
      return { tone: "warn" as const, label: "default LegendsOS" };
  }
}

function workspaceStatusTone(status: BrandWorkspaceSettings["status"]) {
  switch (status) {
    case "active":
      return { tone: "ok" as const, label: "active" };
    case "draft":
      return { tone: "info" as const, label: "draft" };
    default:
      return { tone: "off" as const, label: "inactive" };
  }
}

function personalDraftFromTheme(theme: ResolvedThemeSnapshot): PersonalDraft {
  return {
    theme_mode: theme.themeMode,
    text_contrast: theme.textContrast,
    primary_color: theme.primaryColor,
    secondary_color: theme.secondaryColor,
    background_image_path: theme.backgroundImage.path ?? "",
    background_video_path: theme.backgroundVideo.path ?? "",
    glass_intensity: theme.glassIntensity,
    sidebar_opacity: theme.sidebarOpacity,
    card_opacity: theme.cardOpacity,
    login_background_enabled: theme.loginBackgroundEnabled,
    desktop_background_enabled: theme.desktopBackgroundEnabled,
  };
}

function workspaceDraftFromSettings(
  workspace: BrandWorkspaceSettings | null,
  theme: ResolvedThemeSnapshot
): WorkspaceDraft {
  return {
    display_name: workspace?.display_name ?? theme.workspaceDisplayName ?? "Flo Processing",
    primary_color: workspace?.primary_color ?? theme.primaryColor,
    secondary_color: workspace?.secondary_color ?? theme.secondaryColor,
    logo_path: workspace?.logo_path ?? theme.logo.path ?? "",
    background_image_path:
      workspace?.background_image_path ?? theme.backgroundImage.path ?? "",
    background_video_path:
      workspace?.background_video_path ?? theme.backgroundVideo.path ?? "",
    login_headline:
      workspace?.login_headline ?? theme.loginHeadline ?? "Flo Processing Command Center",
    login_subheadline:
      workspace?.login_subheadline ??
      theme.loginSubheadline ??
      "A smarter workspace for processing, document review, conditions, and loan flow support.",
    default_redirect_path: workspace?.default_redirect_path ?? theme.defaultRedirectPath,
    status: workspace?.status ?? "active",
  };
}

function normalizePath(value: string): string | null {
  const next = value.trim();
  return next ? next : null;
}

function formatPathLabel(path: string | null): string {
  if (!path) return "none";
  if (path.length <= 48) return path;
  return `${path.slice(0, 18)}…${path.slice(-18)}`;
}

export function ThemeCustomizationPanel({
  profile,
  initialTheme,
  workspaceTheme,
  workspace,
  canManageWorkspace,
}: ThemeCustomizationPanelProps) {
  const containerClass = canManageWorkspace
    ? "grid gap-5 xl:grid-cols-2"
    : "grid gap-5";

  return (
    <div className={containerClass}>
      <PersonalThemeCard
        profile={profile}
        initialTheme={initialTheme}
        workspaceId={workspace?.id ?? null}
      />
      {canManageWorkspace && (
        <WorkspaceBrandCard
          workspace={workspace}
          workspaceTheme={workspaceTheme}
        />
      )}
    </div>
  );
}

function PersonalThemeCard({
  profile,
  initialTheme,
  workspaceId,
}: {
  profile: Profile;
  initialTheme: ResolvedThemeSnapshot;
  workspaceId: string | null;
}) {
  const router = useRouter();
  const { snapshot, refreshTheme } = useTheme();
  const [draft, setDraft] = useState<PersonalDraft>(() =>
    personalDraftFromTheme(initialTheme)
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(personalDraftFromTheme(initialTheme));
  }, [initialTheme]);

  async function persistTheme(body: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/theme", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          scope: "personal",
          workspace_id: workspaceId ?? undefined,
          ...body,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Could not save personal theme.");
      }
      setMessage("Personal theme saved.");
      await refreshTheme();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save personal theme.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(kind: Extract<UploadKind, "background_image" | "background_video">, file: File) {
    setUploading(kind);
    setMessage(null);
    try {
      const upload = new FormData();
      upload.set("scope", "personal");
      upload.set("kind", kind);
      if (workspaceId) upload.set("workspace_id", workspaceId);
      upload.set("file", file);

      const uploadRes = await fetch("/api/theme/upload", {
        method: "POST",
        credentials: "include",
        body: upload,
      });
      const uploadJson = (await uploadRes.json().catch(() => null)) as
        | { ok?: boolean; path?: string; message?: string }
        | null;
      if (!uploadRes.ok || !uploadJson?.ok || !uploadJson.path) {
        throw new Error(uploadJson?.message ?? "Upload failed.");
      }

      const field =
        kind === "background_image"
          ? "background_image_path"
          : "background_video_path";
      setDraft((current) => ({
        ...current,
        [field]: uploadJson.path,
      }));
      await persistTheme({ [field]: uploadJson.path });
      setMessage(`Uploaded ${kind.replace("_", " ")} and saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function resetTheme() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/theme", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          scope: "personal",
          reset: true,
          workspace_id: workspaceId ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Could not reset theme.");
      }
      setDraft(personalDraftFromTheme(initialTheme));
      setMessage("Personal theme reset to the LegendsOS default.");
      await refreshTheme();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset theme.");
    } finally {
      setSaving(false);
    }
  }

  const sourceMeta = sourceTone(snapshot.source);
  const loginEnabled = draft.login_background_enabled;
  const desktopEnabled = draft.desktop_background_enabled;

  return (
    <section className="card-padded space-y-4">
      <div className="section-title">
        <div>
          <h2>Personal Theme</h2>
          <p>
            Saved to Supabase, restored after login, and cached for the desktop
            shell when offline. Applies to your own session only.
          </p>
        </div>
        <StatusPill status={sourceMeta.tone} label={sourceMeta.label} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void persistTheme({
              theme_mode: draft.theme_mode,
              text_contrast: draft.text_contrast,
              primary_color: draft.primary_color,
              secondary_color: draft.secondary_color,
              background_image_path: normalizePath(draft.background_image_path),
              background_video_path: normalizePath(draft.background_video_path),
              glass_intensity: draft.glass_intensity,
              sidebar_opacity: draft.sidebar_opacity,
              card_opacity: draft.card_opacity,
              login_background_enabled: draft.login_background_enabled,
              desktop_background_enabled: draft.desktop_background_enabled,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Theme mode</span>
              <select
                value={draft.theme_mode}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    theme_mode: e.target.value as ThemeModeSetting,
                  }))
                }
                className="input mt-1"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>
            <label>
              <span className="label">Text contrast</span>
              <select
                value={draft.text_contrast}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    text_contrast: e.target.value as ThemeContrastPreference,
                  }))
                }
                className="input mt-1"
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="soft">Soft</option>
              </select>
            </label>
            <label>
              <span className="label">Primary accent</span>
              <input
                type="color"
                value={draft.primary_color}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    primary_color: e.target.value,
                  }))
                }
                className="input mt-1 h-11 w-full cursor-pointer p-1"
              />
            </label>
            <label>
              <span className="label">Secondary accent</span>
              <input
                type="color"
                value={draft.secondary_color}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    secondary_color: e.target.value,
                  }))
                }
                className="input mt-1 h-11 w-full cursor-pointer p-1"
              />
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <SliderField
              label="Glass intensity"
              value={draft.glass_intensity}
              onChange={(value) =>
                setDraft((current) => ({ ...current, glass_intensity: value }))
              }
            />
            <SliderField
              label="Sidebar opacity"
              value={draft.sidebar_opacity}
              onChange={(value) =>
                setDraft((current) => ({ ...current, sidebar_opacity: value }))
              }
            />
            <SliderField
              label="Card opacity"
              value={draft.card_opacity}
              onChange={(value) =>
                setDraft((current) => ({ ...current, card_opacity: value }))
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleField
              label="Login background"
              checked={loginEnabled}
              description="Apply the branded background on the login page."
              onChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  login_background_enabled: checked,
                }))
              }
            />
            <ToggleField
              label="Desktop background"
              checked={desktopEnabled}
              description="Use the same theme background in the desktop shell."
              onChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  desktop_background_enabled: checked,
                }))
              }
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MediaField
              title="Background image"
              helper="Uploads to Supabase Storage and persists the storage path."
              kind="background_image"
              currentPath={draft.background_image_path}
              currentUrl={snapshot.backgroundImage.url}
              uploading={uploading === "background_image"}
              onUpload={(file) => handleUpload("background_image", file)}
              onClear={() => {
                setDraft((current) => ({
                  ...current,
                  background_image_path: "",
                }));
                void persistTheme({ background_image_path: null })
              }}
              inputRef={imageInputRef}
            />
            <MediaField
              title="Background video"
              helper="Keep this lightweight. The app only autoplays it when motion is allowed."
              kind="background_video"
              currentPath={draft.background_video_path}
              currentUrl={snapshot.backgroundVideo.url}
              uploading={uploading === "background_video"}
              onUpload={(file) => handleUpload("background_video", file)}
              onClear={() => {
                setDraft((current) => ({
                  ...current,
                  background_video_path: "",
                }));
                void persistTheme({ background_video_path: null })
              }}
              inputRef={videoInputRef}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void resetTheme()}
              disabled={saving || uploading !== null}
              className="btn-ghost"
            >
              <RotateCcw size={14} />
              Reset to default
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saving || uploading !== null}
                className="btn-primary"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save personal theme
                  </>
                )}
              </button>
            </div>
          </div>

          {message && (
            <p className="rounded-xl border border-accent-champagne/15 bg-ink-950/35 px-3 py-2 text-xs leading-relaxed text-ink-200">
              {message}
            </p>
          )}
        </form>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-accent-champagne/15 bg-ink-950/35 p-4">
            <div className="flex items-center gap-3">
              <span
                className="grid h-10 w-10 place-items-center rounded-xl border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne"
                style={{
                  boxShadow: `0 0 0 1px ${colorToRgb(draft.primary_color, 0.12)}`,
                }}
              >
                <Palette size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-100">
                  Current theme snapshot
                </p>
                <p className="text-[11px] text-ink-400">
                  Loaded from Supabase and cached locally for the desktop shell.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-ink-300">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2">
                <span>Mode</span>
                <span className="chip">{draft.theme_mode}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2">
                <span>Source</span>
                <span className="chip">{sourceMeta.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-ink-800/60 bg-ink-950/40 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
                    Primary
                  </p>
                  <div
                    className="mt-2 h-10 rounded-md border border-accent-champagne/15"
                    style={{ backgroundColor: draft.primary_color }}
                  />
                </div>
                <div className="rounded-lg border border-ink-800/60 bg-ink-950/40 p-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
                    Secondary
                  </p>
                  <div
                    className="mt-2 h-10 rounded-md border border-accent-champagne/15"
                    style={{ backgroundColor: draft.secondary_color }}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Background assets
                </p>
                <p className="mt-1 break-words text-[11px] text-ink-300">
                  Image: {formatPathLabel(draft.background_image_path)}
                </p>
                <p className="mt-1 break-words text-[11px] text-ink-300">
                  Video: {formatPathLabel(draft.background_video_path)}
                </p>
              </div>
              <div className="rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Access
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
                  Personal theme changes only affect {profile.full_name ?? profile.email}
                  . They do not expose another user&apos;s files or settings.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-accent-champagne/15 bg-[linear-gradient(180deg,rgba(43,93,74,0.16),rgba(5,6,10,0.42))] p-4">
            <div className="flex items-center gap-2">
              <MonitorCheck size={14} className="text-accent-champagne" />
              <p className="text-sm font-medium text-ink-100">
                Web + desktop sync
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-300">
              The same theme snapshot is applied across the web platform and the
              Windows desktop shell. If the app goes offline, it uses the last
              cached snapshot safely.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function WorkspaceBrandCard({
  workspace,
  workspaceTheme,
}: {
  workspace: BrandWorkspaceSettings | null;
  workspaceTheme: ResolvedThemeSnapshot;
}) {
  const router = useRouter();
  const { refreshTheme } = useTheme();
  const [draft, setDraft] = useState<WorkspaceDraft>(() =>
    workspaceDraftFromSettings(workspace, workspaceTheme)
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(workspaceDraftFromSettings(workspace, workspaceTheme));
  }, [workspace, workspaceTheme]);

  if (!workspace) {
    return (
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Workspace branding</h2>
            <p>No branded workspace row was found for this organization.</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          This org is using the default LegendsOS theme. Add a
          `brand_workspace_settings` row to turn on a branded entry domain.
        </p>
      </section>
    );
  }
  const workspaceRecord = workspace;

  async function persistWorkspace(body: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/theme", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          scope: "workspace",
          workspace_id: workspaceRecord.id,
          ...body,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Could not save workspace branding.");
      }
      setMessage("Workspace branding saved.");
      await refreshTheme();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save workspace branding."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(kind: UploadKind, file: File) {
    setUploading(kind);
    setMessage(null);
    try {
      const upload = new FormData();
      upload.set("scope", "workspace");
      upload.set("kind", kind);
      upload.set("workspace_id", workspaceRecord.id);
      upload.set("file", file);

      const uploadRes = await fetch("/api/theme/upload", {
        method: "POST",
        credentials: "include",
        body: upload,
      });
      const uploadJson = (await uploadRes.json().catch(() => null)) as
        | { ok?: boolean; path?: string; message?: string }
        | null;
      if (!uploadRes.ok || !uploadJson?.ok || !uploadJson.path) {
        throw new Error(uploadJson?.message ?? "Upload failed.");
      }

      const field =
        kind === "logo"
          ? "logo_path"
          : kind === "background_image"
            ? "background_image_path"
            : "background_video_path";
      setDraft((current) => ({
        ...current,
        [field]: uploadJson.path,
      }));
      await persistWorkspace({ [field]: uploadJson.path });
      setMessage(`Uploaded ${kind.replace("_", " ")} and saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  const statusMeta = workspaceStatusTone(workspaceRecord.status);
  const workspacePreview =
    workspaceTheme.workspaceDisplayName ??
    (workspaceRecord.workspace_slug === "flo_processing"
      ? "Flo Processing"
      : workspaceRecord.display_name);

  return (
    <section className="card-padded space-y-4">
      <div className="section-title">
        <div>
          <h2>Workspace branding</h2>
          <p>
            Owner controls for the branded tenant theme, login page, and
            default workspace redirect.
          </p>
        </div>
        <StatusPill status={statusMeta.tone} label={statusMeta.label} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const redirectPath = draft.default_redirect_path.trim() || "/flo-processing";
            void persistWorkspace({
              display_name: draft.display_name,
              primary_color: draft.primary_color,
              secondary_color: draft.secondary_color,
              logo_path: normalizePath(draft.logo_path),
              background_image_path: normalizePath(draft.background_image_path),
              background_video_path: normalizePath(draft.background_video_path),
              login_headline: draft.login_headline,
              login_subheadline: draft.login_subheadline,
              default_redirect_path: redirectPath.startsWith("/")
                ? redirectPath
                : `/${redirectPath}`,
              status: draft.status,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Workspace slug</span>
              <input className="input mt-1" value={workspaceRecord.workspace_slug} readOnly />
            </label>
            <label>
              <span className="label">Domain</span>
              <input className="input mt-1" value={workspaceRecord.domain} readOnly />
            </label>
            <label>
              <span className="label">Display name</span>
              <input
                className="input mt-1"
                value={draft.display_name}
                onChange={(e) =>
                  setDraft((current) => ({ ...current, display_name: e.target.value }))
                }
              />
            </label>
            <label>
              <span className="label">Status</span>
              <select
                className="input mt-1"
                value={draft.status}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    status: e.target.value as BrandWorkspaceSettings["status"],
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              <span className="label">Primary accent</span>
              <input
                type="color"
                className="input mt-1 h-11 w-full cursor-pointer p-1"
                value={draft.primary_color}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    primary_color: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span className="label">Secondary accent</span>
              <input
                type="color"
                className="input mt-1 h-11 w-full cursor-pointer p-1"
                value={draft.secondary_color}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    secondary_color: e.target.value,
                  }))
                }
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Login headline</span>
              <input
                className="input mt-1"
                value={draft.login_headline}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    login_headline: e.target.value,
                  }))
                }
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Login subheadline</span>
              <textarea
                className="textarea mt-1 min-h-[88px]"
                value={draft.login_subheadline}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    login_subheadline: e.target.value,
                  }))
                }
              />
            </label>
            <label className="sm:col-span-2">
              <span className="label">Default redirect path</span>
              <input
                className="input mt-1"
                value={draft.default_redirect_path}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    default_redirect_path: e.target.value,
                  }))
                }
                placeholder="/flo-processing"
              />
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <MediaField
              title="Workspace logo"
              helper="Used on the branded login page and workspace preview."
              kind="logo"
              currentPath={draft.logo_path}
              currentUrl={workspaceTheme.logo.url}
              uploading={uploading === "logo"}
              onUpload={(file) => handleUpload("logo", file)}
              onClear={() => {
                setDraft((current) => ({ ...current, logo_path: "" }));
                void persistWorkspace({ logo_path: null });
              }}
              inputRef={logoInputRef}
            />
            <MediaField
              title="Login background image"
              helper="The branded login screen uses this as the primary static surface."
              kind="background_image"
              currentPath={draft.background_image_path}
              currentUrl={workspaceTheme.backgroundImage.url}
              uploading={uploading === "background_image"}
              onUpload={(file) => handleUpload("background_image", file)}
              onClear={() => {
                setDraft((current) => ({
                  ...current,
                  background_image_path: "",
                }));
                void persistWorkspace({ background_image_path: null });
              }}
              inputRef={imageInputRef}
            />
            <MediaField
              title="Background video"
              helper="Optional. Keep it lightweight for the login and desktop shell."
              kind="background_video"
              currentPath={draft.background_video_path}
              currentUrl={workspaceTheme.backgroundVideo.url}
              uploading={uploading === "background_video"}
              onUpload={(file) => handleUpload("background_video", file)}
              onClear={() => {
                setDraft((current) => ({
                  ...current,
                  background_video_path: "",
                }));
                void persistWorkspace({ background_video_path: null });
              }}
              inputRef={videoInputRef}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving || uploading !== null}
              className="btn-primary"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save workspace branding
                </>
              )}
            </button>
          </div>

          {message && (
            <p className="rounded-xl border border-accent-champagne/15 bg-ink-950/35 px-3 py-2 text-xs leading-relaxed text-ink-200">
              {message}
            </p>
          )}
        </form>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-accent-champagne/15 bg-ink-950/35 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-100">
                  {workspacePreview}
                </p>
                <p className="text-[11px] text-ink-400">
                  {workspaceRecord.domain} · /{workspaceRecord.workspace_slug}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-ink-300">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2">
                <span>Redirect</span>
                <span className="chip">{draft.default_redirect_path}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2">
                <span>Status</span>
                <span className="chip">{draft.status}</span>
              </div>
              <div className="rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Login headline
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
                  {draft.login_headline}
                </p>
              </div>
              <div className="rounded-lg border border-ink-800/60 bg-ink-950/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Brand assets
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
                  Logo: {formatPathLabel(draft.logo_path)}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
                  Image: {formatPathLabel(draft.background_image_path)}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
                  Video: {formatPathLabel(draft.background_video_path)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-accent-champagne/15 bg-[linear-gradient(180deg,rgba(201,138,106,0.12),rgba(5,6,10,0.42))] p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent-champagne" />
              <p className="text-sm font-medium text-ink-100">
                Branded entry domain
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-300">
              LFprocessing.net points at this workspace login. Regular users
              only edit their own theme; workspace branding stays owner
              controlled.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="rounded-2xl border border-ink-800/60 bg-ink-950/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="label">{label}</span>
        <span className="chip">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[rgb(var(--primary-gold))]"
      />
    </label>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-2xl border border-ink-800/60 bg-ink-950/35 p-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-100">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-400">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-ink-600 bg-ink-950 accent-[rgb(var(--primary-gold))]"
      />
    </label>
  );
}

function MediaField({
  title,
  helper,
  kind,
  currentPath,
  currentUrl,
  uploading,
  onUpload,
  onClear,
  inputRef,
}: {
  title: string;
  helper: string;
  kind: UploadKind;
  currentPath: string;
  currentUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
  inputRef: RefObject<HTMLInputElement>;
}) {
  const isVideo = kind === "background_video";

  return (
    <div className="rounded-2xl border border-ink-800/60 bg-ink-950/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-100">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{helper}</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary h-8 px-3 text-xs"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={isVideo ? "video/mp4,video/quicktime,video/webm" : "image/png,image/jpeg,image/webp,image/gif"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file) {
            void onUpload(file);
          }
        }}
      />

      <div className="mt-3 overflow-hidden rounded-xl border border-accent-champagne/10 bg-ink-950/40">
        {currentPath && currentUrl ? (
          isVideo ? (
            <video
              src={currentUrl}
              className="h-36 w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={currentUrl}
              alt={title}
              className="h-36 w-full object-cover"
            />
          )
        ) : (
          <div className="flex h-36 items-center justify-center px-4 text-center text-xs text-ink-400">
            {kind === "background_video" ? (
              <Video size={16} className="mr-2" />
            ) : (
              <ImageIcon size={16} className="mr-2" />
            )}
            No file selected yet
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-ink-400">
          {currentPath ? `Path: ${formatPathLabel(currentPath)}` : "No storage path saved yet."}
        </p>
        <button
          type="button"
          onClick={() => void onClear()}
          disabled={uploading || !currentPath}
          className="btn-ghost h-8 px-3 text-xs"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
