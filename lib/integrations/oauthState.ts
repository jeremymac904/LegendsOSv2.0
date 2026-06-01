// Signed OAuth `state` so the connect → callback round-trip cannot be forged.
// ---------------------------------------------------------------------------
// The connect route puts {provider, target_user_id, nonce, ts} in `state`,
// HMAC-signs it, and the callback verifies the signature + freshness before
// exchanging the authorization code. This closes the CSRF / grant-injection
// gap (an attacker can't craft a state that attributes a Google grant to
// another user). The signing key is a server secret, never sent to the client.

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import { getServerEnv } from "@/lib/env";

export interface OAuthState {
  provider: string;
  target_user_id: string;
  nonce: string;
  ts: number;
}

const MAX_AGE_MS = 15 * 60 * 1000; // states older than 15 min are rejected

function signingKey(): string {
  // Prefer a dedicated secret; fall back to the service key (server-only) or
  // n8n secret. All are server-side only and never reach the browser.
  const env = getServerEnv();
  return (
    process.env.OAUTH_STATE_SECRET ||
    env.SUPABASE_SECRET_KEY ||
    env.N8N_WEBHOOK_SECRET ||
    "legendsos-oauth-state-fallback"
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

// Returns a compact `payload.signature` token safe to put in an OAuth state param.
export function signState(input: Omit<OAuthState, "nonce" | "ts"> & { nonce?: string; ts?: number }): string {
  const state: OAuthState = {
    provider: input.provider,
    target_user_id: input.target_user_id,
    nonce: input.nonce ?? cryptoRandom(),
    ts: input.ts ?? Date.now(),
  };
  const payload = b64url(JSON.stringify(state));
  const sig = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export interface VerifyResult {
  ok: boolean;
  state?: OAuthState;
  reason?: "malformed" | "bad_signature" | "expired";
}

// Verify a signed state token. Constant-time signature compare + freshness check.
export function verifyState(token: string | null | undefined): VerifyResult {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [payload, sig] = token.split(".", 2);
  if (!payload || !sig) return { ok: false, reason: "malformed" };

  const expected = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof state.ts !== "number" || Date.now() - state.ts > MAX_AGE_MS) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, state };
}

function cryptoRandom(): string {
  // 16 random bytes, hex.
  return randomBytes(16).toString("hex");
}
