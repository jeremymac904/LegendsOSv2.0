import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import {
  resolveThemeSnapshot,
  resolveWorkspaceRecord,
  normalizeHost,
} from "@/lib/themeServer";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const colorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Expected a hex color")
  .nullable()
  .optional();

const patchSchema = z
  .object({
    scope: z.enum(["personal", "workspace"]),
    reset: z.boolean().optional(),
    workspace_id: z.string().uuid().optional(),
    theme_mode: z.enum(["dark", "light", "system"]).optional(),
    text_contrast: z.enum(["high", "normal", "soft"]).optional(),
    primary_color: colorSchema,
    secondary_color: colorSchema,
    background_image_path: z.string().trim().nullable().optional(),
    background_video_path: z.string().trim().nullable().optional(),
    glass_intensity: z.coerce.number().min(0).max(1).optional(),
    sidebar_opacity: z.coerce.number().min(0).max(1).optional(),
    card_opacity: z.coerce.number().min(0).max(1).optional(),
    login_background_enabled: z.coerce.boolean().optional(),
    desktop_background_enabled: z.coerce.boolean().optional(),
    logo_path: z.string().trim().nullable().optional(),
    display_name: z.string().trim().min(1).max(120).optional(),
    login_headline: z.string().trim().min(1).max(180).optional(),
    login_subheadline: z.string().trim().max(300).nullable().optional(),
    default_redirect_path: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["active", "inactive", "draft"]).optional(),
  })
  .strict();

function requestHost(req: NextRequest): string | null {
  return normalizeHost(
    req.headers.get("x-hostname") ??
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host")
  );
}

async function fetchWorkspaceById(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  workspaceId: string,
  organizationId: string | null | undefined
): Promise<{ id: string; organization_id: string } | null> {
  let query = supabase.from("brand_workspace_settings").select("*").eq("id", workspaceId);
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as { id: string; organization_id: string };
}

export async function GET(req: NextRequest) {
  const { profile } = await getEffectiveProfile();
  const theme = await resolveThemeSnapshot({
    profile,
    host: requestHost(req),
  });
  return NextResponse.json({ ok: true, theme });
}

export async function PATCH(req: NextRequest) {
  const { profile, realProfile } = await getEffectiveProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const host = requestHost(req);
  const actorProfile = realProfile ?? profile;

  if (parsed.data.scope === "personal") {
    if (parsed.data.reset) {
      const { error } = await supabase
        .from("user_theme_settings")
        .delete()
        .eq("user_id", profile.id);
      if (error) {
        return NextResponse.json(
          { ok: false, error: "update_failed", message: error.message },
          { status: 500 }
        );
      }
      const theme = await resolveThemeSnapshot({ profile, host });
      return NextResponse.json({ ok: true, theme });
    }

    const workspace =
      (parsed.data.workspace_id
        ? await fetchWorkspaceById(
            supabase,
            parsed.data.workspace_id,
            profile.organization_id ?? actorProfile?.organization_id ?? null
          )
        : await resolveWorkspaceRecord({ profile, host })) ?? null;
    const { data: current } = await supabase
      .from("user_theme_settings")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();

    const next = {
      user_id: profile.id,
      organization_id:
        profile.organization_id ?? actorProfile?.organization_id ?? workspace?.organization_id ?? null,
      brand_workspace_id: workspace?.id ?? null,
      primary_color:
        parsed.data.primary_color ?? (current as { primary_color?: string | null } | null)?.primary_color ?? null,
      secondary_color:
        parsed.data.secondary_color ?? (current as { secondary_color?: string | null } | null)?.secondary_color ?? null,
      background_image_path:
        parsed.data.background_image_path ?? (current as { background_image_path?: string | null } | null)?.background_image_path ?? null,
      background_video_path:
        parsed.data.background_video_path ?? (current as { background_video_path?: string | null } | null)?.background_video_path ?? null,
      glass_intensity:
        parsed.data.glass_intensity ?? (current as { glass_intensity?: number | null } | null)?.glass_intensity ?? 0.8,
      sidebar_opacity:
        parsed.data.sidebar_opacity ?? (current as { sidebar_opacity?: number | null } | null)?.sidebar_opacity ?? 0.78,
      card_opacity:
        parsed.data.card_opacity ?? (current as { card_opacity?: number | null } | null)?.card_opacity ?? 0.34,
      text_contrast:
        parsed.data.text_contrast ?? (current as { text_contrast?: "high" | "normal" | "soft" | null } | null)?.text_contrast ?? "high",
      login_background_enabled:
        parsed.data.login_background_enabled ?? (current as { login_background_enabled?: boolean | null } | null)?.login_background_enabled ?? true,
      desktop_background_enabled:
        parsed.data.desktop_background_enabled ?? (current as { desktop_background_enabled?: boolean | null } | null)?.desktop_background_enabled ?? true,
      theme_mode:
        parsed.data.theme_mode ?? (current as { theme_mode?: "dark" | "light" | "system" | null } | null)?.theme_mode ?? "dark",
    };

    const { error } = await supabase
      .from("user_theme_settings")
      .upsert(next, { onConflict: "user_id" });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "update_failed", message: error.message },
        { status: 500 }
      );
    }

    const theme = await resolveThemeSnapshot({ profile, host });
    return NextResponse.json({ ok: true, theme });
  }

  // Workspace theme ----------------------------------------------------------
  if (!isOwner(actorProfile)) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "Only the owner can manage workspace branding.",
      },
      { status: 403 }
    );
  }

  if (!actorProfile.organization_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_org",
        message: "This account is not linked to an organization.",
      },
      { status: 400 }
    );
  }

  const workspace =
    (parsed.data.workspace_id
      ? await fetchWorkspaceById(
          supabase,
          parsed.data.workspace_id,
          actorProfile.organization_id
        )
      : await resolveWorkspaceRecord({ profile: actorProfile, host })) ?? null;

  if (!workspace) {
    return NextResponse.json(
      {
        ok: false,
        error: "workspace_missing",
        message: "No branded workspace is configured for this org.",
      },
      { status: 404 }
    );
  }

  const workspaceUpdate = Object.fromEntries(
    Object.entries({
      logo_path: parsed.data.logo_path,
      primary_color: parsed.data.primary_color,
      secondary_color: parsed.data.secondary_color,
      background_image_path: parsed.data.background_image_path,
      background_video_path: parsed.data.background_video_path,
      display_name: parsed.data.display_name,
      login_headline: parsed.data.login_headline,
      login_subheadline: parsed.data.login_subheadline,
      default_redirect_path: parsed.data.default_redirect_path,
      status: parsed.data.status,
    }).filter(([, value]) => value !== undefined)
  );

  if (parsed.data.reset) {
    return NextResponse.json(
      {
        ok: false,
        error: "reset_not_supported",
        message: "Workspace reset is not supported from this endpoint.",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("brand_workspace_settings")
    .update(workspaceUpdate)
    .eq("id", workspace.id)
    .eq("organization_id", workspace.organization_id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "update_failed", message: error.message },
      { status: 500 }
    );
  }

  const theme = await resolveThemeSnapshot({ profile, host });
  return NextResponse.json({ ok: true, theme });
}
