// LegendsOS v2 — Agent runtime session logger (best-effort mirror)
// ---------------------------------------------------------------------------
// The /api/ai/chat route persists the canonical transcript into
// chat_threads / chat_messages. This module ADDITIVELY mirrors each Atlas turn
// into the role-based agent runtime tables (public.agent_sessions /
// public.agent_messages) so the runtime has real sessions + transcripts to
// power memory, traces and handoffs.
//
// HARD CONTRACT: every export is wrapped so a logging failure returns null and
// NEVER throws to the caller. A persistence problem (RLS, unapplied migration,
// transient error) must never break the chat response or change its shape.
//
// SAFETY: no secrets, OAuth tokens, passwords or raw borrower PII are written
// here. Extra detail (loaded memory/skill counts, tool calls, source-context
// summary, model) lands in the row's `metadata` jsonb — summaries only.
//
// Schema mirrored from supabase/migrations/20260601100000_agent_runtime.sql:
//   agent_sessions(user_id NOT NULL, agent_type NOT NULL, organization_id,
//     title, status default 'active', loan_id, origin default 'web',
//     last_message_at, metadata default '{}')
//   agent_messages(session_id NOT NULL, agent_type NOT NULL, role NOT NULL,
//     user_id, content default '', provider, model, token_count, metadata)
// ---------------------------------------------------------------------------

import { getSupabaseServiceClient } from "@/lib/supabase/server";

import type { AgentType } from "./types";

interface EnsureSessionArgs {
  userId: string;
  organizationId: string | null;
  agentType: AgentType;
  threadId: string | null;
  title?: string | null;
}

/**
 * Find the existing agent_sessions row that mirrors this (user, chat thread,
 * agent) trio, or insert one. Returns the session id, or null on any failure.
 *
 * The chat thread id is stored in metadata.thread_id so repeated turns on the
 * same thread reuse one agent session instead of creating a new one each time.
 */
export async function ensureAgentSession(
  args: EnsureSessionArgs
): Promise<string | null> {
  try {
    const { userId, organizationId, agentType, threadId } = args;
    if (!userId || !agentType) return null;

    const service = getSupabaseServiceClient();

    // Reuse: look for a prior session for this user + agent linked to the same
    // chat thread (tracked in metadata.thread_id).
    if (threadId) {
      const { data: existing } = await service
        .from("agent_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("agent_type", agentType)
        .eq("metadata->>thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const existingId = (existing as { id?: string } | null)?.id;
      if (existingId) return existingId;
    }

    const title = (args.title ?? "").trim().slice(0, 80) || null;
    const { data, error } = await service
      .from("agent_sessions")
      .insert({
        user_id: userId,
        organization_id: organizationId ?? null,
        agent_type: agentType,
        title,
        status: "active",
        origin: "web",
        last_message_at: new Date().toISOString(),
        metadata: threadId ? { thread_id: threadId, source: "atlas_chat" } : { source: "atlas_chat" },
      })
      .select("id")
      .maybeSingle();
    if (error) return null;
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

interface LogMessagesArgs {
  sessionId: string | null;
  userId: string;
  organizationId: string | null;
  agentType: AgentType;
  userText: string;
  assistantText: string;
  loadedMemoryCount?: number;
  loadedSkillCount?: number;
  toolCalls?: string[];
  sourceContext?: string | null;
  model?: string | null;
}

/**
 * Append the user + assistant rows for one turn to agent_messages, carrying the
 * loaded memory/skill counts, tool calls, source-context summary and model in
 * each row's metadata jsonb. Best-effort: returns false on any failure and
 * never throws. Also bumps the session's last_message_at.
 */
export async function logAgentMessages(args: LogMessagesArgs): Promise<boolean> {
  try {
    const { sessionId, userId, agentType } = args;
    if (!sessionId || !agentType) return false;

    const service = getSupabaseServiceClient();

    const toolCalls = Array.isArray(args.toolCalls) ? args.toolCalls : [];
    const model = args.model ?? null;
    const sharedMeta = {
      loaded_memory_count: args.loadedMemoryCount ?? 0,
      loaded_skill_count: args.loadedSkillCount ?? 0,
      tool_calls: toolCalls,
      tool_call_count: toolCalls.length,
      source_context: args.sourceContext ?? null,
      model,
      source: "atlas_chat",
    };

    const rows = [
      {
        session_id: sessionId,
        user_id: userId,
        agent_type: agentType,
        role: "user" as const,
        content: args.userText ?? "",
        metadata: { ...sharedMeta },
      },
      {
        session_id: sessionId,
        user_id: userId,
        agent_type: agentType,
        role: "assistant" as const,
        content: args.assistantText ?? "",
        model,
        metadata: { ...sharedMeta },
      },
    ];

    const { error } = await service.from("agent_messages").insert(rows);
    if (error) return false;

    // Best-effort bump so the session sorts/reads as freshly active.
    try {
      await service
        .from("agent_sessions")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", sessionId);
    } catch {
      // ignore — non-fatal
    }

    return true;
  } catch {
    return false;
  }
}
