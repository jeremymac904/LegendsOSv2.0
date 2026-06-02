"use client";

// =============================================================================
// ApprovalQueuePanel — items waiting for Jeremy's approval (global panel)
// =============================================================================
// DATA SOURCE: STUB — loaded from processingStubData.ts
// This panel is NOT loan-scoped. It shows all items across all loans that
// require Jeremy's decision.
//
// TODO (DB / n8n):
//   Requires migration: loan_approval_queue table
//     id uuid PK
//     loan_id uuid FK -> loans.id NULLABLE
//     label text
//     requested_by text
//     requested_at timestamptz
//     status text DEFAULT 'pending' (pending, approved, rejected, deferred)
//     decided_by uuid FK -> profiles.id NULLABLE
//     decided_at timestamptz NULLABLE
//     notes text NULLABLE
//
//   API routes needed:
//     GET /api/processing/approval-queue (list pending)
//     POST /api/processing/approval-queue/:id/approve
//     POST /api/processing/approval-queue/:id/reject
//     POST /api/processing/approval-queue/:id/defer
//
//   Populated by: n8n workflow 020-task-engine-helper when FLO AI flags an
//   exception or escalation that requires Jeremy's decision. Also by Ashley's
//   "request Jeremy review" action (future UI button).
// =============================================================================

import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { StubApprovalItem } from "./processingStubData";

function ApprovalRow({ item }: { item: StubApprovalItem }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-ink-200/60 bg-white/40 px-3 py-2.5 dark:border-ink-800/60 dark:bg-ink-950/40">
      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent-gold" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">{item.label}</p>
        <p className="text-[11px] text-ink-500 dark:text-ink-400">
          Requested by {item.requestedBy} · {item.requestedAt}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {/* TODO: wire to POST /api/processing/approval-queue/:id/approve */}
        <button
          type="button"
          disabled
          className="flex items-center gap-1 rounded-lg border border-status-ok/30 bg-status-ok/10 px-2 py-0.5 text-[10px] text-status-ok opacity-60 cursor-not-allowed"
          title="TODO: requires loan_approval_queue table + API route"
        >
          <CheckCircle2 size={10} /> Approve
        </button>
        {/* TODO: wire to POST /api/processing/approval-queue/:id/reject */}
        <button
          type="button"
          disabled
          className="flex items-center gap-1 rounded-lg border border-status-err/30 bg-status-err/10 px-2 py-0.5 text-[10px] text-status-err opacity-60 cursor-not-allowed"
          title="TODO: requires loan_approval_queue table + API route"
        >
          <XCircle size={10} /> Reject
        </button>
      </div>
    </li>
  );
}

export function ApprovalQueuePanel({ items }: { items: StubApprovalItem[] }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
        <AlertTriangle size={11} className="shrink-0" />
        STUB — populated from sample data. Connect loan_approval_queue table + n8n workflow 020.
        Approve/Reject buttons are disabled until API routes exist.
      </p>

      {items.length === 0 ? (
        <p className="text-[12px] text-status-ok">Nothing awaiting your approval.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <ApprovalRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
