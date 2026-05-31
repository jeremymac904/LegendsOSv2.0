// LegendsOS v2 — Loan Context Resolver.
// Resolves a free-text query (+ optional hints) to a loan_memory record using
// a strict priority order. NEVER guesses borrower identity when multiple
// candidates match — returns multiple_matches and asks the user to choose.
// Degrades gracefully (no_match) if the table isn't applied yet.

import type { SupabaseClient } from "@supabase/supabase-js";

import { extractHints } from "./detect";
import type { LoanMemory, MemoryMatch, ResolveResult } from "./types";

export interface ResolveInput {
  query_text: string;
  user_id?: string;
  thread_id?: string;
  borrower_hint?: string;
  loan_id?: string;
  property_address?: string;
  email_thread_id?: string;
  document_id?: string;
}

function summarize(m: LoanMemory): string {
  const bits = [
    m.current_stage ? `Stage: ${m.current_stage}` : null,
    m.main_blocker ? `Blocker: ${m.main_blocker}` : null,
    m.next_action ? `Next: ${m.next_action}` : null,
  ].filter(Boolean);
  return bits.join(" · ") || "No status recorded yet.";
}

function toMatch(m: LoanMemory, confidence: number, reason: string): MemoryMatch {
  return {
    loan_memory_id: m.id,
    loan_id: m.loan_id,
    borrower_name: m.borrower_name,
    property_address: m.property_address,
    loan_number: m.loan_number,
    confidence,
    match_reason: reason,
    summary: summarize(m),
  };
}

// RLS-respecting query: the caller passes an auth'd client so only memories the
// user may see are returned. A service client would see all — callers choose.
async function fetchMemories(
  client: SupabaseClient,
  build: (q: ReturnType<SupabaseClient["from"]>) => unknown
): Promise<LoanMemory[]> {
  try {
    const { data, error } = (await build(client.from("loan_memory") as any)) as {
      data: LoanMemory[] | null;
      error: unknown;
    };
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function resolveLoanContext(
  client: SupabaseClient,
  input: ResolveInput
): Promise<ResolveResult> {
  const hints = extractHints(input.query_text);
  const loanNumber = hints.loanNumber;
  const address = input.property_address ?? hints.address;
  const names = input.borrower_hint ? [input.borrower_hint, ...hints.names] : hints.names;

  // Direct loan_id hint short-circuits.
  if (input.loan_id) {
    const rows = await fetchMemories(client, (q) =>
      (q as any).select("*").eq("loan_id", input.loan_id).limit(5)
    );
    if (rows.length === 1) return { match_status: "matched", match: toMatch(rows[0], 0.99, "loan_id") };
    if (rows.length > 1)
      return { match_status: "multiple_matches", candidates: rows.map((m) => toMatch(m, 0.6, "loan_id")) };
  }

  const candidates = new Map<string, MemoryMatch>();
  const add = (rows: LoanMemory[], confidence: number, reason: string) => {
    for (const m of rows) if (!candidates.has(m.id)) candidates.set(m.id, toMatch(m, confidence, reason));
  };

  // Priority 1 — loan number (highest confidence).
  if (loanNumber) {
    add(
      await fetchMemories(client, (q) =>
        (q as any).select("*").ilike("loan_number", `%${loanNumber}%`).limit(5)
      ),
      0.97,
      `loan number ${loanNumber}`
    );
  }
  // Priority 2 — borrower full name.
  for (const name of names.slice(0, 3)) {
    add(
      await fetchMemories(client, (q) =>
        (q as any).select("*").ilike("borrower_name", `%${name}%`).limit(5)
      ),
      0.85,
      `borrower name "${name}"`
    );
  }
  // Priority 3 — property address.
  if (address) {
    add(
      await fetchMemories(client, (q) =>
        (q as any).select("*").ilike("property_address", `%${address}%`).limit(5)
      ),
      0.8,
      `property address`
    );
  }
  // Priority 4 — co-borrower name.
  for (const name of names.slice(0, 3)) {
    add(
      await fetchMemories(client, (q) =>
        (q as any).select("*").ilike("co_borrower_name", `%${name}%`).limit(5)
      ),
      0.7,
      `co-borrower "${name}"`
    );
  }

  const list = Array.from(candidates.values()).sort((a, b) => b.confidence - a.confidence);

  if (list.length === 0) {
    return {
      match_status: "no_match",
      required_clarification: ["borrower_name", "property_address", "loan_number"],
    };
  }
  if (list.length === 1) {
    const only = list[0];
    if (only.confidence >= 0.8) return { match_status: "matched", match: only };
    return { match_status: "low_confidence", candidates: list };
  }
  // More than one distinct candidate — never guess; ask the user to choose.
  const top = list[0];
  const second = list[1];
  if (top.confidence >= 0.9 && top.confidence - second.confidence >= 0.2) {
    return { match_status: "matched", match: top };
  }
  return { match_status: "multiple_matches", candidates: list.slice(0, 5) };
}
