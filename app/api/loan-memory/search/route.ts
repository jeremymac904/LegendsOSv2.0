// LegendsOS v2 — Loan Brain searchable memory list.
// GET /api/loan-memory/search?q=&filter=
// RLS-scoped read-only listing for the Loan Brain cockpit. No sample rows are
// invented here; if no real memory is visible, the response says what is
// missing so the UI can fall back honestly.

import { NextResponse } from "next/server";

import { connectorsSnapshot } from "@/lib/loanMemory/connectors";
import type { LoanMemory } from "@/lib/loanMemory/types";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  isMissingDatabaseObjectError,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Filter = "all" | "active" | "leads" | "prospects" | "past_clients";

function filterForStage(stage: string | null): Filter {
  const s = (stage ?? "").toLowerCase();
  if (s === "lead") return "leads";
  if (s === "prospect") return "prospects";
  if (s === "past_client" || s === "closed" || s === "funded") return "past_clients";
  return "active";
}

function matchesQuery(memory: LoanMemory, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    memory.borrower_name,
    memory.co_borrower_name,
    memory.loan_number,
    memory.property_address,
    memory.current_stage,
    memory.lender,
    memory.source_file,
    memory.source_summary,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function setupMissing() {
  const drive = getDriveConnectionStatus();
  const connectors = connectorsSnapshot();
  const missing: string[] = [];
  if (process.env.LOAN_MEMORY_ENABLED !== "true") {
    missing.push("Set LOAN_MEMORY_ENABLED=true after applying the Loan Memory migrations.");
  }
  if (!connectors.supabaseConfigured) {
    missing.push("Configure Supabase env vars so authenticated RLS reads can run.");
  }
  if (!drive.connected) {
    missing.push(drive.reason);
  }
  if (!connectors.gmailIntake.active) {
    missing.push(connectors.gmailIntake.note);
  }
  return { drive, connectors, missing };
}

export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q") ?? "";
  const filter = (url.searchParams.get("filter") ?? "all") as Filter;
  const limitParam = Number(url.searchParams.get("limit") ?? "150");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 250) : 150;
  const setup = setupMissing();

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("loan_memory")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingDatabaseObjectError(error)) {
        return NextResponse.json({
          ok: true,
          source: "setup_needed",
          memories: [],
          setup_missing: [
            "Apply supabase/migrations/20260531100000_loan_memory.sql and 20260531100100_loan_memory_rls.sql.",
            ...setup.missing,
          ],
          drive: setup.drive,
          connectors: setup.connectors,
        });
      }
      return NextResponse.json({
        ok: false,
        source: "error",
        error: "memory_search_failed",
        memories: [],
        setup_missing: setup.missing,
        drive: setup.drive,
        connectors: setup.connectors,
      });
    }

    const memories = ((data ?? []) as LoanMemory[])
      .filter((memory) => matchesQuery(memory, query))
      .filter((memory) => filter === "all" || filterForStage(memory.current_stage) === filter)
      .map((memory) => ({
        id: memory.id,
        loan_id: memory.loan_id,
        borrower_name: memory.borrower_name,
        co_borrower_name: memory.co_borrower_name,
        loan_number: memory.loan_number,
        property_address: memory.property_address,
        current_stage: memory.current_stage,
        main_blocker: memory.main_blocker,
        next_action: memory.next_action,
        primary_loan_officer: memory.primary_loan_officer,
        processor: memory.processor,
        loan_coordinator: memory.loan_coordinator,
        confidence: memory.confidence,
        priority: memory.priority,
        updated_at: memory.updated_at,
        last_known_activity: memory.last_known_activity,
        category: filterForStage(memory.current_stage),
        is_sample: memory.is_sample,
      }));

    return NextResponse.json({
      ok: true,
      source: memories.length ? "loan_memory" : "empty",
      memories,
      setup_missing: memories.length ? setup.missing.filter((item) => !item.includes("LOAN_MEMORY_ENABLED")) : setup.missing,
      drive: setup.drive,
      connectors: setup.connectors,
    });
  } catch (error) {
    if (isMissingDatabaseObjectError(error)) {
      return NextResponse.json({
        ok: true,
        source: "setup_needed",
        memories: [],
        setup_missing: [
          "Apply the Loan Memory database migrations.",
          ...setup.missing,
        ],
        drive: setup.drive,
        connectors: setup.connectors,
      });
    }
    return NextResponse.json({
      ok: false,
      source: "error",
      error: "memory_search_unavailable",
      memories: [],
      setup_missing: setup.missing,
      drive: setup.drive,
      connectors: setup.connectors,
    });
  }
}
