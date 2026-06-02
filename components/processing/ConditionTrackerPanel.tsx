"use client";

// =============================================================================
// ConditionTrackerPanel — underwriting conditions per loan
// =============================================================================
// DATA SOURCE: uses both live LoanSummary.conditions (from sampleData/DB) AND
// stub conditions from processingStubData for additional detail.
//
// TODO (DB): loan_conditions table must be populated. Options:
//   1. Manual entry via a future conditions UI (POST /api/processing/conditions)
//   2. Auto-populated by n8n when FLO AI parses the UW decision/AUS findings
//      (workflow 001/002/005 pipeline — need a webhook POST to loan_conditions)
//   3. LOS sync via a future connector
//
// Status transitions: PATCH /api/processing/conditions/:id/status
//   Requires migration: loan_conditions(status) enum (open, in_progress, cleared, waived)
// =============================================================================

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StubCondition } from "./processingStubData";

const SOURCE_LABEL: Record<StubCondition["source"], string> = {
  aus: "AUS",
  uw: "UW",
  lender: "Lender",
  other: "Other",
};

const STATUS_META: Record<StubCondition["status"], { label: string; cls: string }> = {
  open: { label: "Open", cls: "chip-err" },
  in_progress: { label: "In Progress", cls: "chip-warn" },
  cleared: { label: "Cleared", cls: "chip-ok" },
  waived: { label: "Waived", cls: "chip-off" },
};

function ConditionRow({ condition }: { condition: StubCondition }) {
  const status = STATUS_META[condition.status];
  const source = SOURCE_LABEL[condition.source];

  return (
    <li className="flex items-start gap-3 rounded-lg border border-ink-200/60 bg-white/40 px-3 py-2.5 dark:border-ink-800/60 dark:bg-ink-950/40">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[13px] leading-snug text-ink-900 dark:text-ink-100">{condition.description}</p>
        <div className="flex items-center gap-1.5">
          <span className="chip text-[10px]">{source}</span>
          <span className={cn(status.cls, "text-[10px]")}>{status.label}</span>
        </div>
      </div>
      {/* TODO: add an inline status-change dropdown here wired to PATCH /api/processing/conditions/:id/status */}
    </li>
  );
}

export function ConditionTrackerPanel({ conditions }: { conditions: StubCondition[] }) {
  if (conditions.length === 0) {
    return (
      <p className="text-[12px] text-status-ok">No conditions on record. (STUB: connect DB for live conditions)</p>
    );
  }

  const open = conditions.filter((c) => c.status === "open" || c.status === "in_progress");
  const resolved = conditions.filter((c) => c.status === "cleared" || c.status === "waived");

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
        <AlertTriangle size={11} className="shrink-0" />
        STUB — populated from sample data. Connect loan_conditions table for live conditions.
        Status changes are display-only in this build; PATCH endpoint + DB migration required.
      </p>

      {open.length > 0 && (
        <ul className="space-y-1.5">
          {open.map((c) => (
            <ConditionRow key={c.id} condition={c} />
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-ink-400 hover:text-ink-600 dark:text-ink-500 dark:hover:text-ink-300 select-none">
            {resolved.length} resolved
          </summary>
          <ul className="mt-2 space-y-1.5 opacity-60">
            {resolved.map((c) => (
              <ConditionRow key={c.id} condition={c} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
