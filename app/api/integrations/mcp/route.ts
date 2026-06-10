import { NextResponse } from "next/server";
import { z } from "zod";

import { encryptSecret } from "@/lib/integrations/oauth";
import { getCurrentProfile, getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MCP_TABLE = "mcp_connections";

const createSchema = z.object({
  label: z.string().min(1).max(128),
  url: z.string().url().max(1024),
  auth_token: z.string().max(4096).optional(),
  provider: z.enum(["zapier", "composio", "custom"]).default("zapier"),
});

// GET /api/integrations/mcp — list the current user's MCP connections
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from(MCP_TABLE)
    .select("id,label,url,provider,saved_at")
    .eq("user_id", profile.id)
    .order("saved_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    connections: data ?? [],
  });
}

// POST /api/integrations/mcp — create a new MCP connection
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const { label, url, auth_token, provider } = parsed.data;
  const encryptedAuthToken = auth_token ? encryptSecret(auth_token) : null;

  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from(MCP_TABLE)
    .insert({
      user_id: profile.id,
      organization_id: profile.organization_id,
      label,
      url,
      auth_token: encryptedAuthToken,
      provider,
    })
    .select("id,label,url,provider,saved_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", message: error.message },
      { status: 500 }
    );
  }

  await recordAudit({
    actor: profile,
    action: "mcp_connection_created",
    target_type: "mcp_connections",
    target_id: data.id,
    metadata: { label, provider },
  });

  return NextResponse.json({ ok: true, connection: data });
}

// DELETE /api/integrations/mcp?id=<id> — remove an MCP connection
export async function DELETE(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { error } = await service
    .from(MCP_TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "db_error", message: error.message },
      { status: 500 }
    );
  }

  await recordAudit({
    actor: profile,
    action: "mcp_connection_deleted",
    target_type: "mcp_connections",
    target_id: id,
  });

  return NextResponse.json({ ok: true });
}
