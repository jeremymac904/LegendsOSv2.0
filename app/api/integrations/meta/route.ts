/**
 * GET  /api/integrations/meta   — legacy Meta connection + readiness status
 * POST /api/integrations/meta   — disabled legacy mutation path
 *
 * SAFETY: This route NEVER publishes to Meta and no longer writes shared
 * org-level destination rows. User-owned destination selection and publish
 * toggles live behind /api/integrations/connections.
 */

import { NextResponse } from "next/server";

import { detectMetaConfig, publishReadiness } from "@/lib/integrations/meta";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_PLATFORMS = ["facebook", "instagram"] as const;

// Inline row type — do NOT depend on types/database.ts edits landing first.
interface SocialAccountConnectionRow {
  id: string;
  platform: string;
  user_id: string | null;
  account_ref: string | null;
  is_publish_enabled: boolean;
  status: string | null;
  updated_at: string | null;
}

type ConnectionLookup =
  | { provisioned: true; row: SocialAccountConnectionRow | null }
  | { provisioned: false };

// Reads the Meta connection row through RLS. A missing table (42P01) means the
// migration hasn't been applied yet -> not provisioned (honest "setup needed").
async function loadMetaConnection(userId: string): Promise<ConnectionLookup> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("social_account_connections")
      .select("id,platform,user_id,account_ref,is_publish_enabled,status,updated_at")
      .eq("user_id", userId)
      .in("platform", [...META_PLATFORMS])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01") return { provisioned: false };
      // Any other read error -> treat as provisioned-but-empty so we still
      // render an honest "no connection" state rather than crashing.
      return { provisioned: true, row: null };
    }
    return {
      provisioned: true,
      row: (data ?? null) as SocialAccountConnectionRow | null,
    };
  } catch {
    return { provisioned: false };
  }
}

// ---------------------------------------------------------------------------
// GET — status (any authenticated user may read their org's status)
// ---------------------------------------------------------------------------

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const config = detectMetaConfig();
  const lookup = await loadMetaConnection(profile.id);

  const provisioned = lookup.provisioned;
  const row = provisioned ? lookup.row : null;
  const pageConnected = Boolean(row);
  const publishEnabled = Boolean(row?.is_publish_enabled);

  const readiness = publishReadiness({ pageConnected, publishEnabled });

  return NextResponse.json({
    ok: true,
    // Honest provisioning state: false => the table doesn't exist yet.
    provisioned,
    connection: provisioned
      ? {
          // Never echo tokens — this table holds no raw tokens by design.
          connected: pageConnected,
          account_ref: row?.account_ref ?? null,
          is_publish_enabled: publishEnabled,
          status: row?.status ?? (pageConnected ? "connected" : "not_connected"),
          updated_at: row?.updated_at ?? null,
        }
      : null,
    config: {
      configured: config.configured,
      // Presence-only — already derived from env NAME presence in meta.ts.
      paid_enabled: config.paid_enabled,
      capabilities: config.capabilities,
    },
    readiness,
    // Legacy mutation is disabled. Use /api/integrations/connections so the
    // signed-in user manages only their own selected destination row.
    can_manage: false,
  });
}

// ---------------------------------------------------------------------------
// POST — disabled legacy mutation path.
// Use /api/integrations/connections with a user-owned destination_id instead.
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  if (!(await getCurrentProfile())) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  await req.json().catch(() => null);
  return NextResponse.json(
    {
      ok: false,
      error: "legacy_route_disabled",
      message:
        "Use Connection Center to enable publishing on your own selected Facebook or Instagram destination.",
    },
    { status: 410 }
  );
}
