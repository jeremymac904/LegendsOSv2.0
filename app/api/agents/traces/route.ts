import { NextRequest, NextResponse } from "next/server";

import { isMissingDatabaseObjectError, getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agents/traces?session_id=&limit=  (RLS-scoped: own traces; owner sees all)
export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const client = getSupabaseServerClient();
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  try {
    let q = client.from("agent_traces").select("*").order("created_at", { ascending: false }).limit(limit);
    if (sessionId) q = q.eq("session_id", sessionId);
    const { data, error } = await q;
    if (error && isMissingDatabaseObjectError(error)) {
      return NextResponse.json({ ok: true, traces: [], table_missing: true });
    }
    return NextResponse.json({ ok: true, traces: data ?? [] });
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) return NextResponse.json({ ok: true, traces: [], table_missing: true });
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 500 });
  }
}
