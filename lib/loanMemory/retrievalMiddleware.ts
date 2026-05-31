// LegendsOS v2 — Loan AI retrieval middleware.
// Sits BEFORE the model in the Atlas chat path. Decides whether a message is
// loan-related, and — if so — ATTEMPTS retrieval before any loan answer is
// produced. The assistant must never answer a loan question without first
// attempting to ground it in loan_memory.
//
// Contract (per Loan Memory foundation):
//   • Not loan-related            → { loanRelated:false } (no forced retrieval).
//   • Matched                     → compact context object the chat route
//                                    prepends to the system prompt, plus a small
//                                    UI panel summary. loadLoanMemoryBundle
//                                    writes the loan_ai_retrieval_logs row.
//   • multiple_matches / low_conf → candidates for the user to choose from. We
//                                    insert our OWN retrieval log row.
//   • no_match                    → required clarification fields. We insert our
//                                    OWN retrieval log row.
//
// Everything degrades gracefully: if a table is missing (migration not applied)
// the resolver returns no_match and the bundle returns empties — never throws.

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadLoanMemoryBundle } from "./bundle";
import { isLoanRelated } from "./detect";
import { resolveLoanContext } from "./resolve";
import type {
  LoanMemory,
  MatchStatus,
  MemoryMatch,
} from "./types";
import { LOAN_RESPONSE_FORMAT, type VoiceProfile } from "./voices";

export interface RunLoanRetrievalInput {
  userId?: string | null;
  queryText: string;
  // Optional resolver hints the caller already knows.
  threadId?: string;
  borrowerHint?: string;
  loanId?: string;
  propertyAddress?: string;
  emailThreadId?: string;
  documentId?: string;
}

// Small UI summary surfaced next to the answer ("retrieved from" panel).
export interface LoanRetrievalPanel {
  borrower: string | null;
  loan_number: string | null;
  current_stage: string | null;
  last_update: string | null;
  open_blocker: string | null;
  sources_checked: string[];
}

export interface LoanRetrievalResult {
  loanRelated: boolean;
  matchStatus?: MatchStatus;
  // Present only when matched.
  memory?: LoanMemory | null;
  loanMemoryId?: string | null;
  contextText?: string;
  panel?: LoanRetrievalPanel;
  sourcesChecked?: string[];
  // Present when multiple_matches / low_confidence — ask the user to choose.
  candidates?: MemoryMatch[];
  // Present when no_match — fields to ask the user for.
  requiredClarification?: ("borrower_name" | "property_address" | "loan_number")[];
}

/**
 * Insert a loan_ai_retrieval_logs row for the no/multiple/low-confidence match
 * paths (the bundle handles the matched path). Guarded so a missing table or
 * RLS denial never breaks chat.
 */
async function logRetrievalAttempt(
  client: SupabaseClient,
  args: {
    userId?: string | null;
    queryText: string;
    matchStatus: MatchStatus;
    candidates?: MemoryMatch[];
    summary: string;
  }
): Promise<void> {
  try {
    await (client.from("loan_ai_retrieval_logs") as any).insert({
      loan_memory_id: null,
      assistant_user_id: args.userId ?? null,
      query_text: args.queryText ?? null,
      match_status: args.matchStatus,
      retrieved_sources: (args.candidates ?? []).map((c) => ({
        loan_memory_id: c.loan_memory_id,
        borrower_name: c.borrower_name,
        loan_number: c.loan_number,
        confidence: c.confidence,
      })),
      retrieval_summary: args.summary,
    });
  } catch {
    // Logging must never break the answer path.
  }
}

/**
 * Build the compact, system-prompt-ready context summary from a loaded memory
 * (status / blocker / next action), plus the most recent events as evidence.
 */
function buildContextText(
  memory: LoanMemory,
  events: { event_type: string; event_summary: string | null; created_at: string }[],
  retrievalSummary: string
): string {
  const lines: string[] = [];
  const who = memory.borrower_name ?? "Unknown borrower";
  const num = memory.loan_number ? ` (Loan #${memory.loan_number})` : "";
  lines.push(`Loan in memory: ${who}${num}.`);
  if (memory.co_borrower_name) lines.push(`Co-borrower: ${memory.co_borrower_name}.`);
  if (memory.property_address) lines.push(`Property: ${memory.property_address}.`);
  if (memory.loan_purpose || memory.loan_type) {
    lines.push(
      `Type: ${[memory.loan_purpose, memory.loan_type].filter(Boolean).join(" / ") || "Unknown"}.`
    );
  }
  if (memory.lender) lines.push(`Lender: ${memory.lender}.`);
  lines.push(`Current stage: ${memory.current_stage ?? "Unknown"}.`);
  lines.push(
    `Status — approval: ${memory.approval_status}; appraisal: ${memory.appraisal_status}; title: ${memory.title_status}; insurance: ${memory.insurance_status}.`
  );
  lines.push(`Main blocker: ${memory.main_blocker ?? "None recorded"}.`);
  lines.push(`Next action: ${memory.next_action ?? "Unknown"}.`);
  if (memory.closing_date) lines.push(`Target closing: ${memory.closing_date}.`);
  if (memory.last_known_activity) lines.push(`Last known activity: ${memory.last_known_activity}.`);
  lines.push(`Confidence of this snapshot: ${memory.confidence}.`);

  if (events.length > 0) {
    lines.push("");
    lines.push("Recent timeline (most recent first):");
    for (const e of events.slice(0, 8)) {
      const when = (e.created_at ?? "").slice(0, 10);
      const what = e.event_summary?.trim() || e.event_type;
      lines.push(`- [${when}] ${e.event_type}: ${what}`);
    }
  }

  lines.push("");
  lines.push(`Retrieval: ${retrievalSummary}`);
  lines.push(
    "Answer ONLY from this retrieved context. If a value is not present above, say \"Unknown\" — do not guess. Never claim clear_to_close / closed / denied / suspended / dead unless it appears above with source evidence."
  );
  return lines.join("\n");
}

export async function runLoanRetrieval(
  client: SupabaseClient,
  input: RunLoanRetrievalInput
): Promise<LoanRetrievalResult> {
  const queryText = input.queryText ?? "";

  // Step 0 — DORMANT BY DEFAULT. The whole loan-memory layer ships off until
  // the owner applies the migration and sets LOAN_MEMORY_ENABLED=true. While
  // off, this is a no-op so Atlas behaves exactly as before (no behavior
  // change in production for general mortgage questions). Consistent with the
  // Gmail-intake "deploy dormant" pattern.
  if (process.env.LOAN_MEMORY_ENABLED !== "true") {
    return { loanRelated: false };
  }

  // Step 1 — detection. Non-loan messages get NO forced retrieval.
  if (!isLoanRelated(queryText)) {
    return { loanRelated: false };
  }

  // Step 2 — attempt to resolve a loan from the query (+ any hints). Guarded:
  // resolveLoanContext already swallows table-missing/RLS errors and returns
  // no_match, so this stays honest when the migration isn't applied.
  let resolved;
  try {
    resolved = await resolveLoanContext(client, {
      query_text: queryText,
      user_id: input.userId ?? undefined,
      thread_id: input.threadId,
      borrower_hint: input.borrowerHint,
      loan_id: input.loanId,
      property_address: input.propertyAddress,
      email_thread_id: input.emailThreadId,
      document_id: input.documentId,
    });
  } catch {
    resolved = {
      match_status: "no_match" as MatchStatus,
      required_clarification: [
        "borrower_name",
        "property_address",
        "loan_number",
      ] as ("borrower_name" | "property_address" | "loan_number")[],
    };
  }

  const matchStatus = resolved.match_status;

  // Step 3a — MATCHED: load the full bundle (which writes the retrieval log).
  if (matchStatus === "matched" && resolved.match) {
    const loanMemoryId = resolved.match.loan_memory_id;
    const bundle = await loadLoanMemoryBundle(client, loanMemoryId, {
      assistantUserId: input.userId ?? null,
      queryText,
      matchStatus: "matched",
      logRetrieval: true,
    });

    // If the table is unapplied the bundle returns memory:null — degrade to a
    // no_match-style clarification instead of pretending we have context.
    if (!bundle.memory) {
      await logRetrievalAttempt(client, {
        userId: input.userId,
        queryText,
        matchStatus: "no_match",
        summary:
          "Resolver matched a loan id but loan_memory was empty/unavailable (migration may not be applied).",
      });
      return {
        loanRelated: true,
        matchStatus: "no_match",
        memory: null,
        loanMemoryId: null,
        sourcesChecked: bundle.sources_checked,
        requiredClarification: [
          "borrower_name",
          "property_address",
          "loan_number",
        ],
      };
    }

    const memory = bundle.memory;
    const contextText = buildContextText(
      memory,
      bundle.events as unknown as {
        event_type: string;
        event_summary: string | null;
        created_at: string;
      }[],
      bundle.retrieval_summary
    );

    const panel: LoanRetrievalPanel = {
      borrower: memory.borrower_name,
      loan_number: memory.loan_number,
      current_stage: memory.current_stage,
      last_update: memory.last_known_activity ?? memory.updated_at ?? null,
      open_blocker: memory.main_blocker,
      sources_checked: bundle.sources_checked,
    };

    return {
      loanRelated: true,
      matchStatus: "matched",
      memory,
      loanMemoryId: memory.id,
      contextText,
      panel,
      sourcesChecked: bundle.sources_checked,
    };
  }

  // Step 3b — MULTIPLE / LOW CONFIDENCE: never guess. Return candidates and log.
  if (matchStatus === "multiple_matches" || matchStatus === "low_confidence") {
    const candidates = resolved.candidates ?? [];
    await logRetrievalAttempt(client, {
      userId: input.userId,
      queryText,
      matchStatus,
      candidates,
      summary: `${matchStatus}: ${candidates.length} candidate(s) — asked user to choose.`,
    });
    return {
      loanRelated: true,
      matchStatus,
      candidates,
      sourcesChecked: ["loan_memory"],
    };
  }

  // Step 3c — NO MATCH: return the clarification fields and log the attempt.
  const requiredClarification =
    resolved.required_clarification ?? [
      "borrower_name",
      "property_address",
      "loan_number",
    ];
  await logRetrievalAttempt(client, {
    userId: input.userId,
    queryText,
    matchStatus: "no_match",
    summary: "no_match: asked user for borrower name / property address / loan number.",
  });
  return {
    loanRelated: true,
    matchStatus: "no_match",
    requiredClarification,
    sourcesChecked: ["loan_memory"],
  };
}

/**
 * Prepend the retrieved loan context + the loan response format to the
 * assistant's existing instructions so the model answers from memory, in the
 * required shape. Pass the user's voice profile so tone is consistent.
 */
export function buildLoanSystemPrompt(
  contextText: string,
  voice: VoiceProfile
): string {
  return [
    "## Loan context (retrieved from loan memory — ground your answer in this)",
    contextText,
    "",
    "## Voice",
    voice.rules,
    "",
    "## Loan response format",
    LOAN_RESPONSE_FORMAT,
  ].join("\n");
}
