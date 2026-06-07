// Server-only per-user OAuth access-token resolver.
// ---------------------------------------------------------------------------
// Single source of truth for "give me the signed-in user's OWN access token for
// provider X". Tokens live ENCRYPTED in social_connection_secrets (one row per
// user_integration_connection, keyed unique by user_integration_connection_id).
// The connect callback writes them there; this module decrypts, refreshes when
// expired (Google only), re-encrypts, and returns a usable bearer token.
//
// Tokens are read via the service client (social_connection_secrets is
// service-role-only) and are NEVER logged, echoed, or returned to a client.
// Server-only: never import from a client component.

import { decryptSecret, encryptSecret } from "@/lib/integrations/oauth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_BUFFER_MS = 60_000; // refresh if within 60s of expiry

// Logical provider (what callers ask for) -> vault provider key (what the
// connect callback stored under). youtube + google_business_profile share the
// combined 'google_social' grant; gmail/drive/calendar use their own keys;
// facebook/instagram publishing both use the 'facebook' grant.
const PROVIDER_VAULT_KEY: Record<string, string> = {
  youtube: "google_social",
  google_business_profile: "google_social",
  google_social: "google_social",
  gmail: "gmail",
  google_drive: "google_drive",
  google_calendar: "google_calendar",
  google: "google",
  facebook: "facebook",
  instagram: "facebook",
};

// Vault keys that are Google OAuth grants (refreshable via the Google token
// endpoint). 'facebook' is NOT here — Meta long-lived tokens don't refresh the
// same way and re-auth is required when they expire.
const GOOGLE_VAULT_KEYS = new Set([
  "google_social",
  "gmail",
  "google_drive",
  "google_calendar",
  "google",
]);

export type UserAccessTokenResult =
  | { ok: true; accessToken: string; scopes: string[]; accountEmail: string | null }
  | { ok: false; reason: "not_connected" | "needs_reauth" | "not_configured" | "error"; message?: string };

interface DecryptedSecret {
  provider?: string;
  access_token?: string;
  refresh_token?: string | null;
  token_type?: string;
  expires_in?: number | null;
  scope?: string | null;
  stored_at?: string;
}

interface SecretRow {
  id: string;
  encrypted_secret: string;
  token_type: string | null;
  scopes: string[] | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

function googleOauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

function accountEmailFromMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  // Either a flat account_email, or the nested google_account summary block.
  const flat = metadata.account_email;
  if (typeof flat === "string" && flat) return flat;
  const googleAccount = metadata.google_account;
  if (googleAccount && typeof googleAccount === "object") {
    const email = (googleAccount as Record<string, unknown>).account_email;
    if (typeof email === "string" && email) return email;
  }
  return null;
}

async function refreshGoogleToken(refreshToken: string): Promise<{
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
  return (await resp.json().catch(() => ({}))) as Awaited<ReturnType<typeof refreshGoogleToken>>;
}

/**
 * Resolve a usable access token for (userId, logical provider) from the vault,
 * refreshing transparently when expired. Reads social_connection_secrets via the
 * service client, decrypts the stored JSON, and returns a bearer token.
 *
 * Never returns/logs refresh tokens or the encrypted payload.
 */
export async function getUserAccessToken(
  userId: string,
  provider: string
): Promise<UserAccessTokenResult> {
  const vaultKey = PROVIDER_VAULT_KEY[provider];
  if (!vaultKey) {
    return { ok: false, reason: "error", message: `unknown provider: ${provider}` };
  }

  const isGoogle = GOOGLE_VAULT_KEYS.has(vaultKey);
  if (isGoogle && !googleOauthConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const service = getSupabaseServiceClient();

  let row: SecretRow | null;
  try {
    const { data, error } = await service
      .from("social_connection_secrets")
      .select("id,encrypted_secret,token_type,scopes,expires_at,metadata")
      .eq("user_id", userId)
      .eq("provider", vaultKey)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { ok: false, reason: "error", message: error.message };
    }
    row = (data as SecretRow | null) ?? null;
  } catch (err) {
    return { ok: false, reason: "error", message: err instanceof Error ? err.message : "vault read failed" };
  }

  if (!row) return { ok: false, reason: "not_connected" };

  let secret: DecryptedSecret;
  try {
    secret = JSON.parse(decryptSecret(row.encrypted_secret)) as DecryptedSecret;
  } catch (err) {
    return { ok: false, reason: "error", message: err instanceof Error ? err.message : "decrypt failed" };
  }

  const accessToken = secret.access_token ?? "";
  if (!accessToken) return { ok: false, reason: "not_connected" };

  const scopes = row.scopes ?? (secret.scope ? secret.scope.split(/\s+/).filter(Boolean) : []);
  const accountEmail = accountEmailFromMetadata(row.metadata);

  // Use the row's expires_at column as the authority on expiry.
  const expMs = row.expires_at ? Date.parse(row.expires_at) : 0;
  const stillValid = expMs && expMs - Date.now() > EXPIRY_BUFFER_MS;
  if (stillValid) {
    return { ok: true, accessToken, scopes, accountEmail };
  }

  // Expired (or unknown expiry). Facebook long-lived tokens can't be refreshed
  // through the OAuth refresh grant — require re-auth instead.
  if (!isGoogle) {
    if (expMs) {
      return { ok: false, reason: "needs_reauth", message: "access token expired — reconnect required" };
    }
    // Unknown expiry for a non-Google grant — use what we have.
    return { ok: true, accessToken, scopes, accountEmail };
  }

  const refreshToken = secret.refresh_token ?? null;
  if (!refreshToken) {
    return { ok: false, reason: "needs_reauth", message: "access token expired and no refresh token stored" };
  }

  const refreshed = await refreshGoogleToken(refreshToken);
  if (refreshed.error || !refreshed.access_token) {
    return { ok: false, reason: "needs_reauth", message: refreshed.error ?? "refresh failed" };
  }

  const newExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null;
  const nextScopes = refreshed.scope ? refreshed.scope.split(/\s+/).filter(Boolean) : scopes;

  // Re-encrypt and persist the refreshed token. Google omits refresh_token on
  // refresh, so keep the original. Best-effort: a write failure does not stop us
  // returning a usable token for this request.
  try {
    const nextSecret: DecryptedSecret = {
      provider: secret.provider ?? vaultKey,
      access_token: refreshed.access_token,
      refresh_token: refreshToken,
      token_type: refreshed.token_type ?? secret.token_type ?? row.token_type ?? "Bearer",
      expires_in: refreshed.expires_in ?? null,
      scope: refreshed.scope ?? secret.scope ?? null,
      stored_at: new Date().toISOString(),
    };
    await service
      .from("social_connection_secrets")
      .update({
        encrypted_secret: encryptSecret(JSON.stringify(nextSecret)),
        token_type: nextSecret.token_type,
        scopes: nextScopes,
        expires_at: newExpiresAt,
      })
      .eq("id", row.id);
  } catch {
    // Persisting the refreshed token failed — still usable for this request.
  }

  return { ok: true, accessToken: refreshed.access_token, scopes: nextScopes, accountEmail };
}
