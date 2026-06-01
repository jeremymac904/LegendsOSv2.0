// Server-only OAuth token store.
// ---------------------------------------------------------------------------
// Tokens live in public.oauth_token_grants, which has RLS enabled with ZERO
// client policies (grants revoked) — only the service_role can read/write it,
// so an access/refresh token can NEVER reach a browser. Every function here
// uses the service client and is import-guarded to server runtime. NEVER import
// this from a client component.
//
// user_integration_connections holds only NON-secret status (provider, status,
// scopes, connected account email in metadata) and is what the UI reads.

import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface TokenGrantInput {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scopes?: string[];
  expiresAt?: string | null; // ISO timestamptz
  metadata?: Record<string, unknown>;
}

// Upsert a token grant (one row per user+provider). Service-role only.
export async function storeTokenGrant(input: TokenGrantInput): Promise<void> {
  const service = getSupabaseServiceClient();
  const { error } = await service.from("oauth_token_grants").upsert(
    {
      user_id: input.userId,
      provider: input.provider,
      access_token: input.accessToken,
      refresh_token: input.refreshToken ?? null,
      token_type: input.tokenType ?? "Bearer",
      scopes: input.scopes ?? [],
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw new Error(`store token grant failed: ${error.message}`);
}

export interface TokenGrant {
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scopes: string[] | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

// Read a token grant (service-role only — callers run on the server).
export async function getTokenGrant(userId: string, provider: string): Promise<TokenGrant | null> {
  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from("oauth_token_grants")
    .select("user_id,provider,access_token,refresh_token,token_type,scopes,expires_at,metadata")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(`read token grant failed: ${error.message}`);
  return (data as TokenGrant | null) ?? null;
}

// Delete a token grant (used on revoke). Service-role only.
export async function deleteTokenGrant(userId: string, provider: string): Promise<void> {
  const service = getSupabaseServiceClient();
  const { error } = await service
    .from("oauth_token_grants")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(`delete token grant failed: ${error.message}`);
}

export type ConnectionStatus =
  | "not_connected"
  | "connected"
  | "needs_setup"
  | "error"
  | "revoked"
  | "disabled";

export interface UpsertConnectionInput {
  userId: string;
  organizationId: string | null;
  provider: string;
  status: ConnectionStatus;
  scopes?: string[];
  metadata?: Record<string, unknown>;
  connectedAt?: string | null;
  lastCheckedAt?: string | null;
}

// Upsert the NON-secret connection status row the UI reads. Service-role write
// so it lands regardless of RLS write-policy shape; never stores a token here.
export async function upsertConnection(input: UpsertConnectionInput): Promise<void> {
  const service = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    user_id: input.userId,
    organization_id: input.organizationId,
    provider: input.provider,
    status: input.status,
    scopes: input.scopes ?? [],
    metadata: input.metadata ?? {},
    last_checked_at: input.lastCheckedAt ?? now,
    updated_at: now,
  };
  if (input.status === "connected") {
    row.connected_at = input.connectedAt ?? now;
  }
  const { error } = await service
    .from("user_integration_connections")
    .upsert(row, { onConflict: "user_id,provider" });
  if (error) throw new Error(`upsert connection failed: ${error.message}`);
}
