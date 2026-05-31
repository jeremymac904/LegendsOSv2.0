/**
 * GET  /api/integrations/meta   — Meta connection + publish-readiness status
 * POST /api/integrations/meta   — owner-only actions (set_publish_enabled)
 *
 * SAFETY: This route NEVER publishes to Meta. It reports honest status and lets
 * the owner toggle the publish-enabled approval switch. Even when the switch is
 * on, live sending requires full config + the master safety flag + a future
 * live-wiring PR. The `social_account_connections` table is created by the
 * Supabase lane but NOT applied this sprint — every read/write that touches it
 * treats a missing-table (42P01) error as "not provisioned yet" so the app
 * builds and runs before the migration lands.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { detectMetaConfig, publishReadiness } from "@/lib/integrations/meta";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_PLATFORM = "meta";

// Inline row type — do NOT depend on types/database.ts edits landing first.
interface SocialAccountConnectionRow {
  id: string;
  platform: string;
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
async function loadMetaConnection(): Promise<ConnectionLookup> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("social_account_connections")
      .select("id,platform,account_ref,is_publish_enabled,status,updated_at")
      .eq("platform", META_PLATFORM)
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
  const lookup = await loadMetaConnection();

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
    // Whether the current viewer may flip the owner-approval switch.
    can_manage: isOwner(profile),
  });
}

// ---------------------------------------------------------------------------
// POST — owner-only actions
//   { action: "set_publish_enabled", enabled: boolean }
//
// Writes social_account_connections.is_publish_enabled for the Meta row.
// NEVER publishes. The switch alone does not send anything.
// ---------------------------------------------------------------------------

const postSchema = z.object({
  action: z.literal("set_publish_enabled"),
  enabled: z.boolean(),
});

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
      { ok: false, error: "forbidden", message: "Owner-only action." },
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
  const { enabled } = parsed.data;

  // Service-role write so the owner-approval switch persists regardless of the
  // RLS write policy shape. The table may not exist yet (migration deferred);
  // a 42P01 here is an honest "not provisioned", NOT a 500.
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("social_account_connections")
      .upsert(
        {
          organization_id: profile.organization_id,
          platform: META_PLATFORM,
          is_publish_enabled: enabled,
        },
        { onConflict: "organization_id,platform" }
      )
      .select("id,platform,is_publish_enabled,updated_at")
      .single();

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          {
            ok: false,
            error: "not_provisioned",
            message:
              "social_account_connections table is not provisioned yet. Apply the Sprint 4 migration to enable this switch.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "internal_error", message: error.message },
        { status: 500 }
      );
    }

    // Audit the approval-switch change (audit_logs, not the deferred table).
    await recordAudit({
      actor: profile,
      action: enabled
        ? "social_publish_enabled"
        : "social_publish_disabled",
      target_type: "social_account_connections",
      target_id: data?.id ?? null,
      metadata: { platform: META_PLATFORM },
    });

    return NextResponse.json({
      ok: true,
      platform: META_PLATFORM,
      is_publish_enabled: data?.is_publish_enabled ?? enabled,
      updated_at: data?.updated_at ?? null,
      // Honesty: flipping the switch never sends. Surface that plainly.
      note: "Approval switch updated. Live publishing still requires full configuration and a future live-wiring release.",
    });
  } catch (err) {
    // getSupabaseServiceClient throws if the service key is missing — surface
    // that as an honest config error, not a fake success.
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message:
          err instanceof Error ? err.message : "Failed to update switch.",
      },
      { status: 500 }
    );
  }
}
