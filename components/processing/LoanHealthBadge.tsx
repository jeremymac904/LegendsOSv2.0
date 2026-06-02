"use client";

// =============================================================================
// LoanHealthBadge — visual health status for a loan row
// =============================================================================
// STUB LOGIC — health is computed from local BoardRow data only (missingCount,
// conditionCount, stageStatus, priority). Once loan_health is a live computed
// column in Supabase or returned by the API, replace the local derivation below.
//
// TODO (DB): add a loan_health view/column that aggregates:
//   - outstanding_conditions count
//   - missing_docs count
//   - days_until_close_date
//   - last_activity_at
// =============================================================================

import { cn } from "@/lib/utils";
import type { BoardRow } from "@/lib/loanbrain/store";

type HealthLevel = "critical" | "at_risk" | "on_track" | "clear";

const HEALTH_META: Record<HealthLevel, { label: string; dot: string; badge: string }> = {
  critical: {
    label: "Critical",
    dot: "bg-status-err",
    badge: "border-status-err/40 bg-status-err/10 text-status-err",
  },
  at_risk: {
    label: "At Risk",
    dot: "bg-status-warn",
    badge: "border-status-warn/40 bg-status-warn/10 text-status-warn",
  },
  on_track: {
    label: "On Track",
    dot: "bg-status-info",
    badge: "border-status-info/40 bg-status-info/10 text-status-info",
  },
  clear: {
    label: "Clear to Close",
    dot: "bg-status-ok",
    badge: "border-status-ok/40 bg-status-ok/10 text-status-ok",
  },
};

// STUB: compute health from available local state.
// TODO: replace with server-side computed value once DB view exists.
function deriveHealth(row: BoardRow): HealthLevel {
  if (row.stageStatus === "blocked" && (row.missingCount > 0 || row.conditionCount > 0)) return "critical";
  if (row.stageStatus === "blocked") return "at_risk";
  if (row.missingCount > 1 || row.conditionCount > 2) return "at_risk";
  if (row.stageStatus === "done" || row.stageStatus === "seen") return "clear";
  if (row.missingCount === 0 && row.conditionCount === 0) return "on_track";
  return "on_track";
}

export function LoanHealthBadge({ row, size = "sm" }: { row: BoardRow; size?: "xs" | "sm" }) {
  const level = deriveHealth(row);
  const meta = HEALTH_META[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium",
        size === "xs" ? "text-[10px]" : "text-[11px]",
        meta.badge
      )}
      title="STUB: health derived from local missingCount/conditionCount. TODO: replace with DB view."
    >
      <span aria-hidden className={cn("inline-block rounded-full", size === "xs" ? "h-1 w-1" : "h-1.5 w-1.5", meta.dot)} />
      {meta.label}
    </span>
  );
}

// Urgency band — color-coded row background for queue list items
export function urgencyClass(row: BoardRow): string {
  const level = deriveHealth(row);
  if (level === "critical") return "border-l-2 border-l-status-err";
  if (level === "at_risk") return "border-l-2 border-l-status-warn";
  if (level === "clear") return "border-l-2 border-l-status-ok";
  return "border-l-2 border-l-transparent";
}
