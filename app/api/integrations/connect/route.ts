import { NextResponse } from "next/server";

import { isAdminOrOwner } from "@/lib/permissions";
import { createOAuthState } from "@/lib/integrations/oauth";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sprint 4 — Lane 5. First step of the per-user Google / Meta OAuth connect flow.
//
// HONESTY + SAFETY:
// - This route NEVER returns a secret. It checks env PRESENCE only and never
//   any env value.
// - If OAuth is not configured, it returns { status: "setup_needed" } so the
//   UI shows an honest setup-needed message instead of a dead button.
// - The callback route performs the token exchange and server-side storage.
//   Tokens, when later added, live server-side exclusively — never in the
//   browser or the extension.
// - CORS: the LegendsOS browser companion (Chrome extension) calls this with
//   credentials. We answer the OPTIONS preflight and reflect a
//   chrome-extension:// (or same-site) Origin with credentials allowed. We do
//   NOT reflect arbitrary web origins.

const PROVIDERS = [
  "google",
  "google_social",
  "gmail",
  "google_drive",
  "google_calendar",
  "facebook",
] as const;
type ProviderId = (typeof PROVIDERS)[number];

// Google OAuth scopes per capability. Requested at connect time; listed here
// so the contract is explicit and the UI can show what will be asked. These
// must stay aligned with app/api/integrations/google/* action routes.
const PROVIDER_SCOPES: Record<ProviderId, string[]> = {
  google: ["openid", "email", "profile"],
  google_social: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
  ],
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
  ],
  google_drive: ["https://www.googleapis.com/auth/drive"],
  google_calendar: ["https://www.googleapis.com/auth/calendar.events"],
  facebook: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
  ],
};

function isMetaProvider(provider: ProviderId): provider is "facebook" {
  return provider === "facebook";
}

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
    | { provider?: string; target_user_id?: string; return_to?: string }
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

  const targetReturnTo = sanitizeReturnTo(body?.return_to);

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
    provider === "facebook"
      ? envPresent("META_APP_ID") && envPresent("META_APP_SECRET")
      : envPresent("GOOGLE_OAUTH_CLIENT_ID") &&
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
          provider === "facebook"
            ? "Setup needed — admin must configure Meta app credentials (META_APP_ID and META_APP_SECRET) in the server environment before any account can connect."
            : "Setup needed — admin must configure Google OAuth (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET) in the server environment before any account can connect.",
        env_required:
          provider === "facebook"
            ? ["META_APP_ID", "META_APP_SECRET"]
            : ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
        scopes: PROVIDER_SCOPES[provider],
      },
      { headers: cors }
    );
  }

  const scopes = PROVIDER_SCOPES[provider];
  const state = createOAuthState({
    provider,
    target_user_id: targetUserId,
    ...(targetReturnTo ? { return_to: targetReturnTo } : {}),
  });
  const redirectUri =
    provider === "facebook"
      ? `${new URL(req.url).origin}/api/integrations/connect/callback`
      : process.env.GOOGLE_OAUTH_REDIRECT_URI ??
        `${new URL(req.url).origin}/api/integrations/connect/callback`;

  let authorize: URL;
  if (isMetaProvider(provider)) {
    authorize = new URL("https://www.facebook.com/v22.0/dialog/oauth");
    authorize.searchParams.set("client_id", process.env.META_APP_ID ?? "");
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", scopes.join(","));
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("auth_type", "rerequest");
  } else {
    // Build a standard Google OAuth 2.0 authorize URL (consent + offline so a
    // refresh token can later be exchanged server-side). State carries the
    // provider + target so the callback can attribute the grant.
    authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorize.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID ?? "");
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", scopes.join(" "));
    authorize.searchParams.set("access_type", "offline");
    authorize.searchParams.set("include_granted_scopes", "true");
    authorize.searchParams.set("prompt", "consent");
    authorize.searchParams.set("state", state);
  }

  return NextResponse.json(
    {
      ok: true,
      status: "oauth_start",
      provider,
      authorize_url: authorize.toString(),
      scopes,
      // The callback route completes token exchange + per-user destination
      // discovery server-side.
      next_step:
        "Open authorize_url to grant access. The callback will store the grant server-side and return you to Connection Center.",
      completion_enabled: true,
    },
    { headers: cors }
  );
}

function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const candidate = raw.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;

  try {
    const parsed = new URL(candidate, "https://app.local");
    if (parsed.origin !== "https://app.local") return null;
    const next = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return next.length > 1 ? next : "/";
  } catch {
    return null;
  }
}
