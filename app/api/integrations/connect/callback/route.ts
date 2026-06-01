/**
 * GET /api/integrations/connect/callback — Google OAuth 2.0 redirect handler.
 *
 * Completes the per-user connect flow started by POST /api/integrations/connect:
 *   1. Verify the HMAC-signed `state` (CSRF / grant-injection protection).
 *   2. Exchange the authorization `code` for tokens at Google (server-side,
 *      using the client secret — which never leaves the server).
 *   3. Store the access/refresh tokens in oauth_token_grants (service-role only;
 *      RLS denies all client access — tokens NEVER reach a browser).
 *   4. Upsert the NON-secret user_integration_connections status row the UI reads.
 *   5. Audit the connect, then redirect the user back to Settings.
 *
 * This route is in PUBLIC_PATHS so Google's redirect always reaches it; the
 * signed `state` (not the session) authoritatively attributes the grant.
 */

import { NextResponse } from "next/server";

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import { verifyState } from "@/lib/integrations/oauthState";
import { storeTokenGrant, upsertConnection } from "@/lib/integrations/tokenStore";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

// Canonical OAuth redirect URI. MUST be identical to the connect route's value
// and MUST match the Google Cloud console registration. Fixed constant (not the
// request origin) so the token exchange's redirect_uri always matches the one
// used to obtain the code. Override via GOOGLE_OAUTH_REDIRECT_URI.
const DEFAULT_REDIRECT_URI = "https://legndsosv20.netlify.app/api/integrations/connect/callback";

const PROVIDER_SCOPES: Record<string, string[]> = {
  google: ["openid", "email", "profile"],
  gmail: ["https://www.googleapis.com/auth/gmail.readonly"],
  google_drive: ["https://www.googleapis.com/auth/drive.readonly"],
  google_calendar: ["https://www.googleapis.com/auth/calendar.events"],
  youtube: ["https://www.googleapis.com/auth/youtube.upload"],
  google_business_profile: ["https://www.googleapis.com/auth/business.manage"],
};

function settingsRedirect(origin: string, params: Record<string, string>) {
  const url = new URL("/settings", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // ?tab so Settings can deep-link to the connections section if it supports it.
  url.searchParams.set("tab", "connections");
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return settingsRedirect(origin, { integration_error: oauthError });
  }

  // 1) Verify signed state.
  const verified = verifyState(stateToken);
  if (!verified.ok || !verified.state) {
    return settingsRedirect(origin, { integration_error: `invalid_state_${verified.reason ?? "unknown"}` });
  }
  const { provider, target_user_id } = verified.state;
  if (!code) {
    return settingsRedirect(origin, { integration_error: "missing_code", provider });
  }

  // 2) Ensure OAuth is configured (presence-only — never read the value into a response).
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    return settingsRedirect(origin, { integration_error: "oauth_not_configured", provider });
  }
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  // 3) Exchange the code for tokens (server-side).
  let tokenJson: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  try {
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    tokenJson = (await resp.json().catch(() => ({}))) as typeof tokenJson;
    if (!resp.ok || tokenJson.error || !tokenJson.access_token) {
      await recordIntegrationAudit({
        actor: null,
        action: "integration_connect_failed",
        provider,
        target_type: "user_integration_connections",
        target_id: null,
        metadata: { stage: "token_exchange", error: tokenJson.error ?? `http_${resp.status}` },
      });
      return settingsRedirect(origin, {
        integration_error: `token_exchange_${tokenJson.error ?? resp.status}`,
        provider,
      });
    }
  } catch (err) {
    return settingsRedirect(origin, {
      integration_error: "token_exchange_network",
      provider,
    });
  }

  const grantedScopes = tokenJson.scope ? tokenJson.scope.split(/\s+/).filter(Boolean) : PROVIDER_SCOPES[provider] ?? [];
  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
    : null;

  // 4) Best-effort: fetch the connected account email for NON-secret display.
  let accountEmail: string | null = null;
  try {
    const ui = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (ui.ok) {
      const info = (await ui.json().catch(() => ({}))) as { email?: string };
      accountEmail = info.email ?? null;
    }
  } catch {
    accountEmail = null;
  }

  // 5) Look up the target user's org for the connection row.
  let organizationId: string | null = null;
  try {
    const service = getSupabaseServiceClient();
    const { data } = await service
      .from("profiles")
      .select("organization_id")
      .eq("id", target_user_id)
      .maybeSingle();
    organizationId = (data?.organization_id as string | null) ?? null;
  } catch {
    organizationId = null;
  }

  // 6) Persist tokens (server-only) + connection status (non-secret).
  try {
    await storeTokenGrant({
      userId: target_user_id,
      provider,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token ?? null,
      tokenType: tokenJson.token_type ?? "Bearer",
      scopes: grantedScopes,
      expiresAt,
      metadata: { account_email: accountEmail },
    });
    await upsertConnection({
      userId: target_user_id,
      organizationId,
      provider,
      status: "connected",
      scopes: grantedScopes,
      metadata: { account_email: accountEmail },
    });
  } catch (err) {
    await recordIntegrationAudit({
      actor: null,
      action: "integration_connect_failed",
      provider,
      target_type: "user_integration_connections",
      target_id: target_user_id,
      metadata: { stage: "persist", error: err instanceof Error ? err.message : "unknown" },
    });
    return settingsRedirect(origin, { integration_error: "persist_failed", provider });
  }

  await recordIntegrationAudit({
    actor: null,
    action: "integration_connected",
    provider,
    target_type: "user_integration_connections",
    target_id: target_user_id,
    metadata: { account_email: accountEmail, scopes: grantedScopes },
  });

  return settingsRedirect(origin, { integration_connected: provider });
}
