import { NextResponse } from "next/server";
import { z } from "zod";

import { isMissingTableError } from "@/lib/browserCompanion/store";
import {
  loadAtlasRuntimeContext,
  publicRuntimeContext,
} from "@/lib/atlas/runtimeContext";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["save_memory", "save_skill", "promote_skill", "share_skill"]),
  thread_id: z.string().uuid().nullish(),
  assistant_id: z.string().uuid().nullish(),
  content: z.string().max(6000).optional().default(""),
});

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `atlas-skill-${Date.now()}`;
}

function titleFromContent(content: string, fallback: string): string {
  const first = content
    .split("\n")
    .map((line) => line.replace(/^(user|assistant|system):\s*/i, "").trim())
    .find(Boolean);
  return (first ?? fallback).slice(0, 90);
}

function agentTypeForRole(role: string): string {
  if (role === "owner" || role === "admin") return "owner_atlas";
  if (role === "processor") return "processor_flo";
  if (role === "coordinator") return "coordinator_agent";
  return "lo_atlas";
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { action, assistant_id, content } = parsed.data;
  const agentType = agentTypeForRole(profile.role);
  const title = titleFromContent(content, action === "save_memory" ? "Atlas memory" : "Atlas skill");

  try {
    if (action === "save_memory") {
      const { error } = await supabase.from("agent_memories").insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        agent_type: agentType,
        category: "assistant_note",
        title,
        body: content || title,
        confidence: "medium",
        priority: "medium",
        source_summary: "Saved from Atlas conversation context panel.",
      });
      if (error) throw error;
    } else {
      const shared = action === "promote_skill" || action === "share_skill";
      const skillName =
        action === "promote_skill"
          ? `Promoted: ${title}`
          : action === "share_skill"
          ? `Shared: ${title}`
          : title;
      const { error } = await supabase.from("agent_skills").insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        agent_type: agentType,
        skill_name: skillName,
        skill_slug: `${slugify(skillName)}-${Date.now()}`,
        description: content
          ? `Saved from Atlas conversation. ${content.slice(0, 240)}`
          : "Saved from Atlas conversation.",
        trigger_phrases: [title],
        steps: content
          ? content
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(0, 12)
          : [],
        source_examples: content ? [content.slice(0, 2000)] : [],
        confidence: "medium",
        created_by: profile.id,
        visibility: shared ? "team_shared" : "assigned_user",
        is_shared_with_team: shared,
        metadata: {
          source: "atlas_context_panel",
          action,
          assistant_id: assistant_id ?? null,
        },
      });
      if (error) throw error;
    }

    const runtimeContext = await loadAtlasRuntimeContext({
      client: supabase,
      profile,
      assistantId: assistant_id ?? null,
      provider: null,
      model: null,
    });

    const label =
      action === "save_memory"
        ? "Saved as memory."
        : action === "save_skill"
        ? "Saved as skill."
        : action === "promote_skill"
        ? "Promoted as a team skill."
        : "Shared as a team skill.";

    return NextResponse.json({
      ok: true,
      message: label,
      runtime_context: publicRuntimeContext(runtimeContext),
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      return NextResponse.json({
        ok: false,
        error: "setup_needed",
        message:
          "Agent memory and skill tables are not provisioned yet. Apply the agent_runtime migration first.",
      });
    }
    return NextResponse.json({
      ok: false,
      error: "runtime_action_failed",
      message: "Atlas could not save that runtime artifact.",
    });
  }
}
