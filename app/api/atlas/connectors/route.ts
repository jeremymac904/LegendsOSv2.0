// Atlas connector registry — GET (RLS-scoped list) + POST (owner-only create).
//
// Hard rules baked in here:
//   - Auth: 401 if no profile.
//   - Visibility on GET is RLS-driven via the user-scoped supabase client.
//     Owners see everything; org members see rows for their org or NULL org.
//   - POST is owner-only — non-owner callers get 403.
//   - `config_json` only ever stores ENV VAR NAMES + tier labels, never any
//     secret values. The route does not enforce this beyond accepting the
//     raw object; the migration's CHECK constraints + RLS handle the rest.
//   - All actions audit through `recordAudit`.
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

const TYPES = ["automation", "messaging", "mcp", "other"] as const;
const STATUSES = ["active", "inactive", "error", "coming_soon"] as const;

const postSchema = z.object({
  name: z.string().min(1).max(128),
  type: z.enum(TYPES),
  status: z.enum(STATUSES).optional(),
  config_json: z.record(z.unknown()).optional(),
  organization_id: z.string().uuid().nullish(),
});

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("atlas_connectors")
    .select(
      "id,name,type,status,config_json,owner_id,organization_id,created_at,updated_at"
    )
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: error.message },
      { status: 500 }
    );
  }

  const connectors = (data ?? []) as AtlasConnector[];
  return NextResponse.json({
    ok: true,
    connectors,
    generated_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isOwner(profile)) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "Owner-only endpoint.",
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
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
  const { name, type, status, config_json, organization_id } = parsed.data;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("atlas_connectors")
    .insert({
      name,
      type,
      status: status ?? "inactive",
      config_json: config_json ?? {},
      owner_id: profile.id,
      organization_id:
        organization_id === undefined
          ? profile.organization_id
          : organization_id,
    })
    .select(
      "id,name,type,status,config_json,owner_id,organization_id,created_at,updated_at"
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: error?.message ?? "insert failed",
      },
      { status: 500 }
    );
  }

  await recordAudit({
    actor: profile,
    action: "atlas_connector_created",
    target_type: "atlas_connectors",
    target_id: data.id,
    metadata: { name: data.name, type: data.type, status: data.status },
  });

  return NextResponse.json({ ok: true, connector: data as AtlasConnector });
}
