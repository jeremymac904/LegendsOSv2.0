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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
      {/* Board — compact rows */}
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
                <p className="text-xs text-ink-500 dark:text-ink-400">Nothing here.</p>
              ) : (
                <ul className="space-y-1">
                  {items.map((r) => (
                    <li key={r.folderId}>
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        aria-pressed={selected?.folderId === r.folderId}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                          selected?.folderId === r.folderId
                            ? "border-accent-champagne/40 bg-accent-champagne/10 dark:bg-ink-800/40"
                            : "border-ink-200 bg-white/60 hover:border-accent-champagne/30 dark:border-ink-800 dark:bg-ink-950/40"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                            {r.borrowerName}
                          </span>
                          <span className="block truncate text-[11px] text-ink-500 dark:text-ink-300">
                            {r.loanProgram ?? "Program TBD"}
                            {r.loanNumber ? ` · #${r.loanNumber}` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px]">
                          {r.missingCount > 0 && (
                            <span className="chip-warn">{r.missingCount}</span>
                          )}
                          <PriorityPill priority={r.priority} />
                          <StageStatusPill status={r.stageStatus} />
                        </span>
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
