/**
 * GET  /api/atlas/connectors   — list connector registry
 * POST /api/atlas/connectors   — register a new connector (owner only)
 */

import { NextRequest, NextResponse } from "next/server";

import { getN8nConfigState } from "@/lib/automation/n8n";
import { isN8nConfigured } from "@/lib/automation/n8n-bridge";
import { isZapierMcpConfigured } from "@/lib/automation/zapier-mcp";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Fallback hardcoded connectors — used when the atlas_connectors table
// doesn't exist yet (before migration 005 is applied). This ensures the UI
// renders correctly even before the migration runs.
// ---------------------------------------------------------------------------

function buildFallbackConnectors() {
  const n8nState = getN8nConfigState();
  const n8nActive = isN8nConfigured();
  const telegramActive = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const zapierActive = isZapierMcpConfigured();

  return [
    {
      id: "hardcoded-n8n",
      name: "n8n",
      display_name: "n8n Automation",
      description:
        "Workflow automation bridge. Triggers n8n workflows from Atlas.",
      tier: "owner_global",
      status: n8nActive ? "active" : n8nState.base_url_present ? "inactive" : "inactive",
      provider: "n8n",
      metadata: { icon: "zap", color: "#EA4B71" },
      last_ping_at: null,
    },
    {
      id: "hardcoded-zapier",
      name: "zapier_mcp",
      display_name: "Zapier MCP",
      description:
        "Zapier MCP connector. Coming soon — connect 7,000+ apps.",
      tier: "owner_global",
      status: zapierActive ? "active" : "coming_soon",
      provider: "zapier_mcp",
      metadata: { icon: "lightning", color: "#FF4A00" },
      last_ping_at: null,
    },
    {
      id: "hardcoded-telegram",
      name: "telegram",
      display_name: "Telegram",
      description:
        "Hermes Telegram gateway. Real-time notifications + commands.",
      tier: "owner_global",
      status: telegramActive ? "active" : "inactive",
      provider: "telegram",
      metadata: { icon: "send", color: "#229ED9" },
      last_ping_at: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// GET — list connectors
// ---------------------------------------------------------------------------

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  // Try DB first; fall back to hardcoded list if table doesn't exist yet.
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("atlas_connectors")
      .select("id,name,display_name,description,tier,status,provider,metadata,last_ping_at")
      .order("tier")
      .order("name");

    if (error && error.code === "42P01") {
      // Table not found — migration 005 not applied yet.
      return NextResponse.json({ ok: true, connectors: buildFallbackConnectors(), source: "fallback" });
    }

    if (error) {
      // Some other DB error — fall back rather than 500.
      return NextResponse.json({ ok: true, connectors: buildFallbackConnectors(), source: "fallback" });
    }

    // Overlay live env status on top of the DB records
    const n8nActive = isN8nConfigured();
    const telegramActive = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    const zapierActive = isZapierMcpConfigured();

    const enriched = (data ?? []).map((c) => {
      let liveStatus = c.status;
      if (c.provider === "n8n" && n8nActive) liveStatus = "active";
      if (c.provider === "telegram" && telegramActive) liveStatus = "active";
      if (c.provider === "zapier_mcp" && zapierActive) liveStatus = "active";
      return { ...c, status: liveStatus };
    });

    return NextResponse.json({
      ok: true,
      connectors: enriched.length > 0 ? enriched : buildFallbackConnectors(),
      source: enriched.length > 0 ? "db" : "fallback",
    });
  } catch {
    return NextResponse.json({ ok: true, connectors: buildFallbackConnectors(), source: "fallback" });
  }
}

// ---------------------------------------------------------------------------
// POST — register a new connector (owner/admin only)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  if (!["owner", "admin"].includes(profile.role ?? "")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    display_name?: string;
    description?: string;
    provider?: string;
    tier?: string;
    config_json?: Record<string, unknown>;
  } | null;

  if (!body?.name || !body?.provider) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", message: "name and provider are required." },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("atlas_connectors")
      .insert({
        organization_id: profile.organization_id,
        owner_id: profile.id,
        name: body.name,
        display_name: body.display_name ?? body.name,
        description: body.description ?? null,
        provider: body.provider,
        tier: body.tier ?? "owner_global",
        status: "inactive",
        config_json: body.config_json ?? {},
      })
      .select("id,name,display_name,status")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: "insert_failed", message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, connector: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
