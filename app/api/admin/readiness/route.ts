import { NextResponse } from "next/server";

import { getN8nConfigState } from "@/lib/automation/n8n";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { getServerEnv } from "@/lib/env";
import { detectMetaConfig } from "@/lib/integrations/meta";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import { isAdminOrOwner } from "@/lib/permissions";
import { checkRequiredTables } from "@/lib/supabase/readiness";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  if (!isAdminOrOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner/admin only." },
      { status: 403 }
    );
  }

  const supabase = getSupabaseServerClient();
  const tables = await checkRequiredTables(supabase);
  const missing = tables.filter((table) => table.status === "missing");
  const notReadable = tables.filter((table) => table.status === "not_readable");
  const env = getServerEnv();
  const n8n = getN8nConfigState();
  const drive = getDriveConnectionStatus();
  const meta = detectMetaConfig();
  const googleOauthConfigured = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );

  let socialDestinationSummary = {
    selected_rows: 0,
    publish_enabled_rows: 0,
    platform_counts: {
      facebook: 0,
      instagram: 0,
      google_business_profile: 0,
      youtube: 0,
    },
    team_destinations: [] as Array<{
      user_id: string;
      full_name: string | null;
      email: string | null;
      platform: string;
      destination_label: string | null;
      destination_type: string | null;
      status: string | null;
      is_publish_enabled: boolean;
      updated_at: string | null;
    }>,
  };

  try {
    const { data, error } = await supabase
      .from("social_account_connections")
      .select("user_id,platform,destination_label,destination_type,status,is_publish_enabled,updated_at")
      .order("updated_at", { ascending: false });

    if (!error) {
      const rows = (data ?? []) as Array<{
        user_id: string;
        platform: string;
        destination_label: string | null;
        destination_type: string | null;
        status: string | null;
        is_publish_enabled: boolean;
        updated_at: string | null;
      }>;
      const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
      const profileNames = new Map<
        string,
        { full_name: string | null; email: string | null }
      >();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", userIds);
        for (const p of (profiles ?? []) as Array<{
          id: string;
          full_name: string | null;
          email: string | null;
        }>) {
          profileNames.set(p.id, { full_name: p.full_name, email: p.email });
        }
      }

      socialDestinationSummary = {
        selected_rows: rows.length,
        publish_enabled_rows: rows.filter(
          (row) => row.status === "connected" && row.is_publish_enabled
        ).length,
        platform_counts: rows.reduce(
          (acc, row) => {
            if (row.platform in acc) {
              acc[row.platform as keyof typeof acc] += 1;
            }
            return acc;
          },
          {
            facebook: 0,
            instagram: 0,
            google_business_profile: 0,
            youtube: 0,
          }
        ),
        team_destinations: rows.map((row) => ({
          user_id: row.user_id,
          full_name: profileNames.get(row.user_id)?.full_name ?? null,
          email: profileNames.get(row.user_id)?.email ?? null,
          platform: row.platform,
          destination_label: row.destination_label,
          destination_type: row.destination_type,
          status: row.status,
          is_publish_enabled: row.is_publish_enabled,
          updated_at: row.updated_at,
        })),
      };
    }
  } catch {
    // Best-effort summary only.
  }

  return NextResponse.json({
    ok: true,
    database: {
      ready: missing.length === 0 && notReadable.length === 0,
      missing_tables: missing.map((table) => table.table),
      not_readable_tables: notReadable.map((table) => ({
        table: table.table,
        error_code: table.error_code,
      })),
      tables,
    },
    admin_setup: {
      profiles_ready: tables.some(
        (table) => table.table === "profiles" && table.status === "ready"
      ),
      organization_members_ready: tables.some(
        (table) => table.table === "organization_members" && table.status === "ready"
      ),
      owner_profile_id: profile.id,
      owner_organization_id: profile.organization_id,
    },
    integrations: {
      user_connections_table_ready: tables.some(
        (table) => table.table === "user_integration_connections" && table.status === "ready"
      ),
      audit_log_table_ready: tables.some(
        (table) => table.table === "integration_audit_log" && table.status === "ready"
      ),
      social_tables_ready: ["social_account_connections", "publish_attempts"].every((name) =>
        tables.some((table) => table.table === name && table.status === "ready")
      ),
      google_oauth_configured: googleOauthConfigured,
      google_oauth_env_present: googleOauthConfigured,
      gmail_intake_secret_present: isWebhookSecretConfigured(),
      drive_status: drive,
      n8n_configured: n8n.configured,
      meta_configured: meta.configured,
      social_destination_summary: socialDestinationSummary,
      live_social_publish_allowed: env.SAFETY.allowLiveSocialPublish,
      live_email_send_allowed: env.SAFETY.allowLiveEmailSend,
      paid_image_generation: readBool("ALLOW_PAID_IMAGE_GENERATION", false),
      paid_text_generation: readBool("ALLOW_PAID_TEXT_GENERATION", false),
    },
  });
}
