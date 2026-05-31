// LegendsOS v2 — Loan Memory event writer (with quality guardrails).
// Creates a loan_memory_event and optionally advances the memory snapshot —
// but ONLY in ways the memory-quality rules allow.

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  LoanMemory,
  MemoryConfidence,
  MemoryEventType,
  MemoryPriority,
} from "./types";
import { PROTECTED_STATUSES } from "./types";

const CONF_RANK: Record<MemoryConfidence, number> = { low: 1, medium: 2, high: 3 };

export interface WriteEventInput {
  loan_memory_id: string;
  event_type: MemoryEventType;
  event_title?: string;
  event_summary?: string;
  source_type?: string;
  source_name?: string;
  source_url_or_path?: string;
  source_timestamp?: string;
  created_by?: string | null;
  confidence?: MemoryConfidence;
  // Optional snapshot advances (guarded):
  main_blocker?: string;
  next_action?: string;
  current_stage?: string;
  priority?: MemoryPriority;
  approval_status?: string;
  appraisal_status?: string;
  title_status?: string;
  insurance_status?: string;
  /** True only when the change is backed by source evidence (doc/email/AUS/...). */
  source_evidence?: boolean;
}

export interface WriteEventResult {
  ok: boolean;
  error?: string;
  event_id?: string;
  applied_updates?: string[];
  blocked_updates?: string[];
}

function isProtected(value?: string): boolean {
  if (!value) return false;
  const v = value.toLowerCase().replace(/\s+/g, "_");
  return (PROTECTED_STATUSES as readonly string[]).some((p) => v.includes(p));
}

export async function writeMemoryEvent(
  client: SupabaseClient,
  input: WriteEventInput
): Promise<WriteEventResult> {
  const confidence: MemoryConfidence = input.confidence ?? "medium";

  // Load current memory to apply guardrails.
  let current: LoanMemory | null = null;
  try {
    const { data } = await (client.from("loan_memory") as any)
      .select("*")
      .eq("id", input.loan_memory_id)
      .limit(1)
      .maybeSingle();
    current = (data as LoanMemory) ?? null;
  } catch {
    current = null;
  }
  if (!current) return { ok: false, error: "memory_not_found" };

  // 1) Insert the event (always — the timeline preserves source summary).
  let eventId: string | undefined;
  try {
    const { data, error } = await (client.from("loan_memory_events") as any)
      .insert({
        loan_memory_id: input.loan_memory_id,
        event_type: input.event_type,
        event_title: input.event_title ?? null,
        event_summary: input.event_summary ?? null,
        source_type: input.source_type ?? null,
        source_name: input.source_name ?? null,
        source_url_or_path: input.source_url_or_path ?? null,
        source_timestamp: input.source_timestamp ?? null,
        created_by: input.created_by ?? null,
        confidence,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: "event_insert_failed" };
    eventId = (data as { id: string }).id;
  } catch {
    return { ok: false, error: "event_insert_failed" };
  }

  // 2) Build the guarded snapshot update.
  const updates: Record<string, unknown> = {
    last_known_activity: input.source_timestamp ?? new Date().toISOString(),
  };
  const applied: string[] = ["last_known_activity"];
  const blocked: string[] = [];

  // Status fields: never set a PROTECTED status without source evidence.
  const statusFields: (keyof WriteEventInput)[] = [
    "approval_status", "appraisal_status", "title_status", "insurance_status", "current_stage",
  ];
  for (const f of statusFields) {
    const val = input[f] as string | undefined;
    if (val == null) continue;
    if (isProtected(val) && !input.source_evidence) {
      blocked.push(`${f} (protected status needs source evidence)`);
      continue;
    }
    updates[f] = val;
    applied.push(f as string);
  }

  // main_blocker: do not DELETE an existing blocker unless explicitly cleared
  // with evidence; allow adding/changing.
  if (typeof input.main_blocker === "string") {
    if (input.main_blocker.trim() === "" && current.main_blocker && !input.source_evidence) {
      blocked.push("main_blocker (won't clear an existing blocker without evidence)");
    } else {
      updates.main_blocker = input.main_blocker;
      applied.push("main_blocker");
    }
  }
  if (typeof input.next_action === "string") {
    updates.next_action = input.next_action;
    applied.push("next_action");
  }
  if (input.priority) {
    updates.priority = input.priority;
    applied.push("priority");
  }

  // Don't overwrite verified (high-confidence) memory with a weaker note.
  if (CONF_RANK[confidence] < CONF_RANK[current.confidence]) {
    // Keep status advances out when the incoming note is weaker than what's
    // already verified — but still record activity + next_action.
    for (const f of statusFields) {
      if (f in updates) {
        delete updates[f as string];
        const i = applied.indexOf(f as string);
        if (i >= 0) applied.splice(i, 1);
        blocked.push(`${f} (incoming ${confidence} < verified ${current.confidence})`);
      }
    }
  } else {
    updates.confidence = confidence;
    applied.push("confidence");
  }

  // Preserve + extend the source summary (never silently replace).
  if (input.event_summary) {
    const stamp = new Date().toISOString().slice(0, 10);
    const line = `[${stamp}] ${input.event_type}: ${input.event_summary}`;
    updates.source_summary = current.source_summary
      ? `${current.source_summary}\n${line}`
      : line;
    applied.push("source_summary");
  }

  try {
    await (client.from("loan_memory") as any).update(updates).eq("id", input.loan_memory_id);
  } catch {
    // The event is already recorded; a failed snapshot update is non-fatal.
  }

  return { ok: true, event_id: eventId, applied_updates: applied, blocked_updates: blocked };
}
