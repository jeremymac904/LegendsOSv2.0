import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createSkill,
  loadAgentSkills,
  promoteSkillToTeam,
  recordSkillUse,
  setSkillActive,
} from "@/lib/agents/skills";
import { AGENT_TYPES } from "@/lib/agents/types";
import { isAdminOrOwner } from "@/lib/permissions";
import { recordAudit } from "@/lib/usage";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  agent_type: z.enum(AGENT_TYPES),
  skill_name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  trigger_phrases: z.array(z.string().max(120)).max(20).optional(),
  steps: z.array(z.string().max(500)).max(30).optional(),
  output_format: z.string().max(500).nullish(),
  source_examples: z.array(z.string().max(2000)).max(10).optional(),
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("promote"), id: z.string().uuid() }),
  z.object({ action: z.literal("deactivate"), id: z.string().uuid() }),
  z.object({ action: z.literal("activate"), id: z.string().uuid() }),
  z.object({ action: z.literal("use"), id: z.string().uuid(), agent_type: z.enum(AGENT_TYPES), session_id: z.string().uuid().nullish() }),
]);

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const agentType = req.nextUrl.searchParams.get("agent_type");
  const client = getSupabaseServerClient();
  const at = agentType && (AGENT_TYPES as readonly string[]).includes(agentType) ? (agentType as (typeof AGENT_TYPES)[number]) : "lo_atlas";
  const { skills, degraded } = await loadAgentSkills(client, profile.id, at, 200);
  return NextResponse.json({ ok: true, skills, degraded, table_missing: degraded });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const client = getSupabaseServerClient();
  const r = await createSkill(client, {
    userId: profile.id,
    organizationId: profile.organization_id,
    agentType: parsed.data.agent_type,
    skillName: parsed.data.skill_name,
    description: parsed.data.description,
    triggerPhrases: parsed.data.trigger_phrases,
    steps: parsed.data.steps,
    outputFormat: parsed.data.output_format ?? null,
    sourceExamples: parsed.data.source_examples,
  });
  if (!r.ok && r.degraded) {
    return NextResponse.json({ ok: false, table_missing: true, error: "migration_not_applied", message: "Agent skill tables not applied yet." }, { status: 503 });
  }
  if (!r.ok) return NextResponse.json({ ok: false, error: "save_failed", message: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, skill: r.skill });
}

export async function PATCH(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const client = getSupabaseServerClient();
  const data = parsed.data;

  if (data.action === "promote") {
    // Promoting to team-shared is an owner/admin action.
    if (!isAdminOrOwner(profile)) {
      return NextResponse.json({ ok: false, error: "forbidden", message: "Only an owner/admin can promote a skill to the team." }, { status: 403 });
    }
    const ok = await promoteSkillToTeam(client, data.id);
    if (ok) await recordAudit({ actor: profile, action: "agent.skill_promote", target_type: "agent_skill", target_id: data.id });
    return NextResponse.json({ ok });
  }
  if (data.action === "deactivate" || data.action === "activate") {
    const ok = await setSkillActive(client, data.id, data.action === "activate");
    return NextResponse.json({ ok });
  }
  // use
  const ok = await recordSkillUse(client, { skillId: data.id, userId: profile.id, agentType: data.agent_type, sessionId: data.session_id ?? null });
  return NextResponse.json({ ok });
}
