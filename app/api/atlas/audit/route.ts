// Atlas audit log surface.
//
// Returns the last 25 audit_logs rows. Scoping behavior:
//   - Owner: full visibility into the org's recent audit trail.
//   - Non-owner: only their own actions (actor_user_id = profile.id).
//
// The base `audit_logs` table is owner-only at the RLS layer, so we use the
// service-role client to read on behalf of a non-owner and filter strictly
// to their own actor id. The service-role client is server-only and never
// reaches the browser; the response shape matches `AtlasAuditEntry`.
import { NextResponse } from "next/server";

import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import type { AtlasAuditEntry } from "@/lib/atlas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  // Owner: RLS already exposes the org's audit_logs rows. Use the user-scoped
  // client so the read continues to be policy-checked rather than bypassing.
  if (isOwner(profile)) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        "id,actor_user_id,action,target_type,target_id,metadata,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "internal_error", message: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      entries: (data ?? []) as AtlasAuditEntry[],
      generated_at: new Date().toISOString(),
    });
  }

  // Non-owner: service-role read, strictly filtered to this actor + org.
  const service = getSupabaseServiceClient();
  const query = service
    .from("audit_logs")
    .select("id,actor_user_id,action,target_type,target_id,metadata,created_at")
    .eq("actor_user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  const { data, error } = profile.organization_id
    ? await query.eq("organization_id", profile.organization_id)
    : await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    entries: (data ?? []) as AtlasAuditEntry[],
    generated_at: new Date().toISOString(),
  });
}
