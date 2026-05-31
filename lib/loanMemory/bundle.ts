// LegendsOS v2 — Loan Memory Bundle loader.
// Loads the full context an assistant needs BEFORE answering, and writes a
// loan_ai_retrieval_logs row. Every sub-query is guarded so a not-yet-applied
// table (or one with no rows) degrades to empty instead of throwing.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LoanMemory, LoanMemoryEvent } from "./types";

export interface LoanMemoryBundle {
  memory: LoanMemory | null;
  events: LoanMemoryEvent[];
  open_tasks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  conditions: Record<string, unknown>[];
  email_intake: Record<string, unknown>[];
  drive_links: Record<string, unknown>[];
  retrieval_summary: string;
  sources_checked: string[];
}

async function safeSelect<T = Record<string, unknown>>(run: () => any): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

export interface BundleOptions {
  assistantUserId?: string | null;
  queryText?: string;
  matchStatus?: string;
  /** When true, also write a loan_ai_retrieval_logs row. */
  logRetrieval?: boolean;
}

export async function loadLoanMemoryBundle(
  client: SupabaseClient,
  loanMemoryId: string,
  opts: BundleOptions = {}
): Promise<LoanMemoryBundle> {
  const sources: string[] = [];

  const memoryRows = await safeSelect<LoanMemory>(() =>
    (client.from("loan_memory") as any).select("*").eq("id", loanMemoryId).limit(1)
  );
  const memory = memoryRows[0] ?? null;
  if (memory) sources.push("loan_memory");

  const events = await safeSelect<LoanMemoryEvent>(() =>
    (client.from("loan_memory_events") as any)
      .select("*")
      .eq("loan_memory_id", loanMemoryId)
      .order("created_at", { ascending: false })
      .limit(25)
  );
  if (events.length) sources.push("loan_memory_events");

  const documents = await safeSelect(() =>
    (client.from("loan_documents") as any).select("*").eq("loan_memory_id", loanMemoryId).limit(50)
  );
  if (documents.length) sources.push("loan_documents");

  // Loan-scoped sources require the linked loan_id.
  const loanId = memory?.loan_id ?? null;
  let open_tasks: Record<string, unknown>[] = [];
  let conditions: Record<string, unknown>[] = [];
  let drive_links: Record<string, unknown>[] = [];
  let email_intake: Record<string, unknown>[] = [];
  if (loanId) {
    open_tasks = await safeSelect(() =>
      (client.from("loan_tasks") as any)
        .select("*")
        .eq("loan_id", loanId)
        .neq("status", "done")
        .limit(50)
    );
    if (open_tasks.length) sources.push("loan_tasks");

    conditions = await safeSelect(() =>
      (client.from("loan_conditions") as any)
        .select("*")
        .eq("loan_id", loanId)
        .neq("status", "cleared")
        .limit(50)
    );
    if (conditions.length) sources.push("loan_conditions");

    drive_links = await safeSelect(() =>
      (client.from("drive_folder_links") as any).select("*").eq("loan_id", loanId).limit(20)
    );
    if (drive_links.length) sources.push("drive_folder_links");

    // Gmail AI Intake (Phase 1, may be unapplied/dormant) — items matched to
    // this loan. Read-only; never auto-updates verified memory.
    email_intake = await safeSelect(() =>
      (client.from("email_intake_messages") as any)
        .select("id,subject,from_address,classification,status,received_at,loan_match_id")
        .eq("loan_match_id", loanId)
        .order("received_at", { ascending: false })
        .limit(15)
    );
    if (email_intake.length) sources.push("email_intake_messages");
  }

  const retrieval_summary = memory
    ? `Loaded memory for ${memory.borrower_name ?? "loan"}${
        memory.loan_number ? ` (#${memory.loan_number})` : ""
      } — stage ${memory.current_stage ?? "unknown"}, ${events.length} events, ${documents.length} docs, ${conditions.length} conditions, ${open_tasks.length} open tasks. Sources: ${sources.join(", ") || "none"}.`
    : "No loan memory found for that id.";

  // Audit: record what context was loaded before the AI answered.
  if (opts.logRetrieval) {
    try {
      await (client.from("loan_ai_retrieval_logs") as any).insert({
        loan_memory_id: memory?.id ?? null,
        assistant_user_id: opts.assistantUserId ?? null,
        query_text: opts.queryText ?? null,
        match_status: opts.matchStatus ?? (memory ? "matched" : "no_match"),
        retrieved_sources: sources,
        retrieval_summary,
      });
    } catch {
      // Logging must never break the answer path.
    }
  }

  return {
    memory,
    events,
    open_tasks,
    documents,
    conditions,
    email_intake,
    drive_links,
    retrieval_summary,
    sources_checked: sources,
  };
}
