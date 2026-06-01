import { NextResponse } from "next/server";

import {
  PUBLIC_ENV,
  getAllProviderConfigStates,
  getServerEnv,
} from "@/lib/env";
import { getN8nConfigState } from "@/lib/automation/n8n";
import { detectMetaConfig } from "@/lib/integrations/meta";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Canonical OAuth callback the Google Cloud client must register. Non-secret —
// it is published here so the owner can copy it verbatim into Google Cloud.
const CANONICAL_REDIRECT_URI =
  "https://legndsosv20.netlify.app/api/integrations/connect/callback";

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

// Best-effort count of saved per-user Zapier MCP connections. The table may not
// be provisioned and the service client may fail to construct — both degrade to
// 0 rather than throwing. NEVER selects auth_token or any secret column.
async function countZapierMcpConnections(): Promise<number> {
  try {
    const service = getSupabaseServiceClient();
    const { count, error } = await service
      .from("mcp_connections")
      .select("id", { count: "exact", head: true })
      .eq("provider", "zapier");
    if (error || typeof count !== "number") return 0;
    return count;
  } catch {
    return 0;
  }
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

  // Google OAuth — the plumbing every Google integration authenticates through.
  // Connect + callback + token exchange + server-side token store ARE
  // implemented, so its real capability is the OAuth grant flow.
  const googleOauthConfigured =
    envPresent("GOOGLE_OAUTH_CLIENT_ID") &&
    envPresent("GOOGLE_OAUTH_CLIENT_SECRET");

  // Gmail / Drive / Calendar are CAPABLE of acting only once Google OAuth is
  // configured (they ride the same OAuth client + token store). The per-user
  // connect/test/revoke actions are implemented for these. We never imply the
  // owner is "connected" here — that comes from /api/integrations/user-connections
  // — only whether the platform CAN act if a user connects.
  const googleCapability = googleOauthConfigured;

  // Meta / Instagram — env may be configured, but NO publisher is wired
  // (publishToMeta refuses with "live_wiring_pending"). publish_capability is
  // therefore honestly false even when configured.
  const metaConfigured = meta.configured;

  // YouTube — surface presence only. Auth would ride Google OAuth, but there is
  // no YouTube publisher implemented, so publish_capability is false.
  const youtubeConfigured = envPresent("YOUTUBE_CHANNEL_ID");

  // Google Business Profile — configured iff GBP_ACCOUNT_ID AND GBP_LOCATION_ID
  // are present. No publisher implemented, so publish_capability is false.
  const gbpConfigured =
    envPresent("GBP_ACCOUNT_ID") && envPresent("GBP_LOCATION_ID");

  // Zapier MCP — configured per user, not via a global env credential. Report
  // how many users have saved a Zapier MCP connection (best-effort, 0 on error).
  const zapierMcpConnections = await countZapierMcpConnections();

  // The exact redirect URI the Google OAuth client must register. Prefer an
  // explicit env override; otherwise fall back to the canonical Netlify URL.
  const redirectUriExpected =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || CANONICAL_REDIRECT_URI;

  return NextResponse.json({
    ok: true,
    // Top-level canonical OAuth callback to register in Google Cloud. Non-secret
    // — copyable by the owner so setup is unambiguous.
    redirect_uri: CANONICAL_REDIRECT_URI,
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
    // HONEST per-integration map covering all ten owner integrations. For each:
    //   configured        — env presence only (never a secret value)
    //   capability flag    — what the code can ACTUALLY do today:
    //     · google_oauth/gmail/drive/calendar → actions_available iff OAuth set
    //     · meta/instagram/youtube/gbp         → publish_capability:false (no
    //       publisher is implemented yet, even when configured)
    //     · n8n/zapier_mcp                     → dispatch/bridge availability
    integrations: {
      google_oauth: {
        configured: googleOauthConfigured,
        // OAuth plumbing IS implemented (connect + callback + token store).
        actions_available: googleOauthConfigured,
        redirect_uri_expected: redirectUriExpected,
        env_required: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        capabilities: googleOauthConfigured ? ["oauth_grant", "token_exchange"] : [],
      },
      gmail: {
        configured: googleOauthConfigured,
        // Read-only Gmail actions become available once OAuth is configured and
        // the user connects. The action plumbing (connect/test/revoke) is real.
        actions_available: googleCapability,
        env_required: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        capabilities: googleCapability ? ["read", "draft"] : [],
      },
      drive: {
        configured: googleOauthConfigured,
        actions_available: googleCapability,
        env_required: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        capabilities: googleCapability ? ["read"] : [],
      },
      calendar: {
        configured: googleOauthConfigured,
        actions_available: googleCapability,
        env_required: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        capabilities: googleCapability ? ["read", "create_event"] : [],
      },
      meta: {
        configured: metaConfigured,
        // HONEST: no Meta publisher is wired (publishToMeta refuses). Even when
        // configured + approved + live-social on, the platform cannot publish.
        publish_capability: false,
        env_required: [
          "META_APP_ID",
          "META_APP_SECRET",
          "META_ACCESS_TOKEN",
          "META_PAGE_ID",
          "META_INSTAGRAM_ACCOUNT_ID",
        ],
        capabilities: meta.capabilities,
      },
      instagram: {
        // Instagram rides the Meta connector — configured iff a Meta IG account
        // id is present alongside the Meta app credentials.
        configured: metaConfigured && envPresent("META_INSTAGRAM_ACCOUNT_ID"),
        publish_capability: false,
        env_required: [
          "META_APP_ID",
          "META_APP_SECRET",
          "META_ACCESS_TOKEN",
          "META_INSTAGRAM_ACCOUNT_ID",
        ],
        capabilities: [],
      },
      youtube: {
        configured: youtubeConfigured,
        publish_capability: false,
        env_required: ["YOUTUBE_CHANNEL_ID"],
        capabilities: [],
      },
      google_business_profile: {
        configured: gbpConfigured,
        publish_capability: false,
        env_required: ["GBP_ACCOUNT_ID", "GBP_LOCATION_ID"],
        capabilities: [],
      },
      n8n: {
        configured: n8n.configured,
        base_url_present: n8n.base_url_present,
        // n8n dispatch is implemented but gated by the live flags + per-webhook
        // URLs; "available" means at least a base URL + one webhook are set.
        actions_available: n8n.configured,
        webhooks: n8n.webhooks,
      },
      zapier_mcp: {
        // Per-user bridge — there is no global env credential to "configure".
        // Honest state is the saved connection count.
        configured: zapierMcpConnections > 0,
        actions_available: zapierMcpConnections > 0,
        connection_count: zapierMcpConnections,
        scope: "per_user",
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
