// LegendsOS v2 — Sprint 4 — Browser Companion: integration audit log.
//
// GET (owner/admin only, else 403) -> integration_audit_log rows.
// 42P01 -> { provisioned:false } (honest "setup needed").
// Unauthenticated -> 401. Non-owner/admin -> 403.
// OPTIONS -> CORS preflight (chrome-extension origin + credentials).
//
// Rows carry only non-content metadata (action, source_url, actor, timestamp).
// We use the user-scoped client so the RLS owner/admin policy enforces on the
// DB side as well as the role check here.

import { corsJson, preflight, readAudit } from "@/lib/browserCompanion/store";
import { isAdminOrOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return corsJson(req, { ok: false, error: "unauthorized" }, 401);
  }
  if (!isAdminOrOwner(profile)) {
    return corsJson(
      req,
      { ok: false, error: "forbidden", message: "Owner/admin only." },
      403
    );
  }

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam) ? limitParam : 50;

  const userClient = getSupabaseServerClient();
  const result = await readAudit(userClient, {
    organization_id: profile.organization_id,
    limit,
  });

  if (!result.provisioned) {
    return corsJson(req, { ok: true, provisioned: false, entries: [] });
  }

  if (!result.ok) {
    return corsJson(
      req,
      { ok: false, provisioned: true, error: result.error ?? "read_failed", entries: [] },
      200
    );
  }

  const entries = (result.data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    provider: row.provider,
    source_url: row.source_url,
    actor_id: row.actor_id,
    target_type: row.target_type,
    target_id: row.target_id,
    metadata: row.metadata,
    created_at: row.created_at,
  }));

  return corsJson(req, {
    ok: true,
    provisioned: true,
    entries,
  });
}
