// LegendsOS v2 — Loan Memory: write a memory event (two paths).
// POST /api/loan-memory/events
//
// Path A — STRUCTURED event: body matches WriteEventInput
//   { loan_memory_id, event_type, event_summary, source_*, confidence,
//     optional snapshot advances (main_blocker/next_action/current_stage/
//     priority/*_status) + source_evidence }
//   → writeMemoryEvent(...). created_by is forced to the auth'd profile id.
//
// Path B — PIPELINE UPDATE: body has { loan_memory_id, pipeline_update_text }
//   (instead of a structured event). We validate it's an update via
//   isPipelineUpdate(), derive event fields from extractHints(), write the
//   event, then return the pipelineUpdateConfirmation(...) STRING in `confirmation`.
//
// Quality guardrails live in writeMemoryEvent: protected statuses
// (clear_to_close/closed/denied/suspended/dead) require source_evidence, and
// weaker-confidence notes never overwrite verified memory. Any rejected snapshot
// changes are surfaced to the caller as `blocked_updates`.

import { NextResponse } from "next/server";

import { isPipelineUpdate, extractHints } from "@/lib/loanMemory/detect";
import { writeMemoryEvent, type WriteEventInput } from "@/lib/loanMemory/events";
import type { MemoryEventType } from "@/lib/loanMemory/types";
import { pipelineUpdateConfirmation } from "@/lib/loanMemory/voices";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EventsBody extends Partial<WriteEventInput> {
  pipeline_update_text?: string;
  borrower_name?: string;
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: EventsBody;
  try {
    body = (await req.json()) as EventsBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.loan_memory_id) {
    return NextResponse.json(
      { ok: false, error: "loan_memory_id_required" },
      { status: 400 }
    );
  }

  const client = getSupabaseServerClient();

  // ── Path B: pipeline-update free text ───────────────────────────────────
  if (typeof body.pipeline_update_text === "string" && body.pipeline_update_text.trim()) {
    const text = body.pipeline_update_text;

    if (!isPipelineUpdate(text)) {
      return NextResponse.json(
        {
          ok: false,
          error: "not_a_pipeline_update",
          message:
            "Text was not recognized as a pipeline-update instruction. Use a structured event, or rephrase as an update.",
        },
        { status: 422 }
      );
    }

    const hints = extractHints(text);
    const borrowerName =
      body.borrower_name ?? hints.names[0] ?? "this loan";

    const input: WriteEventInput = {
      loan_memory_id: body.loan_memory_id,
      event_type: (body.event_type as MemoryEventType) ?? "processor_note",
      event_title: body.event_title ?? "Pipeline update",
      event_summary: body.event_summary ?? text,
      source_type: body.source_type ?? "chat",
      source_name: body.source_name ?? profile.id,
      source_timestamp: body.source_timestamp,
      confidence: body.confidence ?? "medium",
      // Snapshot advances only if explicitly provided. We DO NOT infer a
      // protected status from free text — the lib blocks those without evidence.
      next_action: body.next_action,
      main_blocker: body.main_blocker,
      current_stage: body.current_stage,
      priority: body.priority,
      approval_status: body.approval_status,
      appraisal_status: body.appraisal_status,
      title_status: body.title_status,
      insurance_status: body.insurance_status,
      source_evidence: body.source_evidence ?? false,
      created_by: profile.id,
    };

    try {
      const result = await writeMemoryEvent(client, input);
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "write_failed" },
          { status: result.error === "memory_not_found" ? 404 : 200 }
        );
      }

      const status =
        input.current_stage ??
        input.approval_status ??
        "Unknown";
      const missing =
        (result.blocked_updates && result.blocked_updates.length
          ? result.blocked_updates.join("; ")
          : "None");

      const confirmation = pipelineUpdateConfirmation({
        borrowerName,
        status,
        nextAction: input.next_action ?? "Unknown",
        missing,
      });

      return NextResponse.json({
        ok: true,
        mode: "pipeline_update",
        event_id: result.event_id,
        applied_updates: result.applied_updates ?? [],
        blocked_updates: result.blocked_updates ?? [],
        confirmation,
      });
    } catch {
      return NextResponse.json(
        { ok: false, degraded: true, error: "events_unavailable" },
        { status: 200 }
      );
    }
  }

  // ── Path A: structured event ────────────────────────────────────────────
  if (!body.event_type) {
    return NextResponse.json(
      { ok: false, error: "event_type_required" },
      { status: 400 }
    );
  }

  const input: WriteEventInput = {
    loan_memory_id: body.loan_memory_id,
    event_type: body.event_type as MemoryEventType,
    event_title: body.event_title,
    event_summary: body.event_summary,
    source_type: body.source_type,
    source_name: body.source_name,
    source_url_or_path: body.source_url_or_path,
    source_timestamp: body.source_timestamp,
    confidence: body.confidence,
    main_blocker: body.main_blocker,
    next_action: body.next_action,
    current_stage: body.current_stage,
    priority: body.priority,
    approval_status: body.approval_status,
    appraisal_status: body.appraisal_status,
    title_status: body.title_status,
    insurance_status: body.insurance_status,
    source_evidence: body.source_evidence,
    created_by: profile.id, // forced — never trust client-supplied author
  };

  try {
    const result = await writeMemoryEvent(client, input);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "write_failed" },
        { status: result.error === "memory_not_found" ? 404 : 200 }
      );
    }
    return NextResponse.json({
      ok: true,
      mode: "structured_event",
      event_id: result.event_id,
      applied_updates: result.applied_updates ?? [],
      blocked_updates: result.blocked_updates ?? [],
    });
  } catch {
    // Degrade gracefully — table missing / unapplied migration.
    return NextResponse.json(
      { ok: false, degraded: true, error: "events_unavailable" },
      { status: 200 }
    );
  }
}
