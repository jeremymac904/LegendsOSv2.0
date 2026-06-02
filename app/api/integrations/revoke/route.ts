/**
 * POST /api/integrations/revoke — disconnect a per-user integration.
 *
 * Deletes the server-side token grant (oauth_token_grants) and marks the
 * user_integration_connections row status='revoked'. Self-service, or owner/
 * admin acting on behalf of a team member. Audited. Never returns a token.
 *
 * Body: { provider: string, target_user_id?: string }
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import { deleteTokenGrant } from "@/lib/integrations/tokenStore";
import { isAdminOrOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServiceClient,
  isMissingDatabaseObjectError,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.string().min(1).max(64),
  target_user_id: z.string().uuid().nullish(),
});

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
      { ok: false, error: "forbidden", message: "You can only revoke your own integrations." },
      { status: 403 }
    );
  }

  try {
    // Remove the secret grant first (server-only table).
    await deleteTokenGrant(targetUserId, provider);

    // Mark the public status row revoked (don't delete it — keep the history).
    const service = getSupabaseServiceClient();
    const { error } = await service
      .from("user_integration_connections")
      .update({ status: "revoked", last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", targetUserId)
      .eq("provider", provider);
    // A missing row just means nothing to update; not an error to the caller.
    if (error && !isMissingDatabaseObjectError(error)) {
      console.error("revoke status update failed", { code: error.code, message: error.message });
    }

    await recordIntegrationAudit({
      actor: profile,
      action: "integration_revoked",
      provider,
      target_type: "user_integration_connections",
      target_id: targetUserId,
      metadata: { on_behalf: targetUserId !== profile.id },
    });

    return NextResponse.json({ ok: true, provider, status: "revoked" });
  } catch (err) {
    if (isMissingDatabaseObjectError(err)) {
      return NextResponse.json(
        { ok: false, error: "not_provisioned", message: "Integration tables are not provisioned." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "internal_error", message: err instanceof Error ? err.message : "Revoke failed." },
      { status: 500 }
    );
  }
}
