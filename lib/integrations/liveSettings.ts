// Live-action settings resolver — the authoritative server-side gate for
// whether an outbound action (email send / social publish / calendar write /
// drive write) may actually run live.
// ---------------------------------------------------------------------------
// SEMANTICS (fail-closed):
//   * integration_settings is the in-app, owner/user-controllable source of truth.
//   * A GLOBAL row (scope='global', per org) carries the org-wide toggles + a
//     `safe_mode` master kill switch (when true, EVERYTHING is forced off).
//   * A USER row (scope='user', per profile) overrides for that user. When a user
//     has no row, they INHERIT the global setting (so the owner enabling globally
//     lets connected users act, unless individually disabled).
//   * When NO global row exists yet, the legacy env flag (ALLOW_LIVE_*) is the
//     default — preserving today's safe default-OFF behavior until the owner
//     flips a toggle in the app. The env flag is the seed default, not a hard
//     requirement, so the owner CAN enable live actions from inside the app.
//   * The table living unapplied (42P01) degrades to the env default (off).
//
// This module is server-only (uses the service client to read settings reliably
// regardless of RLS). Never import from a client component.

import { getServerEnv } from "@/lib/env";
import { getSupabaseServiceClient, isMissingDatabaseObjectError } from "@/lib/supabase/server";

export type LiveChannel = "email" | "social" | "calendar" | "drive_write";

const COLUMN: Record<LiveChannel, "live_email" | "live_social" | "live_calendar" | "live_drive_write"> = {
  email: "live_email",
  social: "live_social",
  calendar: "live_calendar",
  drive_write: "live_drive_write",
};

export interface SettingsRow {
  id: string;
  scope: "global" | "user";
  organization_id: string | null;
  user_id: string | null;
  live_email: boolean;
  live_social: boolean;
  live_calendar: boolean;
  live_drive_write: boolean;
  safe_mode: boolean;
  provider_flags: Record<string, unknown> | null;
  updated_at: string | null;
}

const SELECT_COLS =
  "id,scope,organization_id,user_id,live_email,live_social,live_calendar,live_drive_write,safe_mode,provider_flags,updated_at";

function envDefault(channel: LiveChannel): boolean {
  const env = getServerEnv();
  switch (channel) {
    case "email":
      return env.SAFETY.allowLiveEmailSend;
    case "social":
      return env.SAFETY.allowLiveSocialPublish;
    case "calendar":
      return readEnvBool("ALLOW_LIVE_CALENDAR_WRITE");
    case "drive_write":
      return readEnvBool("ALLOW_LIVE_DRIVE_WRITE");
  }
}

function readEnvBool(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

// Read the global row for an org (scope='global'). Returns null if none / table missing.
export async function readGlobalSettings(organizationId: string | null): Promise<SettingsRow | null> {
  try {
    const service = getSupabaseServiceClient();
    let q = service.from("integration_settings").select(SELECT_COLS).eq("scope", "global");
    q = organizationId ? q.eq("organization_id", organizationId) : q.is("organization_id", null);
    const { data, error } = await q.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      if (isMissingDatabaseObjectError(error)) return null;
      return null;
    }
    return (data as SettingsRow | null) ?? null;
  } catch {
    return null;
  }
}

// Read a user's override row (scope='user'). Returns null if none / table missing.
export async function readUserSettings(userId: string): Promise<SettingsRow | null> {
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("integration_settings")
      .select(SELECT_COLS)
      .eq("scope", "user")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as SettingsRow | null) ?? null;
  } catch {
    return null;
  }
}

export interface LiveResolution {
  allowed: boolean;
  // 'ok' | 'safe_mode' | 'global_disabled' | 'user_disabled'
  reason: "ok" | "safe_mode" | "global_disabled" | "user_disabled";
  globalEffective: boolean;
  userEffective: boolean;
  safeMode: boolean;
}

// Resolve whether `channel` may run live for (organizationId, userId).
export async function resolveLiveAction(
  channel: LiveChannel,
  ctx: { organizationId: string | null; userId: string }
): Promise<LiveResolution> {
  const [globalRow, userRow] = await Promise.all([
    readGlobalSettings(ctx.organizationId),
    readUserSettings(ctx.userId),
  ]);
  return resolveFromRows(channel, globalRow, userRow);
}

// Pure resolution from already-loaded rows (also used by the status endpoint).
export function resolveFromRows(
  channel: LiveChannel,
  globalRow: SettingsRow | null,
  userRow: SettingsRow | null
): LiveResolution {
  const col = COLUMN[channel];
  const safeMode = Boolean(globalRow?.safe_mode);

  const globalEffective = globalRow ? !safeMode && Boolean(globalRow[col]) : envDefault(channel);

  // No user row => inherit global. A user row's boolean is authoritative
  // (explicit per-user opt-in or opt-out).
  const userEffective = userRow ? Boolean(userRow[col]) : globalEffective;

  const allowed = globalEffective && userEffective;
  let reason: LiveResolution["reason"] = "ok";
  if (!globalEffective) reason = safeMode ? "safe_mode" : "global_disabled";
  else if (!userEffective) reason = "user_disabled";

  return { allowed, reason, globalEffective, userEffective, safeMode };
}

// Upsert a settings row (global or user). No unique constraint exists on the
// table, so we select-then-update/insert. Service-role write; callers MUST do
// their own authorization (owner for global, self/owner for user) first.
export async function writeSettings(args: {
  scope: "global" | "user";
  organizationId: string | null;
  userId: string | null; // required for scope='user'
  patch: Partial<Pick<SettingsRow, "live_email" | "live_social" | "live_calendar" | "live_drive_write" | "safe_mode" | "provider_flags">>;
  updatedBy: string | null;
}): Promise<SettingsRow> {
  const service = getSupabaseServiceClient();

  // Find existing row.
  let findQ = service.from("integration_settings").select("id").eq("scope", args.scope);
  if (args.scope === "global") {
    findQ = args.organizationId
      ? findQ.eq("organization_id", args.organizationId)
      : findQ.is("organization_id", null);
  } else {
    findQ = findQ.eq("user_id", args.userId as string);
  }
  const { data: existing } = await findQ.limit(1).maybeSingle();

  const now = new Date().toISOString();
  const writeRow: Record<string, unknown> = {
    ...args.patch,
    updated_by: args.updatedBy,
    updated_at: now,
  };

  if (existing?.id) {
    const { data, error } = await service
      .from("integration_settings")
      .update(writeRow)
      .eq("id", existing.id)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`update settings failed: ${error.message}`);
    return data as SettingsRow;
  }

  const insertRow: Record<string, unknown> = {
    scope: args.scope,
    organization_id: args.scope === "global" ? args.organizationId : args.organizationId,
    user_id: args.scope === "user" ? args.userId : null,
    // safe defaults for any unspecified booleans
    live_email: false,
    live_social: false,
    live_calendar: false,
    live_drive_write: false,
    safe_mode: false,
    ...writeRow,
  };
  const { data, error } = await service
    .from("integration_settings")
    .insert(insertRow)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`insert settings failed: ${error.message}`);
  return data as SettingsRow;
}
