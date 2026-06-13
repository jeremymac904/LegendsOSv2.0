import { NextResponse } from "next/server";

import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legends Mortgage Academy personal state — Today entries, weekly Scorecard, and
// 12-week Progress. Persisted per user in Supabase (RLS: user_id = auth.uid()),
// so the academy follows the loan officer across devices, browsers, and sessions.

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const sb = getSupabaseServerClient();
  const [today, score, prog] = await Promise.all([
    sb.from("academy_today_entries").select("day_key,fields,saved_at").eq("user_id", profile.id),
    sb
      .from("academy_scorecard")
      .select("cells,reflection,submitted,submitted_at,reviewed,coach_note")
      .eq("user_id", profile.id)
      .maybeSingle(),
    sb.from("academy_progress").select("weeks_done,graduated").eq("user_id", profile.id).maybeSingle(),
  ]);

  const todayMap: Record<string, { fields: Record<string, string>; savedAt: string }> = {};
  for (const r of today.data ?? []) {
    todayMap[r.day_key as string] = {
      fields: (r.fields as Record<string, string>) ?? {},
      savedAt: r.saved_at as string,
    };
  }

  return NextResponse.json({
    ok: true,
    today: todayMap,
    scorecard: {
      cells: (score.data?.cells as Record<string, number[]>) ?? {},
      reflection: (score.data?.reflection as Record<string, string>) ?? {},
      submitted: Boolean(score.data?.submitted),
      submittedAt: (score.data?.submitted_at as string | null) ?? null,
      reviewed: Boolean(score.data?.reviewed),
      coachNote: (score.data?.coach_note as string | null) ?? null,
    },
    progress: {
      weeksDone: (prog.data?.weeks_done as number[]) ?? [],
      graduated: Boolean(prog.data?.graduated),
    },
  });
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { kind: "today"; dayKey: string; fields: Record<string, string>; scorecard?: { cells: Record<string, number[]>; reflection: Record<string, string> } }
    | { kind: "scorecard"; cells: Record<string, number[]>; reflection: Record<string, string>; submit?: boolean }
    | { kind: "progress"; weeksDone: number[]; graduated: boolean }
    | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const sb = getSupabaseServerClient();
  const now = new Date().toISOString();

  if (body.kind === "today") {
    const { error } = await sb
      .from("academy_today_entries")
      .upsert(
        { user_id: profile.id, day_key: body.dayKey, fields: body.fields, saved_at: now },
        { onConflict: "user_id,day_key" },
      );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    // Today numbers roll into the weekly scorecard — persist that too.
    if (body.scorecard) {
      await sb
        .from("academy_scorecard")
        .upsert(
          { user_id: profile.id, cells: body.scorecard.cells, reflection: body.scorecard.reflection, updated_at: now },
          { onConflict: "user_id" },
        );
    }
  } else if (body.kind === "scorecard") {
    // submit:true stamps the weekly submit-to-coach so it shows up in coach review.
    const row: Record<string, unknown> = {
      user_id: profile.id,
      cells: body.cells,
      reflection: body.reflection,
      updated_at: now,
    };
    if (body.submit) {
      row.submitted = true;
      row.submitted_at = now;
    }
    const { error } = await sb
      .from("academy_scorecard")
      .upsert(row, { onConflict: "user_id" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (body.kind === "progress") {
    const { error } = await sb
      .from("academy_progress")
      .upsert(
        { user_id: profile.id, weeks_done: body.weeksDone, graduated: body.graduated, updated_at: now },
        { onConflict: "user_id" },
      );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ ok: false, error: "unknown_kind" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
