// Atlas connector update endpoint — owner-only PATCH of status + config.
//
// Hard rules:
//   - Auth: 401 if no profile.
//   - Owner-only: 403 if non-owner.
//   - RLS additionally enforces owner-only writes; we check here too so the
//     response code is correct rather than relying on a 500 from RLS.
//   - Audits every update via `recordAudit`.
import { NextResponse } from "next/server";
import { z } from "zod";

import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
import type { AtlasConnector } from "@/lib/atlas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["active", "inactive", "error", "coming_soon"] as const;

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  config_json: z.record(z.unknown()).optional(),
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner-only endpoint." },
      { status: 403 }
    );
  }
  if (!params?.id || !UUID_RE.test(params.id)) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: "Connector id must be a UUID.",
      },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }
  const { status, config_json } = parsed.data;

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (config_json !== undefined) updates.config_json = config_json;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: "Provide at least one of: status, config_json.",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("atlas_connectors")
    .update(updates)
    .eq("id", params.id)
    .select(
      "id,name,type,status,config_json,owner_id,organization_id,created_at,updated_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: error.message },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_found",
        message: "Connector not found, or you don't have access.",
      },
      { status: 404 }
    );
  }

  await recordAudit({
    actor: profile,
    action: "atlas_connector_updated",
    target_type: "atlas_connectors",
    target_id: data.id,
    metadata: {
      changes: Object.keys(updates),
      status: data.status,
    },
  });

  return NextResponse.json({ ok: true, connector: data as AtlasConnector });
}
