"use client";

import { useState } from "react";
import { ArrowUpRight, Inbox, UserCheck } from "lucide-react";

import { GeneratorPanel } from "@/components/loanbrain/GeneratorPanel";
import { PriorityPill, StageStatusPill } from "@/components/loanbrain/statusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BoardRow } from "@/lib/loanbrain/store";
import { cn } from "@/lib/utils";

// Geraldine drafts missing-item requests and pipeline updates. "Draft borrower
// message" is served by the missing-items starter. Everything is draft-first.
const COORDINATOR_KINDS = ["missing_items", "pipeline_update"] as const;

const COLUMNS: { key: string; title: string; match: (r: BoardRow) => boolean }[] = [
  { key: "today", title: "Reach out today", match: (r) => r.stageStatus === "blocked" },
  { key: "waiting", title: "Waiting on borrower", match: (r) => r.stageStatus === "working" },
  { key: "handled", title: "Handled", match: (r) => r.stageStatus === "done" || r.stageStatus === "seen" },
];

export function CoordinatorBoard({ rows }: { rows: BoardRow[] }) {
  const [selected, setSelected] = useState<BoardRow | null>(rows[0] ?? null);
  const [notes, setNotes] = useState("");
  const [escalated, setEscalated] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No follow-ups yet"
        description="Leads and borrowers needing follow-up will appear here once they're assigned to you."
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
                          <span className="capitalize">{r.stage}</span>
                          {r.missingCount > 0 && (
                            <span className="chip-warn">{r.missingCount} to collect</span>
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
            icon={UserCheck}
            title="Pick a borrower"
            description="Select someone from your board to draft follow-ups and track document collection."
          />
        ) : (
          <>
            <div className="card-padded">
              <div className="section-title">
                <div>
                  <h2 className="flex items-center gap-2">
                    <UserCheck size={15} className="text-accent-gold" />
                    {selected.borrowerName}
                  </h2>
                  <p>
                    {selected.label} · {selected.stage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEscalated(selected.folderId)}
                  className="btn-secondary text-xs"
                >
                  <ArrowUpRight size={13} /> Escalate to Jeremy
                </button>
              </div>
              {escalated === selected.folderId && (
                <p className="mt-3 rounded-lg border border-status-info/30 bg-status-info/10 px-3 py-2 text-xs text-status-info">
                  Flagged for Jeremy with this file&apos;s context. (No message is sent in this
                  build — this just marks it for his command center.)
                </p>
              )}
            </div>

            <GeneratorPanel folderId={selected.folderId} allowedKinds={[...COORDINATOR_KINDS]} />

            <div className="card-padded">
              <div className="section-title">
                <div>
                  <h2>Pipeline notes</h2>
                  <p>Track status and follow-up history. Local only in this build.</p>
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Called borrower, left voicemail, waiting on bank statements…"
                className="textarea mt-3"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
