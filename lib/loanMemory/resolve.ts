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
  co_borrower_hint?: string;
  loan_id?: string;
  loan_number?: string;
  property_address?: string;
  email_thread_id?: string;
  gmail_subject?: string;
  gmail_sender?: string;
  document_id?: string;
  document_name?: string;
  browser_capture_id?: string;
  source_url?: string;
  source_title?: string;
  selected_text?: string;
  structured_context?: Record<string, unknown>;
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

async function fetchRows<T = Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  build: (q: ReturnType<SupabaseClient["from"]>) => unknown
): Promise<T[]> {
  try {
    const { data, error } = (await build(client.from(table) as any)) as {
      data: T[] | null;
      error: unknown;
    };
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function structuredText(value: unknown, depth = 0): string[] {
  if (!value || depth > 2) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => structuredText(item, depth + 1));
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [
      key,
      ...structuredText(item, depth + 1),
    ]);
  }
  return [];
}

function uniqueNonEmpty(values: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const v = text(value);
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function extractUuid(value: string): string | null {
  return (
    value.match(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
    )?.[0] ?? null
  );
}

async function fetchByLoanIds(
  client: SupabaseClient,
  loanIds: string[],
  limit = 10
): Promise<LoanMemory[]> {
  const ids = uniqueNonEmpty(loanIds);
  if (!ids.length) return [];
  return fetchMemories(client, (q) => (q as any).select("*").in("loan_id", ids).limit(limit));
}

export async function resolveLoanContext(
  client: SupabaseClient,
  input: ResolveInput
): Promise<ResolveResult> {
  const captureRows = input.browser_capture_id
    ? await fetchRows<{
        id: string;
        source_url: string | null;
        source_title: string | null;
        selected_text: string | null;
        structured_context: Record<string, unknown> | null;
      }>(client, "browser_companion_captures", (q) =>
        (q as any).select("id,source_url,source_title,selected_text,structured_context").eq("id", input.browser_capture_id).limit(1)
      )
    : [];
  const capture = captureRows[0];

  const corpus = [
    input.query_text,
    input.borrower_hint,
    input.co_borrower_hint,
    input.loan_number,
    input.property_address,
    input.gmail_subject,
    input.gmail_sender,
    input.document_name,
    input.source_url,
    input.source_title,
    input.selected_text,
    ...(input.structured_context ? structuredText(input.structured_context) : []),
    capture?.source_url,
    capture?.source_title,
    capture?.selected_text,
    ...(capture?.structured_context ? structuredText(capture.structured_context) : []),
  ].join("\n");

  const hints = extractHints(corpus);
  const loanNumber = input.loan_number ?? hints.loanNumber;
  const address = input.property_address ?? hints.address;
  const names = uniqueNonEmpty([
    input.borrower_hint,
    input.co_borrower_hint,
    ...hints.names,
  ]);
  const sourceUuid = extractUuid(`${input.source_url ?? ""}\n${capture?.source_url ?? ""}\n${corpus}`);

  // Direct loan_id hint short-circuits.
  if (input.loan_id) {
    const rows = await fetchMemories(client, (q) =>
      (q as any).select("*").eq("loan_id", input.loan_id).limit(5)
    );
    if (rows.length === 1) return { match_status: "matched", match: toMatch(rows[0], 0.99, "loan_id") };
    if (rows.length > 1)
      return { match_status: "multiple_matches", candidates: rows.map((m) => toMatch(m, 0.6, "loan_id")) };
  }

  // Loan Factory and other portals often expose a stable UUID in the URL.
  if (sourceUuid) {
    const rows = await fetchMemories(client, (q) =>
      (q as any).select("*").eq("loan_id", sourceUuid).limit(5)
    );
    if (rows.length === 1) return { match_status: "matched", match: toMatch(rows[0], 0.96, "portal context loan id") };
    if (rows.length > 1)
      return { match_status: "multiple_matches", candidates: rows.map((m) => toMatch(m, 0.6, "portal context loan id")) };
  }

  const candidates = new Map<string, MemoryMatch>();
  const add = (rows: LoanMemory[], confidence: number, reason: string) => {
    for (const m of rows) {
      const existing = candidates.get(m.id);
      if (!existing || confidence > existing.confidence) {
        candidates.set(m.id, toMatch(m, confidence, reason));
      }
    }
  };

  // Direct document metadata. Documents can point to memory directly, or to
  // the underlying loan row. RLS on loan_documents/loan_memory still applies.
  if (input.document_id) {
    const docs = await fetchRows<{
      id: string;
      loan_id: string | null;
      loan_memory_id?: string | null;
      drive_file_id?: string | null;
      name?: string | null;
    }>(client, "loan_documents", (q) =>
      (q as any)
        .select("id,loan_id,loan_memory_id,drive_file_id,name")
        .or(`id.eq.${input.document_id},drive_file_id.eq.${input.document_id}`)
        .limit(10)
    );
    const memoryIds = docs.map((d) => d.loan_memory_id).filter(Boolean) as string[];
    if (memoryIds.length) {
      add(
        await fetchMemories(client, (q) => (q as any).select("*").in("id", memoryIds).limit(10)),
        0.95,
        "uploaded document metadata"
      );
    }
    add(await fetchByLoanIds(client, docs.map((d) => d.loan_id).filter(Boolean) as string[]), 0.9, "uploaded document loan link");
  }

  // Gmail intake metadata. This does not read Gmail; it uses existing intake
  // rows when present and falls back to subject/sender text hints.
  if (input.email_thread_id) {
    const emailRows = await fetchRows<{
      id: string;
      gmail_thread_id: string | null;
      gmail_message_id: string | null;
      loan_match_id: string | null;
      subject: string | null;
      from_address: string | null;
      from_name: string | null;
    }>(client, "email_intake_messages", (q) =>
      (q as any)
        .select("id,gmail_thread_id,gmail_message_id,loan_match_id,subject,from_address,from_name")
        .or(`id.eq.${input.email_thread_id},gmail_thread_id.eq.${input.email_thread_id},gmail_message_id.eq.${input.email_thread_id}`)
        .limit(10)
    );
    add(
      await fetchByLoanIds(client, emailRows.map((row) => row.loan_match_id).filter(Boolean) as string[]),
      0.88,
      "Gmail intake loan match"
    );
  }

  // Priority 1 — loan number (highest confidence).
  if (loanNumber) {
    add(
      await fetchMemories(client, (q) =>
        (q as any).select("*").ilike("loan_number", `%${loanNumber}%`).limit(5)
      ),
      0.97,
      `loan number ${loanNumber}`
    );
    const loans = await fetchRows<{ id: string }>(client, "loans", (q) =>
      (q as any).select("id").ilike("loan_number", `%${loanNumber}%`).limit(10)
    );
    add(await fetchByLoanIds(client, loans.map((loan) => loan.id)), 0.93, "pipeline loan number");
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
    const borrowerLoans = await fetchRows<{ loan_id: string }>(client, "borrowers", (q) =>
      (q as any).select("loan_id").ilike("full_name", `%${name}%`).limit(10)
    );
    add(
      await fetchByLoanIds(client, borrowerLoans.map((row) => row.loan_id)),
      0.82,
      `pipeline borrower "${name}"`
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
    const loans = await fetchRows<{ id: string }>(client, "loans", (q) =>
      (q as any).select("id").ilike("property_address", `%${address}%`).limit(10)
    );
    add(await fetchByLoanIds(client, loans.map((loan) => loan.id)), 0.82, "pipeline property address");
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
