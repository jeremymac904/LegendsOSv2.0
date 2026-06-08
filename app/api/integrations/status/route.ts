import { NextResponse } from "next/server";

import {
  PUBLIC_ENV,
  getAllProviderConfigStates,
  getServerEnv,
} from "@/lib/env";
import { getN8nConfigState } from "@/lib/automation/n8n";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { detectMetaConfig } from "@/lib/integrations/meta";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

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
  if (!isOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner-only endpoint." },
      { status: 403 }
    );
  }

  const env = getServerEnv();
  const providers = getAllProviderConfigStates();
  const n8n = getN8nConfigState();
  const meta = detectMetaConfig();
  const appUrl = PUBLIC_ENV.APP_URL.replace(/\/$/, "");
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
  let platformCounts = {
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
    // Best-effort summary only.
  }

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
      },
      social_destinations: {
        selected_rows: teamDestinations.length,
        publish_enabled_rows: publishEnabledCount,
        platform_counts: platformCounts,
        team_destinations: teamDestinations,
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
  });
}
