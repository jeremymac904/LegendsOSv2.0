import { NextResponse } from "next/server";

import { getN8nConfigState } from "@/lib/automation/n8n";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { getServerEnv } from "@/lib/env";
import { detectMetaConfig } from "@/lib/integrations/meta";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import { isAdminOrOwner } from "@/lib/permissions";
import { checkRequiredTables } from "@/lib/supabase/readiness";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envPresent(name: string): boolean {
  const value = process.env[name];
  return Boolean(value && value.trim() !== "");
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
  const gbpConfigured = envPresent("GBP_ACCOUNT_ID") && envPresent("GBP_LOCATION_ID");
  const youtubeConfigured = envPresent("YOUTUBE_CHANNEL_ID");

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
      google_oauth_env_present:
        envPresent("GOOGLE_OAUTH_CLIENT_ID") && envPresent("GOOGLE_OAUTH_CLIENT_SECRET"),
      gmail_intake_secret_present: isWebhookSecretConfigured(),
      drive_status: drive,
      n8n_configured: n8n.configured,
      meta_configured: meta.configured,
      google_business_profile_configured: gbpConfigured,
      youtube_configured: youtubeConfigured,
      live_social_publish_allowed: env.SAFETY.allowLiveSocialPublish,
      live_email_send_allowed: env.SAFETY.allowLiveEmailSend,
    },
  });
}
