import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deactivateAgentMemory, loadAgentMemory, writeAgentMemory } from "@/lib/agents/memory";
import { AGENT_TYPES, MEMORY_CATEGORIES } from "@/lib/agents/types";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  agent_type: z.enum(AGENT_TYPES),
  category: z.enum(MEMORY_CATEGORIES),
  title: z.string().min(1).max(200),
  body: z.string().max(4000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  priority: z.enum(["highest", "high", "medium", "low", "lowest"]).optional(),
});

const patchSchema = z.object({ action: z.literal("deactivate"), id: z.string().uuid() });

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const agentType = req.nextUrl.searchParams.get("agent_type");
  const client = getSupabaseServerClient();
  const at = agentType && (AGENT_TYPES as readonly string[]).includes(agentType) ? (agentType as (typeof AGENT_TYPES)[number]) : "lo_atlas";
  const { memories, degraded } = await loadAgentMemory(client, profile.id, at, 200);
  return NextResponse.json({ ok: true, memories, degraded, table_missing: degraded });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const client = getSupabaseServerClient();
  const r = await writeAgentMemory(client, {
    userId: profile.id,
    organizationId: profile.organization_id,
    agentType: parsed.data.agent_type,
    category: parsed.data.category,
    title: parsed.data.title,
    body: parsed.data.body,
    tags: parsed.data.tags,
    confidence: parsed.data.confidence,
    priority: parsed.data.priority,
  });
  if (!r.ok && r.degraded) {
    return NextResponse.json({ ok: false, table_missing: true, error: "migration_not_applied", message: "Agent memory tables not applied yet." }, { status: 503 });
  }
  if (!r.ok) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, memory: r.memory });
}

export async function PATCH(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const client = getSupabaseServerClient();
  const ok = await deactivateAgentMemory(client, profile.id, parsed.data.id);
  return NextResponse.json({ ok });
}
