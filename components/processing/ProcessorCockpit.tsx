"use client";

import { useMemo, useState } from "react";
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

// Status filters replace the old 3-column Kanban wall. Each is a compact tab
// over the same queue, so the whole pipeline stays above the fold.
const FILTERS: { key: string; title: string; match: (r: BoardRow) => boolean }[] = [
  { key: "all", title: "All", match: () => true },
  { key: "needs", title: "Needs Ashley", match: (r) => r.stageStatus === "blocked" },
  { key: "progress", title: "In progress", match: (r) => r.stageStatus === "working" },
  { key: "done", title: "Done / submitted", match: (r) => r.stageStatus === "done" || r.stageStatus === "seen" },
];

export function ProcessorCockpit({ rows }: { rows: BoardRow[] }) {
  const [selected, setSelected] = useState<BoardRow | null>(rows[0] ?? null);
  const [filter, setFilter] = useState<string>("all");
  const [notes, setNotes] = useState("");

  const counts = useMemo(
    () =>
      FILTERS.reduce<Record<string, number>>((acc, f) => {
        acc[f.key] = rows.filter(f.match).length;
        return acc;
      }, {}),
    [rows]
  );

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
    return rows.filter(active.match);
  }, [rows, filter]);

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
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.25fr]">
      {/* Queue — compact table with a sticky status filter bar */}
      <div className="card flex min-h-0 flex-col overflow-hidden">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-ink-200 bg-white/85 px-3 py-2.5 backdrop-blur-sm dark:border-ink-800 dark:bg-ink-950/60">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === f.key
                  ? "bg-accent-gold/15 text-ink-900 dark:text-ink-100"
                  : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
              )}
            >
              {f.title}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  filter === f.key
                    ? "bg-accent-gold/20 text-ink-900 dark:text-ink-100"
                    : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400"
                )}
              >
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-6 text-xs text-ink-600 dark:text-ink-400">
            Nothing in this view.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-white/90 backdrop-blur-sm dark:bg-ink-950/70">
                <tr className="border-b border-ink-200 dark:border-ink-800">
                  <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                    Borrower
                  </th>
                  <th className="hidden px-2 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500 sm:table-cell dark:text-ink-400">
                    Program
                  </th>
                  <th className="px-2 py-2 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const isActive = selected?.folderId === r.folderId;
                  return (
                    <tr
                      key={r.folderId}
                      onClick={() => setSelected(r)}
                      className={cn(
                        "cursor-pointer border-b border-ink-100 transition-colors last:border-0 dark:border-ink-800/60",
                        isActive
                          ? "bg-accent-gold/10"
                          : "hover:bg-ink-50 dark:hover:bg-ink-900/50"
                      )}
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-ink-900 dark:text-ink-100">
                            {r.borrowerName}
                          </span>
                          {r.missingCount > 0 && (
                            <span className="chip-warn shrink-0">{r.missingCount} missing</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-600 sm:hidden dark:text-ink-400">
                          <span>{r.loanProgram ?? "Program TBD"}</span>
                          {r.loanNumber && <span>· #{r.loanNumber}</span>}
                        </div>
                      </td>
                      <td className="hidden px-2 py-2 align-top text-[12px] text-ink-700 sm:table-cell dark:text-ink-300">
                        <span>{r.loanProgram ?? "Program TBD"}</span>
                        {r.loanNumber && (
                          <span className="block text-[11px] text-ink-500 dark:text-ink-400">
                            #{r.loanNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <StageStatusPill status={r.stageStatus} />
                          <PriorityPill priority={r.priority} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail */}
      <div className="space-y-4">
        {!selected ? (
          <EmptyState
            icon={ClipboardList}
            title="Pick a file"
            description="Select a loan from your queue to see the handoff, documents, and draft tools."
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
