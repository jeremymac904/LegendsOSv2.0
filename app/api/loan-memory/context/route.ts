// LegendsOS v2 — Loan Brain resolver + bundle endpoint.
// POST resolves a borrower/loan from any supported hint, loads the RLS-scoped
// memory bundle, and writes the retrieval audit log on matched loads.

import { NextResponse } from "next/server";

import { connectorsSnapshot } from "@/lib/loanMemory/connectors";
import { loadLoanMemoryBundle } from "@/lib/loanMemory/bundle";
import { resolveLoanContext, type ResolveInput } from "@/lib/loanMemory/resolve";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextBody = Partial<ResolveInput> & {
  loan_memory_id?: string;
};

function setupState() {
  const drive = getDriveConnectionStatus();
  const connectors = connectorsSnapshot();
  const setup_missing: string[] = [];
  if (process.env.LOAN_MEMORY_ENABLED !== "true") {
    setup_missing.push("LOAN_MEMORY_ENABLED is not true; Atlas chat retrieval is dormant.");
  }
  if (!drive.connected) setup_missing.push(drive.reason);
  if (!connectors.gmailIntake.active) setup_missing.push(connectors.gmailIntake.note);
  return { drive, connectors, setup_missing };
}

function hasSignal(body: ContextBody): boolean {
  return Boolean(
    body.loan_memory_id ||
      body.query_text?.trim() ||
      body.borrower_hint?.trim() ||
      body.co_borrower_hint?.trim() ||
      body.loan_id?.trim() ||
      body.loan_number?.trim() ||
      body.property_address?.trim() ||
      body.email_thread_id?.trim() ||
      body.gmail_subject?.trim() ||
      body.gmail_sender?.trim() ||
      body.document_id?.trim() ||
      body.document_name?.trim() ||
      body.browser_capture_id?.trim() ||
      body.source_url?.trim() ||
      body.source_title?.trim()
  );
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: ContextBody;
  try {
    body = (await req.json()) as ContextBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!hasSignal(body)) {
    return NextResponse.json({ ok: false, error: "identifier_required" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const setup = setupState();

  try {
    if (body.loan_memory_id) {
      const auditQuery = body.query_text ?? body.borrower_hint ?? body.loan_number ?? undefined;
      const bundle = await loadLoanMemoryBundle(supabase, body.loan_memory_id, {
        assistantUserId: profile.id,
        queryText: auditQuery,
        matchStatus: "matched",
        logRetrieval: true,
      });
      return NextResponse.json({
        ok: Boolean(bundle.memory),
        match_status: bundle.memory ? "matched" : "no_match",
        bundle,
        setup_missing: setup.setup_missing,
        drive: setup.drive,
        connectors: setup.connectors,
      });
    }

    const query_text =
      body.query_text ??
      [
        body.borrower_hint,
        body.co_borrower_hint,
        body.loan_number,
        body.property_address,
        body.gmail_subject,
        body.gmail_sender,
        body.document_name,
        body.source_title,
        body.source_url,
      ]
        .filter(Boolean)
        .join(" ");

    const resolved = await resolveLoanContext(supabase, {
      query_text,
      user_id: profile.id,
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
    });

    if (resolved.match_status !== "matched" || !resolved.match) {
      return NextResponse.json({
        ok: true,
        ...resolved,
        bundle: null,
        setup_missing: setup.setup_missing,
        drive: setup.drive,
        connectors: setup.connectors,
      });
    }

    const bundle = await loadLoanMemoryBundle(supabase, resolved.match.loan_memory_id, {
      assistantUserId: profile.id,
      queryText: query_text,
      matchStatus: "matched",
      logRetrieval: true,
    });

    return NextResponse.json({
      ok: true,
      ...resolved,
      bundle,
      setup_missing: setup.setup_missing,
      drive: setup.drive,
      connectors: setup.connectors,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      degraded: true,
      error: "loan_context_unavailable",
      match_status: "no_match",
      bundle: null,
      required_clarification: ["borrower_name", "property_address", "loan_number"],
      setup_missing: setup.setup_missing,
      drive: setup.drive,
      connectors: setup.connectors,
    });
  }
}
