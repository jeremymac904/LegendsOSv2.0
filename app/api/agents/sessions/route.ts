import { NextRequest, NextResponse } from "next/server";

import { isMissingDatabaseObjectError, getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agents/sessions?agent_type=&session_id=
// - with session_id: returns that session + its messages
// - without: returns the user's recent sessions (RLS-scoped; owner sees all)
export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const client = getSupabaseServerClient();
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const agentType = req.nextUrl.searchParams.get("agent_type");

  try {
    if (sessionId) {
      const [{ data: session }, { data: messages }] = await Promise.all([
        client.from("agent_sessions").select("*").eq("id", sessionId).maybeSingle(),
        client.from("agent_messages").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }).limit(200),
      ]);
      return NextResponse.json({ ok: true, session: session ?? null, messages: messages ?? [] });
    }
    let q = client.from("agent_sessions").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(50);
    if (agentType) q = q.eq("agent_type", agentType);
    const { data, error } = await q;
    if (error && isMissingDatabaseObjectError(error)) {
      return NextResponse.json({ ok: true, sessions: [], table_missing: true });
    }
    return NextResponse.json({ ok: true, sessions: data ?? [] });
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) return NextResponse.json({ ok: true, sessions: [], table_missing: true });
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }
}

// PATCH /api/agents/sessions  { action: "archive", id }
export async function PATCH(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { action?: string; id?: string } | null;
  if (!body?.id || body.action !== "archive") return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const client = getSupabaseServerClient();
  try {
    const { error } = await client.from("agent_sessions").update({ status: "archived" }).eq("id", body.id);
    return NextResponse.json({ ok: !error });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
