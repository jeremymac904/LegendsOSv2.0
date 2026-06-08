// LegendsOS v2 — Agent handoffs
// ---------------------------------------------------------------------------
// Pass a session/context from one agent (or user) to another — e.g. the
// Coordinator hands a file to FLO, or a loan officer escalates to Jeremy.
// Browser Companion routing also uses defaultAgentForRole (registry) to pick
// the right agent for an incoming capture.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingDatabaseObjectError } from "@/lib/supabase/server";

import type { AgentHandoff, AgentType } from "./types";

type AnyClient = SupabaseClient<any, any, any>;

export interface CreateHandoffInput {
  fromUserId: string;
  fromAgentType: AgentType;
  toAgentType: AgentType;
  toUserId?: string | null;
  fromSessionId?: string | null;
  reason?: string;
  contextSummary?: string;
  metadata?: Record<string, unknown>;
}

export async function createHandoff(
  client: AnyClient,
  input: CreateHandoffInput
): Promise<{ ok: boolean; handoff: AgentHandoff | null; degraded: boolean }> {
  try {
    const { data, error } = await client
      .from("agent_handoffs")
      .insert({
        from_user_id: input.fromUserId,
        from_agent_type: input.fromAgentType,
        to_agent_type: input.toAgentType,
        to_user_id: input.toUserId ?? null,
        from_session_id: input.fromSessionId ?? null,
        reason: input.reason ?? null,
        context_summary: input.contextSummary?.slice(0, 2000) ?? null,
        metadata: input.metadata ?? {},
        status: "pending",
      })
      .select("*")
      .maybeSingle();
    if (error) {
      if (isMissingDatabaseObjectError(error)) {
        return { ok: false, handoff: null, degraded: true };
      }
      return { ok: false, handoff: null, degraded: false };
    }
    return { ok: true, handoff: (data as AgentHandoff) ?? null, degraded: false };
  } catch (error) {
    return {
      ok: false,
      handoff: null,
      degraded: isMissingDatabaseObjectError(error),
    };
  }
}

export async function listPendingHandoffs(
  client: AnyClient,
  userId: string
): Promise<AgentHandoff[]> {
  try {
    const { data, error } = await client
      .from("agent_handoffs")
      .select("*")
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) return [];
    return (data ?? []) as AgentHandoff[];
  } catch {
    return [];
  }
}

export async function updateHandoffStatus(
  client: AnyClient,
  handoffId: string,
  status: "accepted" | "declined" | "completed"
): Promise<boolean> {
  try {
    const patch: Record<string, unknown> = { status };
    if (status === "accepted") patch.accepted_at = new Date().toISOString();
    const { error } = await client
      .from("agent_handoffs")
      .update(patch)
      .eq("id", handoffId);
    return !error;
  } catch {
    return false;
  }
}
