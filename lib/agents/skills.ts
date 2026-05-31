// LegendsOS v2 — Per-user, per-agent skills (reusable workflows)
// ---------------------------------------------------------------------------
// A skill is a saved, reusable workflow with trigger phrases, steps and an
// output format. Skills are private to their owner unless promoted to the team.
// All reads degrade to [] when the table is missing.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingDatabaseObjectError } from "@/lib/supabase/server";

import type { AgentSkill, AgentType, SkillSuggestion } from "./types";

type AnyClient = SupabaseClient<any, any, any>;

// Explicit "teach me / save this" triggers. Order matters: longest/most
// specific first so the matched phrase is reported usefully.
const SKILL_TRIGGERS = [
  "make this a skill",
  "save this as a skill",
  "build a workflow for this",
  "use this from now on",
  "do it this way next time",
  "this is how i want it done",
  "remember this",
  "save this",
];

export function detectSkillTrigger(message: string): SkillSuggestion | null {
  const lower = message.toLowerCase();
  const matched = SKILL_TRIGGERS.find((t) => lower.includes(t)) ?? null;
  if (!matched) return null;
  const name = proposeSkillName(message);
  return {
    explicit: true,
    matchedPhrase: matched,
    proposedName: name,
    proposedSlug: slugify(name),
  };
}

function proposeSkillName(message: string): string {
  // Strip the trigger and punctuation; take the first meaningful clause.
  let text = message;
  for (const t of SKILL_TRIGGERS) {
    text = text.replace(new RegExp(t, "ig"), "");
  }
  text = text.replace(/[`*_#>]/g, " ").replace(/\s+/g, " ").trim();
  const firstClause = text.split(/[.\n!?:]/)[0]?.trim() ?? "";
  const base = firstClause || text;
  const words = base.split(" ").filter(Boolean).slice(0, 8).join(" ");
  return (words || "New skill").slice(0, 80);
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "skill"
  );
}

export interface LoadedSkills {
  skills: AgentSkill[];
  degraded: boolean;
}

/** Load the user's own active skills for an agent + any team-shared ones. */
export async function loadAgentSkills(
  client: AnyClient,
  userId: string,
  agentType: AgentType,
  limit = 40
): Promise<LoadedSkills> {
  try {
    // RLS already returns own + team-shared rows; scope to this agent type.
    const { data, error } = await client
      .from("agent_skills")
      .select("*")
      .eq("agent_type", agentType)
      .eq("is_active", true)
      .order("usage_count", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingDatabaseObjectError(error)) return { skills: [], degraded: true };
      return { skills: [], degraded: false };
    }
    return { skills: (data ?? []) as AgentSkill[], degraded: false };
  } catch {
    return { skills: [], degraded: true };
  }
}

/** Pick the skills most relevant to a message (keyword + trigger match). */
export function selectRelevantSkills(
  skills: AgentSkill[],
  message: string,
  max = 4
): AgentSkill[] {
  const lower = message.toLowerCase();
  const scored = skills.map((s) => {
    let score = 0;
    for (const phrase of s.trigger_phrases ?? []) {
      if (phrase && lower.includes(phrase.toLowerCase())) score += 5;
    }
    for (const word of s.skill_name.toLowerCase().split(/\s+/)) {
      if (word.length > 3 && lower.includes(word)) score += 2;
    }
    if (s.description && lower.includes(s.description.toLowerCase().slice(0, 20))) {
      score += 1;
    }
    return { skill: s, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.skill);
}

export interface SkillDraftInput {
  userId: string;
  organizationId: string | null;
  agentType: AgentType;
  skillName: string;
  description?: string;
  triggerPhrases?: string[];
  steps?: string[];
  outputFormat?: string | null;
  sourceExamples?: string[];
}

export async function createSkill(
  client: AnyClient,
  input: SkillDraftInput
): Promise<{ ok: boolean; skill: AgentSkill | null; degraded: boolean; error?: string }> {
  const slug = slugify(input.skillName);
  const row = {
    user_id: input.userId,
    organization_id: input.organizationId,
    agent_type: input.agentType,
    skill_name: input.skillName.slice(0, 120),
    skill_slug: slug,
    description: input.description ?? null,
    trigger_phrases: input.triggerPhrases ?? [],
    steps: input.steps ?? [],
    output_format: input.outputFormat ?? null,
    source_examples: input.sourceExamples ?? [],
    created_by: input.userId,
    is_active: true,
  };
  try {
    const { data, error } = await client
      .from("agent_skills")
      .upsert(row, { onConflict: "user_id,agent_type,skill_slug" })
      .select("*")
      .maybeSingle();
    if (error) {
      if (isMissingDatabaseObjectError(error)) {
        return { ok: false, skill: null, degraded: true };
      }
      return { ok: false, skill: null, degraded: false, error: error.message };
    }
    const skill = (data as AgentSkill) ?? null;
    if (skill) await snapshotVersion(client, skill, input.userId, "Created");
    return { ok: true, skill, degraded: false };
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      return { ok: false, skill: null, degraded: true };
    }
    return {
      ok: false,
      skill: null,
      degraded: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}

/** Record a skill use (increments usage_count, logs usage, updates last_used). */
export async function recordSkillUse(
  client: AnyClient,
  args: {
    skillId: string;
    userId: string;
    sessionId?: string | null;
    agentType: AgentType;
    outcome?: "used" | "succeeded" | "failed" | "dismissed";
  }
): Promise<boolean> {
  try {
    await client.from("agent_skill_usage").insert({
      skill_id: args.skillId,
      user_id: args.userId,
      session_id: args.sessionId ?? null,
      agent_type: args.agentType,
      outcome: args.outcome ?? "used",
    });
    // Best-effort counter bump (read-then-write; fine for low volume).
    const { data } = await client
      .from("agent_skills")
      .select("usage_count")
      .eq("id", args.skillId)
      .maybeSingle();
    const next = ((data?.usage_count as number | undefined) ?? 0) + 1;
    await client
      .from("agent_skills")
      .update({ usage_count: next, last_used_at: new Date().toISOString() })
      .eq("id", args.skillId);
    return true;
  } catch {
    return false;
  }
}

export async function promoteSkillToTeam(
  client: AnyClient,
  skillId: string
): Promise<boolean> {
  try {
    const { error } = await client
      .from("agent_skills")
      .update({ is_shared_with_team: true, visibility: "team_shared" })
      .eq("id", skillId);
    return !error;
  } catch {
    return false;
  }
}

export async function setSkillActive(
  client: AnyClient,
  skillId: string,
  active: boolean
): Promise<boolean> {
  try {
    const { error } = await client
      .from("agent_skills")
      .update({ is_active: active })
      .eq("id", skillId);
    return !error;
  } catch {
    return false;
  }
}

async function snapshotVersion(
  client: AnyClient,
  skill: AgentSkill,
  userId: string,
  changeSummary: string
): Promise<void> {
  try {
    const { count } = await client
      .from("agent_skill_versions")
      .select("*", { head: true, count: "exact" })
      .eq("skill_id", skill.id);
    await client.from("agent_skill_versions").insert({
      skill_id: skill.id,
      version: (count ?? 0) + 1,
      snapshot: skill as unknown as Record<string, unknown>,
      change_summary: changeSummary,
      created_by: userId,
    });
  } catch {
    // best-effort
  }
}

/** Render relevant skills into a compact markdown block for the system prompt. */
export function renderSkillsBlock(skills: AgentSkill[]): string {
  if (skills.length === 0) return "";
  const lines = skills.slice(0, 4).map((s) => {
    const steps =
      s.steps && s.steps.length
        ? ` Steps: ${s.steps.slice(0, 8).join(" → ")}`
        : "";
    const fmt = s.output_format ? ` Output: ${s.output_format}.` : "";
    return `- ${s.skill_name}: ${s.description ?? ""}.${fmt}${steps}`;
  });
  return [
    "## Relevant saved skills (reusable workflows — follow these when they apply)",
    ...lines,
  ].join("\n");
}
