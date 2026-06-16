import { NextResponse } from "next/server";

import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Personal Execution Tracker rows, persisted per user in Supabase (RLS:
// user_id = auth.uid()), so trackers follow the LO across devices. The client
// keeps a localStorage mirror as offline fallback.

type Row = Record<string, string>;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const sb = getSupabaseServerClient();
  const { data, error } = await sb
    .from("academy_trackers")
    .select("tracker_key,rows")
    .eq("user_id", profile.id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const trackers: Record<string, Row[]> = {};
  for (const r of data ?? []) {
    trackers[r.tracker_key as string] = (r.rows as Row[]) ?? [];
  }
  return NextResponse.json({ ok: true, trackers });
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { trackerKey?: string; rows?: Row[] }
    | null;
  if (!body?.trackerKey || !Array.isArray(body.rows)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const sb = getSupabaseServerClient();
  const { error } = await sb.from("academy_trackers").upsert(
    {
      user_id: profile.id,
      tracker_key: body.trackerKey,
      rows: body.rows,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tracker_key" },
  );
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
