// LegendsOS v2 — Sprint 4 — Browser Companion: recent captures (context).
//
// GET (auth) -> recent captures for the current user. Owner/admin may pass
//               ?all=1 to see the org (RLS still enforces what they can read).
// 42P01 -> { provisioned:false, captures:[] } (honest "setup needed").
// Unauthenticated -> 401.
// OPTIONS -> CORS preflight (chrome-extension origin + credentials).
//
// We intentionally return the stored capture rows to the OWNER of those rows
// (RLS-scoped). selected_text belongs to the requesting user, so returning it
// to them is fine — but it is never logged to console.

import {
  corsJson,
  preflight,
  readCaptures,
} from "@/lib/browserCompanion/store";
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

  const url = new URL(req.url);
  const wantsAll = url.searchParams.get("all") === "1";
  // Only owner/admin may request the org-wide view; anyone else is forced to
  // their own captures regardless of the query param.
  const all = wantsAll && isAdminOrOwner(profile);

  const limitParam = Number(url.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitParam) ? limitParam : 25;

  const userClient = getSupabaseServerClient();
  const result = await readCaptures(userClient, {
    user_id: profile.id,
    organization_id: profile.organization_id,
    all,
    limit,
  });

  if (!result.provisioned) {
    return corsJson(req, {
      ok: true,
      provisioned: false,
      captures: [],
    });
  }

  if (!result.ok) {
    return corsJson(
      req,
      { ok: false, provisioned: true, error: result.error ?? "read_failed", captures: [] },
      200
    );
  }

  // Shape a lean, explicit payload (no raw row passthrough).
  const captures = (result.data ?? []).map((row) => ({
    id: row.id,
    source_url: row.source_url,
    source_title: row.source_title,
    selected_text: row.selected_text,
    structured_context: row.structured_context,
    routed_assistant: row.routed_assistant,
    status: row.status,
    captured_at: row.captured_at,
    user_id: row.user_id,
  }));

  return corsJson(req, {
    ok: true,
    provisioned: true,
    scope: all ? "org" : "self",
    captures,
  });
}
