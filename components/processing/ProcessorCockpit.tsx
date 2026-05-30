"use client";

import { useState } from "react";
import { ClipboardList, FileText, FolderOpen, Inbox } from "lucide-react";

import { GeneratorPanel } from "@/components/loanbrain/GeneratorPanel";
import { PriorityPill, StageStatusPill } from "@/components/loanbrain/statusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BoardRow } from "@/lib/loanbrain/store";
import { cn } from "@/lib/utils";

const ASHLEY_KINDS = [
  "processor_handoff",
  "missing_items",
  "ashley_email",
  "condition_plan",
] as const;

const COLUMNS: { key: string; title: string; match: (r: BoardRow) => boolean }[] = [
  { key: "needs", title: "Needs Ashley", match: (r) => r.stageStatus === "blocked" },
  { key: "progress", title: "In progress", match: (r) => r.stageStatus === "working" },
  { key: "done", title: "Done / submitted", match: (r) => r.stageStatus === "done" || r.stageStatus === "seen" },
];

export function ProcessorCockpit({ rows }: { rows: BoardRow[] }) {
  const [selected, setSelected] = useState<BoardRow | null>(rows[0] ?? null);
  const [notes, setNotes] = useState("");

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No files assigned yet"
        description="Processor handoffs will appear here once Jeremy assigns loans to you."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.3fr]">
      {/* Board */}
      <div className="space-y-3">
        {COLUMNS.map((col) => {
          const items = rows.filter(col.match);
          return (
            <div key={col.key} className="card-padded">
              <div className="mb-2 flex items-center justify-between">
                <p className="label">{col.title}</p>
                <span className="chip">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-ink-400">Nothing here.</p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((r) => (
                    <li key={r.folderId}>
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                          selected?.folderId === r.folderId
                            ? "border-accent-champagne/30 bg-ink-800/40"
                            : "border-ink-800 bg-ink-900/40 hover:border-accent-champagne/20"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink-100">
                            {r.borrowerName}
                          </span>
                          <StageStatusPill status={r.stageStatus} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-300">
                          <span>{r.loanProgram ?? "Program TBD"}</span>
                          {r.loanNumber && <span>· #{r.loanNumber}</span>}
                          {r.missingCount > 0 && (
                            <span className="chip-warn">{r.missingCount} missing</span>
                          )}
                          <PriorityPill priority={r.priority} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail */}
      <div className="space-y-4">
        {!selected ? (
          <EmptyState
            icon={ClipboardList}
            title="Pick a file"
            description="Select a loan from your board to see the handoff, documents, and draft tools."
          />
        ) : (
          <>
            <div className="card-padded">
              <div className="section-title">
                <div>
                  <h2 className="flex items-center gap-2">
                    <FolderOpen size={15} className="text-accent-gold" />
                    {selected.borrowerName}
                  </h2>
                  <p>
                    {selected.label} · {selected.stage}
                  </p>
                </div>
                {selected.driveUrl && (
                  <a href={selected.driveUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                    Drive folder
                  </a>
                )}
              </div>
            </div>

            <GeneratorPanel folderId={selected.folderId} allowedKinds={[...ASHLEY_KINDS]} />

            {/* Processor notes — local only, not sent or saved server-side yet */}
            <div className="card-padded">
              <div className="section-title">
                <div>
                  <h2 className="flex items-center gap-2">
                    <FileText size={14} className="text-accent-gold" />
                    Processor notes
                  </h2>
                  <p>Private scratch pad for this file. Local only in this build.</p>
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes about conditions, lender calls, or borrower follow-ups…"
                className="textarea mt-3"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
