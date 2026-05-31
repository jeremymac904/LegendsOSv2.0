// LegendsOS v2 — Loan Memory: resolve a free-text query (+ hints) to a loan.
// POST /api/loan-memory/resolve
// Body: { query_text, user_id?, thread_id?, borrower_hint?, loan_id?,
//         property_address?, email_thread_id?, document_id? }
// Returns ResolveResult: { match_status, match?, candidates?, required_clarification? }.
// On no/low/multiple match the caller gets candidates / required_clarification so
// it can ASK the user instead of guessing borrower identity.

import { NextResponse } from "next/server";

import { resolveLoanContext, type ResolveInput } from "@/lib/loanMemory/resolve";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Partial<ResolveInput>;
  try {
    body = (await req.json()) as Partial<ResolveInput>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const query_text = typeof body.query_text === "string" ? body.query_text : "";
  if (!query_text.trim()) {
    return NextResponse.json(
      { ok: false, error: "query_text_required" },
      { status: 400 }
    );
  }

  const input: ResolveInput = {
    query_text,
    user_id: body.user_id ?? profile.id,
    thread_id: body.thread_id,
    borrower_hint: body.borrower_hint,
    co_borrower_hint: body.co_borrower_hint,
    loan_id: body.loan_id,
    loan_number: body.loan_number,
    property_address: body.property_address,
    email_thread_id: body.email_thread_id,
    gmail_subject: body.gmail_subject,
    gmail_sender: body.gmail_sender,
    document_id: body.document_id,
    document_name: body.document_name,
    browser_capture_id: body.browser_capture_id,
    source_url: body.source_url,
    source_title: body.source_title,
    selected_text: body.selected_text,
    structured_context: body.structured_context,
  };

  try {
    const result = await resolveLoanContext(getSupabaseServerClient(), input);
    // ResolveResult is returned as-is. match_status drives caller behavior:
    // matched → use result.match; multiple_matches / low_confidence → ask using
    // result.candidates; no_match → ask using result.required_clarification.
    return NextResponse.json({ ok: true, ...result });
  } catch {
    // Degrade gracefully — never 500 (e.g. migration not applied).
    return NextResponse.json({
      ok: false,
      degraded: true,
      match_status: "no_match",
      required_clarification: ["borrower_name", "property_address", "loan_number"],
      error: "resolve_unavailable",
    });
  }
}
