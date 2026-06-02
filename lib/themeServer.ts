import type { Profile, BrandWorkspaceSettings, UserThemeSettings } from "@/types/database";

import {
  buildThemeSnapshot,
  type ResolvedThemeSnapshot,
  type ThemeMediaRef,
} from "@/lib/themeSnapshot";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) return null;
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPort = withoutProtocol.replace(/:\d+$/, "");
  return withoutPort.startsWith("www.") ? withoutPort.slice(4) : withoutPort;
}

async function resolveMediaRef(args: {
  bucket: "uploads" | "shared_resources";
  path: string | null | undefined;
}): Promise<ThemeMediaRef> {
  const path = args.path?.trim() ?? "";
  if (!path) return { path: null, url: null };
  if (path.startsWith("/") || path.startsWith("http://") || path.startsWith("https://")) {
    return { path, url: path };
  }

  try {
    const service = getSupabaseServiceClient();
    const { data } = await service.storage
      .from(args.bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return { path, url: data?.signedUrl ?? null };
  } catch {
    return { path, url: null };
  }
}

export async function fetchWorkspaceByDomain(
  domain: string | null
): Promise<BrandWorkspaceSettings | null> {
  const normalized = normalizeHost(domain);
  if (!normalized) return null;
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("brand_workspace_settings")
      .select("*")
      .eq("domain", normalized)
      .maybeSingle();
    if (error || !data) return null;
    return data as BrandWorkspaceSettings;
  } catch {
    return null;
  }
}

export async function fetchWorkspaceByOrganization(
  organizationId: string | null | undefined
): Promise<BrandWorkspaceSettings | null> {
  if (!organizationId) return null;
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("brand_workspace_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error || !data) return null;
    return data as BrandWorkspaceSettings;
  } catch {
    return null;
  }
}

async function fetchUserTheme(userId: string | null | undefined): Promise<UserThemeSettings | null> {
  if (!userId) return null;
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("user_theme_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as UserThemeSettings;
  } catch {
    return null;
  }
}

export async function resolveWorkspaceBranding(
  host: string | null | undefined
): Promise<ResolvedThemeSnapshot> {
  const workspace = await fetchWorkspaceByDomain(host ?? null);
  return resolveWorkspaceThemeSnapshot(workspace);
}

export async function resolveWorkspaceThemeSnapshot(
  workspace: BrandWorkspaceSettings | null
): Promise<ResolvedThemeSnapshot> {
  if (!workspace) {
    return buildThemeSnapshot({
      themeMode: "dark",
      source: "default",
      defaultRedirectPath: "/dashboard",
    });
  }

  const [logo, backgroundImage, backgroundVideo] = await Promise.all([
    resolveMediaRef({ bucket: "shared_resources", path: workspace.logo_path }),
    resolveMediaRef({
      bucket: "shared_resources",
      path: workspace.background_image_path,
    }),
    resolveMediaRef({
      bucket: "shared_resources",
      path: workspace.background_video_path,
    }),
  ]);

  return buildThemeSnapshot({
    themeMode: "dark",
    source: "workspace",
    primaryColor: workspace.primary_color,
    secondaryColor: workspace.secondary_color,
    workspaceSlug: workspace.workspace_slug,
    workspaceDomain: workspace.domain,
    workspaceDisplayName: workspace.display_name,
    loginHeadline: workspace.login_headline,
    loginSubheadline: workspace.login_subheadline,
    defaultRedirectPath: workspace.default_redirect_path,
    logoPath: logo.path,
    logoUrl: logo.url,
    backgroundImagePath: backgroundImage.path,
    backgroundImageUrl: backgroundImage.url,
    backgroundVideoPath: backgroundVideo.path,
    backgroundVideoUrl: backgroundVideo.url,
    updatedAt: workspace.updated_at,
  });
}

export async function resolveWorkspaceRecord(args: {
  profile: Profile | null;
  host?: string | null;
}): Promise<BrandWorkspaceSettings | null> {
  const normalizedHost = normalizeHost(args.host);
  const [workspaceByHost, workspaceByOrg] = await Promise.all([
    fetchWorkspaceByDomain(normalizedHost),
    fetchWorkspaceByOrganization(args.profile?.organization_id ?? null),
  ]);
  return workspaceByHost ?? workspaceByOrg ?? null;
}

export async function resolveThemeSnapshot(args: {
  profile: Profile | null;
  host?: string | null;
}): Promise<ResolvedThemeSnapshot> {
  const { profile } = args;
  const normalizedHost = normalizeHost(args.host);

  const [userTheme, workspaceByHost, workspaceByOrg] = await Promise.all([
    fetchUserTheme(profile?.id ?? null),
    fetchWorkspaceByDomain(normalizedHost),
    fetchWorkspaceByOrganization(profile?.organization_id ?? null),
  ]);

  let workspace: BrandWorkspaceSettings | null = workspaceByHost ?? workspaceByOrg ?? null;

  if (!workspace && userTheme?.brand_workspace_id) {
    const service = getSupabaseServiceClient();
    const { data } = await service
      .from("brand_workspace_settings")
      .select("*")
      .eq("id", userTheme.brand_workspace_id)
      .maybeSingle();
    workspace = (data ?? null) as BrandWorkspaceSettings | null;
  }

  const primaryColor =
    userTheme?.primary_color ??
    workspace?.primary_color ??
    undefined;
  const secondaryColor =
    userTheme?.secondary_color ??
    workspace?.secondary_color ??
    undefined;

  const backgroundImagePath =
    userTheme?.background_image_path ??
    workspace?.background_image_path ??
    "/assets/backgrounds/command-center-futuristic.jpg";
  const backgroundVideoPath =
    userTheme?.background_video_path ?? workspace?.background_video_path ?? null;

  const [logo, backgroundImage, backgroundVideo] = await Promise.all([
    resolveMediaRef({
      bucket: workspace?.logo_path?.startsWith("/") ? "shared_resources" : "shared_resources",
      path: workspace?.logo_path ?? null,
    }),
    resolveMediaRef({
      bucket:
        backgroundImagePath.startsWith("/assets/") || backgroundImagePath.startsWith("http")
          ? "shared_resources"
          : "uploads",
      path: backgroundImagePath,
    }),
    resolveMediaRef({
      bucket:
        backgroundVideoPath && (backgroundVideoPath.startsWith("/assets/") || backgroundVideoPath.startsWith("http"))
          ? "shared_resources"
          : "uploads",
      path: backgroundVideoPath,
    }),
  ]);

  return buildThemeSnapshot({
    themeMode: userTheme?.theme_mode ?? "dark",
    textContrast: userTheme?.text_contrast ?? "high",
    primaryColor,
    secondaryColor,
    glassIntensity: userTheme?.glass_intensity ?? undefined,
    sidebarOpacity: userTheme?.sidebar_opacity ?? undefined,
    cardOpacity: userTheme?.card_opacity ?? undefined,
    loginBackgroundEnabled: userTheme?.login_background_enabled ?? true,
    desktopBackgroundEnabled: userTheme?.desktop_background_enabled ?? true,
    logoPath: logo.path,
    logoUrl: logo.url,
    backgroundImagePath: backgroundImage.path,
    backgroundImageUrl: backgroundImage.url,
    backgroundVideoPath: backgroundVideo.path,
    backgroundVideoUrl: backgroundVideo.url,
    workspaceSlug: workspace?.workspace_slug ?? null,
    workspaceDomain: workspace?.domain ?? null,
    workspaceDisplayName: workspace?.display_name ?? null,
    loginHeadline: workspace?.login_headline ?? null,
    loginSubheadline: workspace?.login_subheadline ?? null,
    defaultRedirectPath: workspace?.default_redirect_path ?? "/dashboard",
    source: userTheme ? "user" : workspace ? "workspace" : "default",
    updatedAt: userTheme?.updated_at ?? workspace?.updated_at ?? null,
  });
}
