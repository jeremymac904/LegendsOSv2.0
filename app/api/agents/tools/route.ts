import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { agentCanUseTool, draftEmail, draftSocialPost, getToolsForAgent } from "@/lib/agents/tools";
import { AGENT_TYPES } from "@/lib/agents/types";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agents/tools?agent_type=  -> the permitted tool catalog
export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const agentType = req.nextUrl.searchParams.get("agent_type");
  if (!agentType || !(AGENT_TYPES as readonly string[]).includes(agentType)) {
    return NextResponse.json({ ok: false, error: "bad_request", message: "Valid agent_type required." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, tools: getToolsForAgent(agentType as (typeof AGENT_TYPES)[number]) });
}

// POST /api/agents/tools  -> explicitly run a DRAFT tool (never sends/publishes)
const execSchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("draft_social_post"),
    agent_type: z.enum(AGENT_TYPES),
    session_id: z.string().uuid().nullish(),
    body: z.string().min(1).max(5000),
    title: z.string().max(120).optional(),
    channels: z.array(z.string().max(40)).max(8).optional(),
  }),
  z.object({
    tool: z.literal("draft_email"),
    agent_type: z.enum(AGENT_TYPES),
    session_id: z.string().uuid().nullish(),
    subject: z.string().min(1).max(300),
    body_text: z.string().max(20000).optional(),
  }),
]);

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const parsed = execSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  const data = parsed.data;

  if (!agentCanUseTool(data.agent_type, data.tool)) {
    return NextResponse.json({ ok: false, error: "forbidden", message: `The ${data.agent_type} agent can't use ${data.tool}.` }, { status: 403 });
  }

  const client = getSupabaseServerClient();
  if (data.tool === "draft_social_post") {
    const r = await draftSocialPost(client, profile, data.session_id ?? null, data.agent_type, { body: data.body, title: data.title, channels: data.channels });
    if (!r.ok && r.degraded) return NextResponse.json({ ok: false, table_missing: true, error: "migration_not_applied" }, { status: 503 });
    return NextResponse.json({ ok: r.ok, draft_id: r.id, kind: "social_post" });
  }
  const r = await draftEmail(client, profile, data.session_id ?? null, data.agent_type, { subject: data.subject, bodyText: data.body_text });
  if (!r.ok && r.degraded) return NextResponse.json({ ok: false, table_missing: true, error: "migration_not_applied" }, { status: 503 });
  return NextResponse.json({ ok: r.ok, draft_id: r.id, kind: "email_campaign" });
}
