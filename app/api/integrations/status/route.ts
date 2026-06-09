import { NextResponse } from "next/server";

import {
  PUBLIC_ENV,
  getAllProviderConfigStates,
  getServerEnv,
} from "@/lib/env";
import { getN8nConfigState } from "@/lib/automation/n8n";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { detectMetaConfig } from "@/lib/integrations/meta";
import { isAdminOrOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConnectionStatus = "connected" | "error" | "disabled" | "unknown";

type SocialSummaryRow = {
  user_id: string;
  platform: string;
  destination_label: string | null;
  destination_type: string | null;
  status: string | null;
  is_publish_enabled: boolean;
  updated_at: string | null;
};

type UserIntegrationRow = {
  provider: string;
  status: string | null;
  metadata: Record<string, unknown> | null;
};

function readBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function normalizeStatus(raw: string | null | undefined): ConnectionStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "connected":
    case "active":
      return "connected";
    case "error":
    case "failed":
      return "error";
    case "disabled":
    case "revoked":
    case "disconnected":
      return "disabled";
    default:
      return "unknown";
  }
}

function hasConnectedDestination(
  rows: Array<{ platform: string; status: string | null }>,
  platform: string
): boolean {
  return rows.some(
    (row) => row.platform === platform && normalizeStatus(row.status) === "connected"
  );
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
      { ok: false, error: "forbidden", message: "Owner/admin only endpoint." },
      { status: 403 }
    );
  }

  const env = getServerEnv();
  const providers = getAllProviderConfigStates();
  const n8n = getN8nConfigState();
  const meta = detectMetaConfig();
  const appUrl = PUBLIC_ENV.APP_URL.replace(/\/$/, "");
  const callbackUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `${appUrl}/api/integrations/connect/callback`;
  const googleOauthConfigured = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );

  const supabase = getSupabaseServerClient();

  let teamDestinations: Array<{
    user_id: string;
    full_name: string | null;
    email: string | null;
    platform: string;
    destination_label: string | null;
    destination_type: string | null;
    status: string | null;
    is_publish_enabled: boolean;
    updated_at: string | null;
  }> = [];

  const platformCounts = {
    facebook: 0,
    instagram: 0,
    google_business_profile: 0,
    youtube: 0,
  };
  let publishEnabledCount = 0;

  try {
    const { data, error } = await supabase
      .from("social_account_connections")
      .select("user_id,platform,destination_label,destination_type,status,is_publish_enabled,updated_at")
      .order("updated_at", { ascending: false });

    if (!error) {
      const rows = (data ?? []) as SocialSummaryRow[];
      const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
      const profileNames = new Map<
        string,
        { full_name: string | null; email: string | null }
      >();

      if (userIds.length > 0) {
        try {
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
        } catch {
          // best-effort names only
        }
      }

      teamDestinations = rows.map((row) => ({
        user_id: row.user_id,
        full_name: profileNames.get(row.user_id)?.full_name ?? null,
        email: profileNames.get(row.user_id)?.email ?? null,
        platform: row.platform,
        destination_label: row.destination_label,
        destination_type: row.destination_type,
        status: row.status,
        is_publish_enabled: row.is_publish_enabled,
        updated_at: row.updated_at,
      }));

      for (const row of rows) {
        if (row.platform in platformCounts) {
          platformCounts[row.platform as keyof typeof platformCounts] += 1;
        }
        if (row.status === "connected" && row.is_publish_enabled) {
          publishEnabledCount += 1;
        }
      }
    }
  } catch {
    // best effort status only
  }

  let userIntegrationRows: UserIntegrationRow[] = [];
  let userDestinationRows: Array<{ platform: string; status: string | null }> = [];

  try {
    const { data, error } = await supabase
      .from("user_integration_connections")
      .select("provider,status,metadata")
      .eq("user_id", profile.id)
      .in("provider", ["google", "google_social", "gmail", "google_drive", "google_calendar"]);
    if (!error) {
      userIntegrationRows = (data ?? []) as UserIntegrationRow[];
    }
  } catch {
    // best effort status only
  }

  try {
    const { data, error } = await supabase
      .from("social_account_connections")
      .select("platform,status")
      .eq("user_id", profile.id);
    if (!error) {
      userDestinationRows = (data ?? []) as Array<{ platform: string; status: string | null }>;
    }
  } catch {
    // best effort status only
  }

  const byProvider = new Map<string, string | null>(
    userIntegrationRows.map((row) => [row.provider, row.status])
  );

  const hasGmail = normalizeStatus(byProvider.get("gmail")) === "connected";
  const hasDrive =
    normalizeStatus(byProvider.get("google_drive")) === "connected";
  const hasCalendar =
    normalizeStatus(byProvider.get("google_calendar")) === "connected";
  const googleSocialRow = userIntegrationRows.find(
    (row) => row.provider === "google_social"
  );
  const hasGoogleSocial =
    normalizeStatus(googleSocialRow?.status) === "connected";
  const googleSocialMetadata =
    (googleSocialRow?.metadata ?? {}) as Record<string, unknown>;
  const googleBusinessAccountCount = Array.isArray(
    googleSocialMetadata.google_business_accounts
  )
    ? googleSocialMetadata.google_business_accounts.length
    : 0;
  const googleBusinessLocationCount = Array.isArray(
    googleSocialMetadata.google_business_locations
  )
    ? googleSocialMetadata.google_business_locations.length
    : 0;
  const youtubeChannelCount = Array.isArray(googleSocialMetadata.youtube_channels)
    ? googleSocialMetadata.youtube_channels.length
    : 0;
  const hasYoutubeDestination = hasConnectedDestination(
    userDestinationRows,
    "youtube"
  );
  const hasGoogleBusinessDestination = hasConnectedDestination(
    userDestinationRows,
    "google_business_profile"
  );
  return NextResponse.json({
    ok: true,
    providers: {
      openrouter: providers.openrouter,
      deepseek: providers.deepseek,
      nvidia: providers.nvidia,
      fal: providers.fal,
      huggingface: providers.huggingface,
    },
    automations: {
      n8n: {
        configured: n8n.configured,
        base_url_present: n8n.base_url_present,
        webhooks: n8n.webhooks,
      },
    },
    integrations: {
      meta: {
        configured: meta.configured,
        paid_enabled: meta.paid_enabled,
        capabilities: meta.capabilities,
      },
      google_oauth: {
        configured: googleOauthConfigured,
        paid_enabled: googleOauthConfigured,
        capabilities: googleOauthConfigured ? ["oauth_grant"] : [],
        redirect_uri_expected: callbackUri,
      },
      gmail: {
        configured: hasGmail,
        actions_available: hasGmail,
        env_required: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        capabilities: ["gmail_read", "gmail_draft", "gmail_send"],
      },
      drive: {
        configured: hasDrive,
        actions_available: hasDrive,
        env_required: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        capabilities: ["drive_read", "drive_write"],
      },
      calendar: {
        configured: hasCalendar,
        actions_available: hasCalendar,
        env_required: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        capabilities: ["calendar_read", "calendar_write"],
      },
      instagram: {
        configured: hasConnectedDestination(userDestinationRows, "instagram"),
        actions_available: true,
        capabilities: ["instagram_publish"],
      },
      youtube: {
        configured: hasYoutubeDestination,
        actions_available: hasGoogleSocial,
        base_connected: hasGoogleSocial,
        available_destination_count: youtubeChannelCount,
        capabilities: ["youtube_publish"],
      },
      google_business_profile: {
        configured: hasGoogleBusinessDestination,
        actions_available: hasGoogleSocial,
        base_connected: hasGoogleSocial,
        available_account_count: googleBusinessAccountCount,
        available_location_count: googleBusinessLocationCount,
        capabilities: ["google_business_profile_publish"],
      },
      social_destinations: {
        selected_rows: teamDestinations.length,
        publish_enabled_rows: publishEnabledCount,
        platform_counts: platformCounts,
        team_destinations: teamDestinations,
      },
      zapier_mcp: {
        configured: false,
        actions_available: false,
        connection_count: 0,
        scope: "mcp",
      },
    },
    safety_flags: {
      live_social_publish: env.SAFETY.allowLiveSocialPublish,
      live_email_send: env.SAFETY.allowLiveEmailSend,
      paid_image_generation: readBool("ALLOW_PAID_IMAGE_GENERATION", false),
      paid_text_generation: readBool("ALLOW_PAID_TEXT_GENERATION", false),
    },
    owner_email: PUBLIC_ENV.OWNER_EMAIL,
    supabase_project_url: PUBLIC_ENV.SUPABASE_URL,
    lead_intake: {
      configured: isWebhookSecretConfigured(),
      webhook_url: `${appUrl}/api/webhooks/lead-intake`,
    },
    redirect_uri: callbackUri,
    meta_connection_connected: meta.configured,
  });
}
