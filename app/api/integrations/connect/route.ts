import { NextResponse } from "next/server";

import { signState } from "@/lib/integrations/oauthState";
import { isAdminOrOwner } from "@/lib/permissions";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sprint 4 — Lane 5. First step of the per-user Google OAuth connect flow.
//
// HONESTY + SAFETY:
// - This route NEVER returns a secret. It checks env PRESENCE only
//   (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET) and never the value.
// - If OAuth is not configured, it returns { status: "setup_needed" } so the
//   UI shows "Setup needed — admin must configure Google OAuth" instead of a
//   dead button.
// - It does NOT implement the full token exchange (deferred). It returns the
//   OAuth start URL / next step only. Tokens, when later added, live
//   server-side exclusively — never in the browser or the extension.
// - CORS: the LegendsOS browser companion (Chrome extension) calls this with
//   credentials. We answer the OPTIONS preflight and reflect a
//   chrome-extension:// (or same-site) Origin with credentials allowed. We do
//   NOT reflect arbitrary web origins.

const PROVIDERS = [
  "google",
  "gmail",
  "google_drive",
  "google_calendar",
  "youtube",
  "google_business_profile",
] as const;
type ProviderId = (typeof PROVIDERS)[number];

// Canonical OAuth redirect URI. MUST be identical in connect + callback and
// MUST match what's registered in the Google Cloud console. We use a fixed
// constant (not the request origin) so the redirect_uri is stable across hosts,
// previews, and the desktop shell. Override via GOOGLE_OAUTH_REDIRECT_URI.
const DEFAULT_REDIRECT_URI = "https://legndsosv20.netlify.app/api/integrations/connect/callback";

// Google OAuth scopes per capability. Requested at connect time later; listed
// here so the contract is explicit and the UI can show what will be asked.
const PROVIDER_SCOPES: Record<ProviderId, string[]> = {
  google: ["openid", "email", "profile"],
  gmail: ["https://www.googleapis.com/auth/gmail.readonly"],
  google_drive: ["https://www.googleapis.com/auth/drive.readonly"],
  google_calendar: ["https://www.googleapis.com/auth/calendar.events"],
  youtube: ["https://www.googleapis.com/auth/youtube.upload"],
  google_business_profile: ["https://www.googleapis.com/auth/business.manage"],
};

function envPresent(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim() !== "");
}

// Only reflect chrome-extension:// origins or our own same-site origin. Never
// echo an arbitrary third-party web origin back with credentials allowed.
function resolveAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (origin.startsWith("chrome-extension://")) return origin;
  // Same-site: the request Origin matches the deployed app host.
  const host = req.headers.get("host");
  try {
    const o = new URL(origin);
    if (host && o.host === host) return origin;
  } catch {
    return null;
  }
  return null;
}

function corsHeaders(req: Request): Record<string, string> {
  const allowed = resolveAllowedOrigin(req);
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}

// Preflight for the extension's credentialed POST.
export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401, headers: cors }
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { provider?: string; target_user_id?: string }
    | null;

  const providerRaw = body?.provider ?? "google";
  if (!PROVIDERS.includes(providerRaw as ProviderId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: `Unknown provider. Expected one of: ${PROVIDERS.join(", ")}.`,
      },
      { status: 400, headers: cors }
    );
  }
  const provider = providerRaw as ProviderId;

  // Owner-or-self: a user may connect their own account; an owner/admin may
  // initiate a connect on behalf of a team member. Anyone else connecting for
  // another user is forbidden.
  const targetUserId = body?.target_user_id ?? profile.id;
  if (targetUserId !== profile.id && !isAdminOrOwner(profile)) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "You can only connect your own integrations.",
      },
      { status: 403, headers: cors }
    );
  }

  // Presence-only check — never read the value of either secret.
  const oauthConfigured =
    envPresent("GOOGLE_OAUTH_CLIENT_ID") &&
    envPresent("GOOGLE_OAUTH_CLIENT_SECRET");

  if (!oauthConfigured) {
    // Honest setup-needed. The Connect button is not a dead button — it
    // surfaces a real reason and the admin action required.
    return NextResponse.json(
      {
        ok: true,
        status: "setup_needed",
        provider,
        message:
          "Setup needed — admin must configure Google OAuth (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET) in the server environment before any account can connect.",
        env_required: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        scopes: PROVIDER_SCOPES[provider],
      },
      { headers: cors }
    );
  }

  // OAuth IS configured. Return the first step (the authorize URL the browser
  // should be sent to). We deliberately stop here — full token exchange and
  // server-side token storage are deferred. The client_id is a PUBLIC OAuth
  // identifier (safe to expose); the client SECRET is never read or returned.
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  const scopes = PROVIDER_SCOPES[provider];

  // Build a standard Google OAuth 2.0 authorize URL (consent + offline so a
  // refresh token can later be exchanged server-side). State carries the
  // provider + target so the deferred callback can attribute the grant.
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", scopes.join(" "));
  authorize.searchParams.set("access_type", "offline");
  authorize.searchParams.set("include_granted_scopes", "true");
  authorize.searchParams.set("prompt", "consent");
  // HMAC-signed state so the callback can verify the round-trip and attribute
  // the grant to the right user without trusting a forgeable plain JSON blob.
  authorize.searchParams.set("state", signState({ provider, target_user_id: targetUserId }));

  return NextResponse.json(
    {
      ok: true,
      status: "oauth_start",
      provider,
      authorize_url: authorize.toString(),
      scopes,
      // The callback (/api/integrations/connect/callback) now completes the
      // exchange: it swaps the code for tokens server-side, stores them in the
      // RLS-locked oauth_token_grants table, and records the connection.
      next_step:
        "Open authorize_url to grant access. On redirect, the server completes the token exchange and stores the grant server-side.",
      completion_enabled: true,
    },
    { headers: cors }
  );
}
