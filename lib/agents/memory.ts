// LegendsOS v2 — Per-user, per-agent memory
// ---------------------------------------------------------------------------
// Private memory scoped by (user_id, agent_type). Atlas-for-Scott is not
// Atlas-for-Eric. Every read degrades to [] when the table is missing so the
// agent still answers (statelessly) before the migration is applied.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingDatabaseObjectError } from "@/lib/supabase/server";

import type {
  AgentMemory,
  AgentType,
  Confidence,
  MemoryCategory,
  Priority,
} from "./types";

// The runtime tables aren't in the generated DB types yet (dormant until the
// migration is applied), so we read/write through a loosely-typed client.
type AnyClient = SupabaseClient<any, any, any>;

export interface MemoryWriteInput {
  userId: string;
  organizationId: string | null;
  agentType: AgentType;
  category: MemoryCategory;
  title: string;
  body?: string;
  tags?: string[];
  confidence?: Confidence;
  priority?: Priority;
  sourceSummary?: string | null;
}

export interface LoadedMemory {
  memories: AgentMemory[];
  degraded: boolean;
}

/** Load active private memory for (user, agent), highest priority first. */
export async function loadAgentMemory(
  client: AnyClient,
  userId: string,
  agentType: AgentType,
  limit = 40
): Promise<LoadedMemory> {
  try {
    const { data, error } = await client
      .from("agent_memories")
      .select("*")
      .eq("user_id", userId)
      .eq("agent_type", agentType)
      .eq("is_active", true)
      .order("priority", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingDatabaseObjectError(error)) return { memories: [], degraded: true };
      return { memories: [], degraded: false };
    }
    return { memories: (data ?? []) as AgentMemory[], degraded: false };
  } catch {
    return { memories: [], degraded: true };
  }
}

/**
 * Write (or update) a memory and append an audit event. Upserts on
 * (user_id, agent_type, lower(title)) semantics via a manual match so the same
 * preference isn't duplicated. Always best-effort: a failure never throws to
 * the caller (the chat must not break because memory couldn't persist).
 */
export async function writeAgentMemory(
  client: AnyClient,
  input: MemoryWriteInput
): Promise<{ ok: boolean; memory: AgentMemory | null; degraded: boolean }> {
  const row = {
    user_id: input.userId,
    organization_id: input.organizationId,
    agent_type: input.agentType,
    category: input.category,
    title: input.title.slice(0, 200),
    body: (input.body ?? "").slice(0, 4000),
    tags: input.tags ?? [],
    confidence: input.confidence ?? "medium",
    priority: input.priority ?? "medium",
    source_summary: input.sourceSummary ?? null,
    is_active: true,
  };
  try {
    // Find an existing memory with the same title to update instead of dup.
    const { data: existing } = await client
      .from("agent_memories")
      .select("id")
      .eq("user_id", input.userId)
      .eq("agent_type", input.agentType)
      .ilike("title", input.title.slice(0, 200))
      .limit(1)
      .maybeSingle();

    let memory: AgentMemory | null = null;
    if (existing?.id) {
      const { data, error } = await client
        .from("agent_memories")
        .update(row)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      memory = (data as AgentMemory) ?? null;
      await appendMemoryEvent(client, {
        memoryId: memory?.id ?? null,
        userId: input.userId,
        agentType: input.agentType,
        eventType: "memory_update",
        summary: `Updated ${input.category}: ${input.title}`,
        confidence: row.confidence,
      });
    } else {
      const { data, error } = await client
        .from("agent_memories")
        .insert(row)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      memory = (data as AgentMemory) ?? null;
      await appendMemoryEvent(client, {
        memoryId: memory?.id ?? null,
        userId: input.userId,
        agentType: input.agentType,
        eventType: "memory_write",
        summary: `Saved ${input.category}: ${input.title}`,
        confidence: row.confidence,
      });
    }
    return { ok: true, memory, degraded: false };
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      return { ok: false, memory: null, degraded: true };
    }
    console.error("writeAgentMemory failed", error);
    return { ok: false, memory: null, degraded: false };
  }
}

export async function deactivateAgentMemory(
  client: AnyClient,
  userId: string,
  memoryId: string
): Promise<boolean> {
  try {
    const { error } = await client
      .from("agent_memories")
      .update({ is_active: false })
      .eq("id", memoryId)
      .eq("user_id", userId);
    if (error) throw error;
    await appendMemoryEvent(client, {
      memoryId,
      userId,
      agentType: "owner_atlas",
      eventType: "memory_deactivate",
      summary: "Memory deactivated by user",
      confidence: "high",
    });
    return true;
  } catch {
    return false;
  }
}

async function appendMemoryEvent(
  client: AnyClient,
  args: {
    memoryId: string | null;
    userId: string;
    agentType: AgentType;
    eventType:
      | "memory_write"
      | "memory_update"
      | "memory_correction"
      | "memory_deactivate"
      | "preference_set"
      | "rule_added";
    summary: string;
    confidence: Confidence;
  }
): Promise<void> {
  try {
    await client.from("agent_memory_events").insert({
      memory_id: args.memoryId,
      user_id: args.userId,
      agent_type: args.agentType,
      event_type: args.eventType,
      event_summary: args.summary.slice(0, 500),
      confidence: args.confidence,
    });
  } catch {
    // best-effort audit; never throw
  }
}

/** Render memory into a compact markdown block for the system prompt. */
export function renderMemoryBlock(memories: AgentMemory[]): string {
  if (memories.length === 0) return "";
  const lines = memories.slice(0, 25).map((m) => {
    const body = m.body ? ` — ${m.body}` : "";
    return `- [${m.category}] ${m.title}${body}`;
  });
  return ["## What you remember about this user (private)", ...lines].join("\n");
}
