"use client";

// =============================================================================
// MissingDocsPanel — checklist of required documents per loan
// =============================================================================
// DATA SOURCE: STUB — loaded from processingStubData.ts
// TODO (DB): replace with GET /api/processing/missing-docs?loanId=xxx
//   Cross-reference loan_documents (received) against loan_program_doc_checklist
//   Requires migration:
//     - loan_program_doc_checklist(program, doc_name, category, required)
//     - or simply use loan_documents where status = 'missing'
//   When a doc is marked received, UPDATE loan_documents SET status='received'
//   via POST /api/processing/docs/:id/received
// =============================================================================

import { useState } from "react";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StubMissingDoc } from "./processingStubData";

const CATEGORY_LABEL: Record<string, string> = {
  assets: "Assets",
  income: "Income",
  credit: "Credit",
  hoi: "HOI",
  title: "Title",
  property: "Property",
  application: "Application",
  conditions: "Conditions",
  aus: "AUS",
  disclosures: "Disclosures",
  correspondence: "Correspondence",
  other: "Other",
};

export function MissingDocsPanel({ docs }: { docs: StubMissingDoc[] }) {
  // TODO: replace local received toggle with POST /api/processing/docs/:id/received
  //       Requires DB migration: loan_documents.status update
  const [receivedIds, setReceivedIds] = useState<Set<string>>(new Set());

  function toggleReceived(id: string) {
    setReceivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const outstanding = docs.filter((d) => !receivedIds.has(d.id));
  const received = docs.filter((d) => receivedIds.has(d.id));

  if (docs.length === 0) {
    return (
      <p className="text-[12px] text-status-ok">
        No missing documents — file looks complete! (STUB: connect DB for live checklist)
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
        <AlertTriangle size={11} className="shrink-0" />
        STUB data — connect loan_documents / loan_program_doc_checklist tables for live missing-doc list.
        Checkboxes here are session-only; DB update required to persist.
      </p>

      {outstanding.length > 0 && (
        <ul className="space-y-1.5">
          {outstanding.map((doc) => (
            <li key={doc.id} className="flex items-start gap-2.5 rounded-lg border border-status-err/20 bg-status-err/5 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleReceived(doc.id)}
                className="mt-0.5 shrink-0 transition-opacity hover:opacity-70"
                aria-label="Mark as received"
                title="TODO: persist to DB via POST /api/processing/docs/:id/received"
              >
                <Circle size={14} className="text-status-err" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">{doc.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="chip-err text-[10px]">{CATEGORY_LABEL[doc.category] ?? doc.category}</span>
                  {doc.required && <span className="text-[10px] text-status-err">Required</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {received.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] text-ink-400 dark:text-ink-500">Marked received this session:</p>
          <ul className="space-y-1.5 opacity-60">
            {received.map((doc) => (
              <li key={doc.id} className="flex items-start gap-2.5 rounded-lg border border-status-ok/20 bg-status-ok/5 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleReceived(doc.id)}
                  className="mt-0.5 shrink-0 transition-opacity hover:opacity-70"
                  aria-label="Unmark received"
                >
                  <CheckCircle2 size={14} className="text-status-ok" />
                </button>
                <p className={cn("text-[13px] font-medium text-ink-600 line-through dark:text-ink-400")}>
                  {doc.name}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
