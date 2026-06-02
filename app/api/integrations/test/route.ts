/**
 * POST /api/integrations/test — verify a per-user Google connection is live.
 *
 * Loads the stored token (refreshing if expired), makes a cheap authenticated
 * call to Google (userinfo), and writes an honest status + last_checked_at to
 * user_integration_connections. Self-service, or owner/admin on behalf.
 * Returns one of: connected | needs_reauth | not_connected | not_configured.
 * Never returns the token. Read-only — does not send/publish anything.
 *
 * Body: { provider: string, target_user_id?: string }
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import { ensureFreshAccessToken, probeGoogle } from "@/lib/integrations/google";
import { upsertConnection, type ConnectionStatus } from "@/lib/integrations/tokenStore";
import { isAdminOrOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_PROVIDERS = new Set(["google", "gmail", "google_drive", "google_calendar"]);

const schema = z.object({
  provider: z.string().min(1).max(64),
  target_user_id: z.string().uuid().nullish(),
});

async function targetOrgId(userId: string): Promise<string | null> {
  try {
    const service = getSupabaseServiceClient();
    const { data } = await service.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    return (data?.organization_id as string | null) ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }
  const { provider } = parsed.data;
  const targetUserId = parsed.data.target_user_id ?? profile.id;
  if (targetUserId !== profile.id && !isAdminOrOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "You can only test your own integrations." },
      { status: 403 }
    );
  }

  if (!GOOGLE_PROVIDERS.has(provider)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported_provider",
        message: `Test is only implemented for Google providers so far (got '${provider}').`,
      },
      { status: 400 }
    );
  }

  const fresh = await ensureFreshAccessToken(targetUserId, provider);

  // Map the helper result to an honest connection status.
  let status: ConnectionStatus;
  let resultMessage: string;
  let accountEmail: string | null = null;

  if (!fresh.ok) {
    switch (fresh.reason) {
      case "not_configured":
        return NextResponse.json({
          ok: true,
          provider,
          status: "needs_setup",
          live: false,
          message: "Google OAuth is not configured (GOOGLE_OAUTH_CLIENT_ID / SECRET). Ask the owner to set it up.",
        });
      case "not_connected":
        status = "not_connected";
        resultMessage = "No connection on file — connect this account first.";
        break;
      case "needs_reauth":
        status = "error";
        resultMessage = "Connection expired or was revoked upstream — reconnect to refresh access.";
        break;
      default:
        status = "error";
        resultMessage = fresh.message ?? "Connection test failed.";
    }
  } else {
    const probe = await probeGoogle(fresh.accessToken);
    if (probe.ok) {
      status = "connected";
      accountEmail = probe.email ?? fresh.accountEmail;
      resultMessage = accountEmail ? `Connected as ${accountEmail}.` : "Connection is live.";
    } else if (probe.status === 401 || probe.status === 403) {
      status = "error";
      resultMessage = "Google rejected the token — reconnect to re-authorize.";
    } else {
      status = "error";
      resultMessage = "Could not reach Google to verify the connection.";
    }
  }

  // Persist the honest result (status + last_checked_at). Best-effort.
  try {
    await upsertConnection({
      userId: targetUserId,
      organizationId: await targetOrgId(targetUserId),
      provider,
      status,
      metadata: accountEmail ? { account_email: accountEmail } : {},
      lastCheckedAt: new Date().toISOString(),
    });
  } catch {
    // status write failed — still return the honest probe result below.
  }

  await recordIntegrationAudit({
    actor: profile,
    action: "integration_tested",
    provider,
    target_type: "user_integration_connections",
    target_id: targetUserId,
    metadata: { status, on_behalf: targetUserId !== profile.id },
  });

  return NextResponse.json({
    ok: true,
    provider,
    status,
    live: status === "connected",
    account_email: accountEmail,
    message: resultMessage,
  });
}
