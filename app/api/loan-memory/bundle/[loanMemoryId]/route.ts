// LegendsOS v2 — Loan Memory: load the full context bundle for one memory.
// GET /api/loan-memory/bundle/[loanMemoryId]
// Returns the LoanMemoryBundle (memory, events, open_tasks, documents,
// email_intake, drive_links, retrieval_summary, sources_checked) and writes a
// loan_ai_retrieval_logs row (audit: what was loaded BEFORE the AI answered).
// 404-style { ok:false } when memory is null (RLS may also hide it → not found).

import { NextResponse } from "next/server";

import { loadLoanMemoryBundle } from "@/lib/loanMemory/bundle";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { loanMemoryId: string } }
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { loanMemoryId } = params;
  if (!loanMemoryId) {
    return NextResponse.json(
      { ok: false, error: "loan_memory_id_required" },
      { status: 400 }
    );
  }

  try {
    const bundle = await loadLoanMemoryBundle(getSupabaseServerClient(), loanMemoryId, {
      assistantUserId: profile.id,
      logRetrieval: true,
    });

    if (!bundle.memory) {
      // Memory missing OR hidden by RLS — treat both as not found.
      return NextResponse.json(
        { ok: false, error: "not_found", retrieval_summary: bundle.retrieval_summary },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, ...bundle });
  } catch {
    // Degrade gracefully — table missing / unapplied migration → clear ok:false.
    return NextResponse.json(
      { ok: false, degraded: true, error: "bundle_unavailable" },
      { status: 200 }
    );
  }
}
