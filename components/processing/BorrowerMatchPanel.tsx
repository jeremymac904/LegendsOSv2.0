"use client";

// =============================================================================
// BorrowerMatchPanel — shows incoming documents matched to borrowers
// =============================================================================
// DATA SOURCE: STUB — global list from processingStubData.ts
// This panel is NOT loan-scoped; it shows all recent incoming documents that
// FLO AI has attempted to match to borrowers.
//
// TODO (DB / n8n):
//   Requires migration: loan_borrower_matches table
//     id uuid PK
//     doc_name text
//     email_subject text
//     received_at timestamptz
//     matched_loan_id uuid FK -> loans.id NULLABLE
//     matched_borrower_name text NULLABLE
//     confidence text (high, medium, low, unmatched)
//     resolved_by uuid FK -> profiles.id NULLABLE
//     resolved_at timestamptz NULLABLE
//
//   Populated by: n8n workflow 001 (gmail-intake-ocr-classification) after OCR
//   extracts borrower name from incoming attachment. FLO AI resolves the match
//   via workflow 002 (loan-memory-update) and inserts/updates the row.
//
//   Confirm match: POST /api/processing/borrower-matches/:id/confirm
//   Reject match: POST /api/processing/borrower-matches/:id/reject
// =============================================================================

import { UserCheck, UserX, HelpCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StubBorrowerMatch } from "./processingStubData";

const CONFIDENCE_META: Record<StubBorrowerMatch["confidence"], { label: string; icon: typeof UserCheck; cls: string }> = {
  high: { label: "High confidence", icon: UserCheck, cls: "text-status-ok" },
  medium: { label: "Medium — confirm", icon: HelpCircle, cls: "text-status-warn" },
  low: { label: "Low — review carefully", icon: UserX, cls: "text-status-err" },
  unmatched: { label: "Unmatched — assign manually", icon: UserX, cls: "text-status-err" },
};

function MatchRow({ match }: { match: StubBorrowerMatch }) {
  const meta = CONFIDENCE_META[match.confidence];
  const Icon = meta.icon;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-ink-200/60 bg-white/40 px-3 py-2.5 dark:border-ink-800/60 dark:bg-ink-950/40">
      <Icon size={14} className={cn("mt-0.5 shrink-0", meta.cls)} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">{match.docName}</p>
        {match.matchedTo ? (
          <p className="text-[11px] text-ink-600 dark:text-ink-400">
            → <span className="font-medium text-ink-800 dark:text-ink-200">{match.matchedTo}</span>
          </p>
        ) : (
          <p className="text-[11px] text-status-err">No borrower match found</p>
        )}
        <span className={cn("text-[10px]", meta.cls)}>{meta.label}</span>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {/* TODO: wire to POST /api/processing/borrower-matches/:id/confirm */}
        <button
          type="button"
          disabled
          className="rounded-lg border border-status-ok/30 bg-status-ok/10 px-2 py-0.5 text-[10px] text-status-ok opacity-60 cursor-not-allowed"
          title="TODO: confirm match — requires loan_borrower_matches table + API route"
        >
          Confirm
        </button>
        {/* TODO: wire to POST /api/processing/borrower-matches/:id/reject */}
        <button
          type="button"
          disabled
          className="rounded-lg border border-status-err/30 bg-status-err/10 px-2 py-0.5 text-[10px] text-status-err opacity-60 cursor-not-allowed"
          title="TODO: reject match — requires loan_borrower_matches table + API route"
        >
          Wrong
        </button>
      </div>
    </li>
  );
}

export function BorrowerMatchPanel({ matches }: { matches: StubBorrowerMatch[] }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
        <AlertTriangle size={11} className="shrink-0" />
        STUB — populated from sample data. Connect n8n workflow 001 + loan_borrower_matches table.
        Confirm/Reject buttons are disabled until API route exists.
      </p>

      {matches.length === 0 ? (
        <p className="text-[12px] text-ink-500 dark:text-ink-400">No recent incoming documents.</p>
      ) : (
        <ul className="space-y-1.5">
          {matches.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </ul>
      )}
    </div>
  );
}
