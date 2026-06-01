// Server-only Google OAuth token helpers (refresh + live probe).
// ---------------------------------------------------------------------------
// Used by the test-connection route and (later) by Gmail/Drive/Calendar calls.
// Tokens are read from oauth_token_grants via the service client and NEVER
// returned to a client. ensureFreshAccessToken transparently refreshes an
// expired access token using the stored refresh token.

import { getTokenGrant, storeTokenGrant } from "@/lib/integrations/tokenStore";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const EXPIRY_BUFFER_MS = 60_000; // refresh if within 60s of expiry

export type FreshTokenResult =
  | { ok: true; accessToken: string; accountEmail: string | null; scopes: string[] }
  | { ok: false; reason: "not_connected" | "needs_reauth" | "not_configured" | "error"; message?: string };

function oauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
}> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  return (await resp.json().catch(() => ({}))) as Awaited<ReturnType<typeof refreshAccessToken>>;
}

// Returns a usable access token for (userId, provider), refreshing if needed.
export async function ensureFreshAccessToken(userId: string, provider: string): Promise<FreshTokenResult> {
  if (!oauthConfigured()) return { ok: false, reason: "not_configured" };

  let grant;
  try {
    grant = await getTokenGrant(userId, provider);
  } catch (err) {
    return { ok: false, reason: "error", message: err instanceof Error ? err.message : "read failed" };
  }
  if (!grant || !grant.access_token) return { ok: false, reason: "not_connected" };

  const accountEmail =
    (grant.metadata && typeof grant.metadata === "object"
      ? ((grant.metadata as Record<string, unknown>).account_email as string | undefined)
      : undefined) ?? null;
  const scopes = grant.scopes ?? [];

  const expMs = grant.expires_at ? Date.parse(grant.expires_at) : 0;
  const stillValid = expMs && expMs - Date.now() > EXPIRY_BUFFER_MS;
  if (stillValid) {
    return { ok: true, accessToken: grant.access_token, accountEmail, scopes };
  }

  // Expired (or unknown expiry) — refresh if we have a refresh token.
  if (!grant.refresh_token) {
    return { ok: false, reason: "needs_reauth", message: "access token expired and no refresh token stored" };
  }
  const refreshed = await refreshAccessToken(grant.refresh_token);
  if (refreshed.error || !refreshed.access_token) {
    return { ok: false, reason: "needs_reauth", message: refreshed.error ?? "refresh failed" };
  }
  const newExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null;
  try {
    await storeTokenGrant({
      userId,
      provider,
      accessToken: refreshed.access_token,
      refreshToken: grant.refresh_token, // Google omits refresh_token on refresh; keep the old one
      tokenType: refreshed.token_type ?? grant.token_type ?? "Bearer",
      scopes: refreshed.scope ? refreshed.scope.split(/\s+/).filter(Boolean) : scopes,
      expiresAt: newExpiresAt,
      metadata: { account_email: accountEmail },
    });
  } catch {
    // Persisting the refreshed token failed; we can still use it for this probe.
  }
  return { ok: true, accessToken: refreshed.access_token, accountEmail, scopes };
}

// Cheap live probe: call Google's userinfo with the token. Returns connected +
// the account email, or the failure reason.
export async function probeGoogle(accessToken: string): Promise<{ ok: boolean; status: number; email: string | null }> {
  try {
    const resp = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) return { ok: false, status: resp.status, email: null };
    const info = (await resp.json().catch(() => ({}))) as { email?: string };
    return { ok: true, status: 200, email: info.email ?? null };
  } catch {
    return { ok: false, status: 0, email: null };
  }
}
