import { NextResponse } from "next/server";

import {
  PUBLIC_ENV,
  getAllProviderConfigStates,
  getServerEnv,
} from "@/lib/env";
import { getN8nConfigState } from "@/lib/automation/n8n";
import { detectMetaConfig } from "@/lib/integrations/meta";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read presence-only — never return any env value, key, or URL beyond the
// public Supabase project URL.
function envPresent(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim() !== "");
}

function readBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

// Owner-only. Returns booleans + capability lists describing what is wired
// up. NO secret values are ever included in the response.
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

  // Google Business Profile — configured iff GBP_ACCOUNT_ID AND
  // GBP_LOCATION_ID are present. No publish yet.
  const gbpConfigured =
    envPresent("GBP_ACCOUNT_ID") && envPresent("GBP_LOCATION_ID");

  // YouTube — surface presence only. Real auth runs through Google OAuth,
  // so the channel id alone doesn't mean we can post; it just means we know
  // which channel to target.
  const youtubeConfigured = envPresent("YOUTUBE_CHANNEL_ID");

  // Google OAuth — needed for GBP / YouTube posting flows. Just env presence.
  const googleOauthConfigured =
    envPresent("GOOGLE_OAUTH_CLIENT_ID") &&
    envPresent("GOOGLE_OAUTH_CLIENT_SECRET");

  const allowLiveSocial = env.SAFETY.allowLiveSocialPublish;

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
      gbp: {
        configured: gbpConfigured,
        paid_enabled: gbpConfigured && allowLiveSocial,
        capabilities: gbpConfigured ? ["publish_post"] : [],
      },
      youtube: {
        configured: youtubeConfigured,
        paid_enabled: youtubeConfigured && allowLiveSocial,
        capabilities: youtubeConfigured ? ["publish_video"] : [],
      },
      google_oauth: {
        configured: googleOauthConfigured,
        // OAuth is plumbing, not a paid surface. Mirror configured.
        paid_enabled: googleOauthConfigured,
        capabilities: googleOauthConfigured ? ["oauth_grant"] : [],
      },
    },
    safety_flags: {
      live_social_publish: env.SAFETY.allowLiveSocialPublish,
      live_email_send: env.SAFETY.allowLiveEmailSend,
      paid_image_generation: readBool("ALLOW_PAID_IMAGE_GENERATION", false),
      paid_text_generation: readBool("ALLOW_PAID_TEXT_GENERATION", false),
    },
    owner_email: PUBLIC_ENV.OWNER_EMAIL,
    // Public Supabase project URL is the only URL ever returned. Everything
    // else is boolean-only by design.
    supabase_project_url: PUBLIC_ENV.SUPABASE_URL,
  });
}
