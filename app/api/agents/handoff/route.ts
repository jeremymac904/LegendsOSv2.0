import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createHandoff, listPendingHandoffs, updateHandoffStatus } from "@/lib/agents/handoffs";
import { AGENT_TYPES } from "@/lib/agents/types";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  from_agent_type: z.enum(AGENT_TYPES),
  to_agent_type: z.enum(AGENT_TYPES),
  to_user_id: z.string().uuid().nullish(),
  from_session_id: z.string().uuid().nullish(),
  reason: z.string().max(500).optional(),
  context_summary: z.string().max(2000).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["accepted", "declined", "completed"]),
});

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const client = getSupabaseServerClient();
  const handoffs = await listPendingHandoffs(client, profile.id);
  return NextResponse.json({ ok: true, handoffs });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  const client = getSupabaseServerClient();
  const r = await createHandoff(client, {
    fromUserId: profile.id,
    fromAgentType: parsed.data.from_agent_type,
    toAgentType: parsed.data.to_agent_type,
    toUserId: parsed.data.to_user_id ?? null,
    fromSessionId: parsed.data.from_session_id ?? null,
    reason: parsed.data.reason,
    contextSummary: parsed.data.context_summary,
  });
  if (!r.ok && r.degraded) return NextResponse.json({ ok: false, table_missing: true, error: "migration_not_applied" }, { status: 503 });
  if (!r.ok) return NextResponse.json({ ok: false, error: "handoff_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, handoff: r.handoff });
}

export async function PATCH(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const client = getSupabaseServerClient();
  const ok = await updateHandoffStatus(client, parsed.data.id, parsed.data.status);
  return NextResponse.json({ ok });
}
