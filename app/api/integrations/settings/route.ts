/**
 * GET  /api/integrations/settings — live-action settings (global + the caller's
 *                                   own user override; owner also gets team rows)
 * POST /api/integrations/settings — write a global (owner) or user (self/owner)
 *                                   live-action toggle.
 *
 * These are the REAL, in-app, owner/user-controllable toggles for whether live
 * email / social / calendar / drive-write actions may run. They persist in
 * public.integration_settings and are enforced server-side by the email/social/
 * calendar routes via lib/integrations/liveSettings.resolveLiveAction(). Safe
 * defaults: everything off until explicitly enabled; safe_mode is a master kill.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminOrOwner, isOwner } from "@/lib/permissions";
import { recordIntegrationAudit } from "@/lib/integrations/audit";
import {
  readGlobalSettings,
  readUserSettings,
  resolveFromRows,
  writeSettings,
  type LiveChannel,
  type SettingsRow,
} from "@/lib/integrations/liveSettings";
import { getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServiceClient,
  isMissingDatabaseObjectError,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANNELS: LiveChannel[] = ["email", "social", "calendar", "drive_write"];

function summarize(globalRow: SettingsRow | null, userRow: SettingsRow | null) {
  const resolved: Record<string, { allowed: boolean; reason: string }> = {};
  for (const ch of CHANNELS) {
    const r = resolveFromRows(ch, globalRow, userRow);
    resolved[ch] = { allowed: r.allowed, reason: r.reason };
  }
  return resolved;
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const globalRow = await readGlobalSettings(profile.organization_id);
  const userRow = await readUserSettings(profile.id);
  const env = getServerEnv();

  // Owner/admin can see every team member's per-user override.
  let teamRows: SettingsRow[] = [];
  if (isAdminOrOwner(profile)) {
    try {
      const service = getSupabaseServiceClient();
      const { data, error } = await service
        .from("integration_settings")
        .select(
          "id,scope,organization_id,user_id,live_email,live_social,live_calendar,live_drive_write,safe_mode,provider_flags,updated_at"
        )
        .eq("scope", "user");
      if (!error && data) teamRows = data as SettingsRow[];
    } catch {
      teamRows = [];
    }
  }

  return NextResponse.json({
    ok: true,
    can_manage_global: isOwner(profile),
    can_manage_users: isAdminOrOwner(profile),
    safe_mode: Boolean(globalRow?.safe_mode),
    global: globalRow
      ? {
          live_email: globalRow.live_email,
          live_social: globalRow.live_social,
          live_calendar: globalRow.live_calendar,
          live_drive_write: globalRow.live_drive_write,
          safe_mode: globalRow.safe_mode,
          source: "db" as const,
          updated_at: globalRow.updated_at,
        }
      : {
          // No row yet — show the env-default seed honestly.
          live_email: env.SAFETY.allowLiveEmailSend,
          live_social: env.SAFETY.allowLiveSocialPublish,
          live_calendar: false,
          live_drive_write: false,
          safe_mode: false,
          source: "env_default" as const,
          updated_at: null,
        },
    self: {
      has_override: Boolean(userRow),
      // The caller's OWN explicit override booleans (null when inheriting global).
      values: userRow
        ? {
            live_email: userRow.live_email,
            live_social: userRow.live_social,
            live_calendar: userRow.live_calendar,
            live_drive_write: userRow.live_drive_write,
          }
        : null,
      resolved: summarize(globalRow, userRow),
    },
    team: teamRows.map((r) => ({
      user_id: r.user_id,
      live_email: r.live_email,
      live_social: r.live_social,
      live_calendar: r.live_calendar,
      live_drive_write: r.live_drive_write,
      updated_at: r.updated_at,
    })),
  });
}

const boolPatch = z
  .object({
    live_email: z.boolean().optional(),
    live_social: z.boolean().optional(),
    live_calendar: z.boolean().optional(),
    live_drive_write: z.boolean().optional(),
    safe_mode: z.boolean().optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: "Provide at least one toggle to set." });

const postSchema = z.object({
  scope: z.enum(["global", "user"]),
  target_user_id: z.string().uuid().nullish(),
  patch: boolPatch,
});

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
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
  const { scope, target_user_id, patch } = parsed.data;

  // Authorization.
  if (scope === "global") {
    if (!isOwner(profile)) {
      return NextResponse.json(
        { ok: false, error: "forbidden", message: "Only the owner can change global live-action settings." },
        { status: 403 }
      );
    }
  } else {
    // user scope — self by default; owner/admin may set on behalf of a team member.
    const targetUserId = target_user_id ?? profile.id;
    if (targetUserId !== profile.id && !isAdminOrOwner(profile)) {
      return NextResponse.json(
        { ok: false, error: "forbidden", message: "You can only change your own live-action settings." },
        { status: 403 }
      );
    }
    // safe_mode is a global-only concept.
    if ("safe_mode" in patch) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "safe_mode is a global setting." },
        { status: 400 }
      );
    }
  }

  const targetUserId = scope === "user" ? target_user_id ?? profile.id : null;

  try {
    const row = await writeSettings({
      scope,
      organizationId: profile.organization_id,
      userId: targetUserId,
      patch,
      updatedBy: profile.id,
    });

    await recordIntegrationAudit({
      actor: profile,
      action: scope === "global" ? "live_settings_global_updated" : "live_settings_user_updated",
      target_type: "integration_settings",
      target_id: row.id,
      metadata: { scope, target_user_id: targetUserId, patch },
    });

    return NextResponse.json({ ok: true, settings: row });
  } catch (err) {
    if (isMissingDatabaseObjectError(err)) {
      return NextResponse.json(
        {
          ok: false,
          error: "not_provisioned",
          message: "integration_settings table is not provisioned. Apply the integration_settings migration.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: err instanceof Error ? err.message : "Failed to save settings.",
      },
      { status: 500 }
    );
  }
}
