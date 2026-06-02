"use client";

// =============================================================================
// DocReviewQueuePanel — documents pending review or action
// =============================================================================
// DATA SOURCE: STUB — loaded from processingStubData.ts
// TODO (DB): replace with GET /api/processing/doc-review?loanId=xxx
//   Requires migration: loan_documents(review_status) column
//     enum: pending_review, reviewed, needs_request, ordered, waived
//   When a doc is reviewed: PATCH /api/processing/docs/:id/review-status
//   Drive file link: requires loan_documents.drive_file_url to be populated
//     by n8n workflow 004 (attachment-intake) after receiving doc via Gmail
// =============================================================================

import { FileSearch, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StubDocument } from "./processingStubData";

const ACTION_META: Record<StubDocument["pendingAction"], { label: string; cls: string }> = {
  review: { label: "Review", cls: "chip-warn" },
  request: { label: "Need to request", cls: "chip-err" },
  upload: { label: "Upload pending", cls: "chip-info" },
  order: { label: "Order needed", cls: "chip" },
};

export function DocReviewQueuePanel({ docs }: { docs: StubDocument[] }) {
  if (docs.length === 0) {
    return (
      <p className="text-[12px] text-ink-500 dark:text-ink-400">
        No documents pending review. STUB — connect DB for live review queue.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
        <AlertTriangle size={11} className="shrink-0" />
        STUB — populated from sample data. Connect loan_documents table + n8n attachment-intake
        workflow to show real documents. Drive links require drive_file_url column.
      </p>

      <ul className="space-y-1.5">
        {docs.map((doc) => {
          const actionMeta = ACTION_META[doc.pendingAction];
          return (
            <li
              key={doc.id}
              className="flex items-center gap-2.5 rounded-lg border border-ink-200/60 bg-white/40 px-3 py-2 dark:border-ink-800/60 dark:bg-ink-950/40"
            >
              <FileSearch size={13} className="shrink-0 text-ink-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink-900 dark:text-ink-100">{doc.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="chip text-[10px]">{doc.category}</span>
                  <span className={cn(actionMeta.cls, "text-[10px]")}>{actionMeta.label}</span>
                </div>
              </div>
              {/* TODO: replace with real Drive link from loan_documents.drive_file_url */}
              <button
                type="button"
                disabled
                className="shrink-0 rounded-lg border border-ink-200/40 bg-ink-950/20 px-2 py-1 text-[10px] text-ink-400 dark:border-ink-800/40 cursor-not-allowed"
                title="TODO: Drive link requires drive_file_url from DB — n8n attachment-intake workflow must populate loan_documents"
              >
                <ExternalLink size={10} className="inline-block" /> Drive
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
