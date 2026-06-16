import { NextResponse } from "next/server";

import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only team activity dashboard data. Aggregates the org's coaching signals
// — feed wins/activity, Today saves, scorecard submissions, Academy progress —
// into a who's-active / who-needs-follow-up view. Private per-user rows are read
// via the owner-select RLS policies; results are filtered to the owner's org so
// nothing leaks across orgs, and normal LOs never reach this route (403).

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const COACHING_ROLES = [
  "loan_officer",
  "processor",
  "coordinator",
  "marketing",
  "admin",
  "owner",
];

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  if (!isOwner(profile) || !profile.organization_id) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const sb = getSupabaseServerClient();
  const org = profile.organization_id;

  const [membersRes, todayRes, scoreRes, progRes, feedRes] = await Promise.all([
    sb
      .from("profiles")
      .select("id,full_name,email,role,is_active")
      .eq("organization_id", org),
    sb.from("academy_today_entries").select("user_id,saved_at"),
    sb.from("academy_scorecard").select("user_id,submitted,submitted_at"),
    sb.from("academy_progress").select("user_id,weeks_done,graduated"),
    sb
      .from("academy_feed_posts")
      .select("id,author_id,author_name,category,title,body,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const members = (membersRes.data ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    is_active: boolean;
  }[];
  const ids = new Set(members.map((m) => m.id));
  const now = Date.now();

  const lastToday = new Map<string, string>();
  for (const t of (todayRes.data ?? []) as { user_id: string; saved_at: string }[]) {
    if (!ids.has(t.user_id)) continue;
    const cur = lastToday.get(t.user_id);
    if (!cur || t.saved_at > cur) lastToday.set(t.user_id, t.saved_at);
  }
  const scByUser = new Map<string, { submitted: boolean; submitted_at: string | null }>();
  for (const s of (scoreRes.data ?? []) as {
    user_id: string;
    submitted: boolean;
    submitted_at: string | null;
  }[]) {
    if (ids.has(s.user_id)) scByUser.set(s.user_id, s);
  }
  const prByUser = new Map<string, { weeks_done: number[]; graduated: boolean }>();
  for (const p of (progRes.data ?? []) as {
    user_id: string;
    weeks_done: number[] | null;
    graduated: boolean;
  }[]) {
    if (ids.has(p.user_id)) prByUser.set(p.user_id, { weeks_done: p.weeks_done ?? [], graduated: p.graduated });
  }
  const lastFeed = new Map<string, string>();
  const feed = (feedRes.data ?? []) as {
    id: string;
    author_id: string | null;
    author_name: string;
    category: string;
    title: string;
    body: string;
    created_at: string;
  }[];
  for (const f of feed) {
    if (!f.author_id || !ids.has(f.author_id)) continue;
    const cur = lastFeed.get(f.author_id);
    if (!cur || f.created_at > cur) lastFeed.set(f.author_id, f.created_at);
  }

  const memberRows = members
    .filter((m) => COACHING_ROLES.includes(String(m.role)))
    .map((m) => {
      const lt = lastToday.get(m.id) ?? null;
      const lf = lastFeed.get(m.id) ?? null;
      const lastActiveAt = [lt, lf].filter(Boolean).sort().pop() ?? null;
      const active = lastActiveAt ? now - new Date(lastActiveAt).getTime() < WEEK_MS : false;
      const sc = scByUser.get(m.id);
      const submittedRecently = Boolean(
        sc?.submitted && sc.submitted_at && now - new Date(sc.submitted_at).getTime() < WEEK_MS,
      );
      const pr = prByUser.get(m.id);
      return {
        id: m.id,
        name: m.full_name || m.email || "Member",
        role: m.role,
        lastActiveAt,
        active,
        scorecardSubmitted: Boolean(sc?.submitted),
        submittedRecently,
        weeksDone: pr?.weeks_done.length ?? 0,
        graduated: Boolean(pr?.graduated),
        needsFollowUp: !active || !submittedRecently,
      };
    })
    .sort((a, b) => Number(b.needsFollowUp) - Number(a.needsFollowUp));

  const teamWins = feed
    .filter((f) => f.category === "Wins")
    .slice(0, 8)
    .map((f) => ({ author: f.author_name, title: f.title, body: f.body, createdAt: f.created_at }));

  const recentActivity = feed
    .slice(0, 12)
    .map((f) => ({
      author: f.author_name,
      category: f.category,
      title: f.title,
      createdAt: f.created_at,
    }));

  return NextResponse.json({
    ok: true,
    summary: {
      total: memberRows.length,
      active: memberRows.filter((m) => m.active).length,
      needsFollowUp: memberRows.filter((m) => m.needsFollowUp).length,
      graduated: memberRows.filter((m) => m.graduated).length,
    },
    members: memberRows,
    teamWins,
    recentActivity,
  });
}
