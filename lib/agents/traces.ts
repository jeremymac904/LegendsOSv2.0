// LegendsOS v2 — Agent execution traces (Hermes-style)
// ---------------------------------------------------------------------------
// Every agent response writes a trace: what context was loaded, which skills
// and tools were used, which model answered, and how long it took. Traces
// carry LABELS and SUMMARIES only — never secrets or raw borrower PII.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AgentType } from "./types";

type AnyClient = SupabaseClient<any, any, any>;

export interface TraceInput {
  sessionId: string | null;
  messageId: string | null;
  userId: string;
  agentType: AgentType;
  inputSummary: string;
  contextLoaded: string[];
  skillsUsed: string[];
  toolsCalled: string[];
  provider: string | null;
  modelUsed: string | null;
  outputType: string;
  durationMs: number;
}

/** Write a trace row. Returns the trace id, or null if it couldn't persist. */
export async function writeTrace(
  client: AnyClient,
  input: TraceInput
): Promise<string | null> {
  try {
    const { data, error } = await client
      .from("agent_traces")
      .insert({
        session_id: input.sessionId,
        message_id: input.messageId,
        user_id: input.userId,
        agent_type: input.agentType,
        input_summary: input.inputSummary.slice(0, 280),
        context_loaded: input.contextLoaded,
        skills_used: input.skillsUsed,
        tools_called: input.toolsCalled,
        provider: input.provider,
        model_used: input.modelUsed,
        output_type: input.outputType,
        duration_ms: input.durationMs,
      })
      .select("id")
      .maybeSingle();
    if (error) return null;
    return (data?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}
