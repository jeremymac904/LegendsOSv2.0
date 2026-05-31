"use client";

import { useState } from "react";
import { Flag, Inbox, UserCheck } from "lucide-react";

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

export function CoordinatorBoard({
  rows,
  sampleMode = false,
}: {
  rows: BoardRow[];
  sampleMode?: boolean;
}) {
  const [selected, setSelected] = useState<BoardRow | null>(rows[0] ?? null);
  // Per-borrower scratchpad, in-memory only. Keyed by folderId so switching
  // borrowers shows that borrower's note; nothing is persisted (reload clears).
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Local-only "mark for review" flag. This does NOT send or notify anyone — it
  // only toggles a visible reminder in this session. See the button copy below.
  const [marked, setMarked] = useState<string | null>(null);

  // The "Handled" column keys off stageStatus done/seen, which sample leads /
  // prospects never have — so in Sample Mode it is structurally always empty.
  // Hide it (and explain why) rather than show a permanently empty column that
  // implies a flow the user can't complete.
  const columns = sampleMode
    ? COLUMNS.filter((c) => c.key !== "handled")
    : COLUMNS;

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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
      {/* Board — compact rows */}
      <div className="space-y-3">
        {columns.map((col) => {
          const items = rows.filter(col.match);
          return (
            <div key={col.key} className="card-padded">
              <div className="mb-2 flex items-center justify-between">
                <p className="label">{col.title}</p>
                <span className="chip">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-ink-600 dark:text-ink-400">Nothing here.</p>
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
                          <span className="block truncate text-[11px] capitalize text-ink-600 dark:text-ink-300">
                            {r.stage}
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
        {sampleMode && (
          <p className="px-1 text-[11px] leading-relaxed text-ink-600 dark:text-ink-400">
            A <span className="font-medium text-ink-700 dark:text-ink-300">Handled</span> column
            appears here once live leads are connected — completed follow-ups will move into it
            automatically.
          </p>
        )}
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
                  onClick={() =>
                    setMarked((cur) => (cur === selected.folderId ? null : selected.folderId))
                  }
                  aria-pressed={marked === selected.folderId}
                  className="btn-secondary text-xs"
                >
                  <Flag size={13} />
                  {marked === selected.folderId ? "Marked for review" : "Mark for review (not sent)"}
                </button>
              </div>
              {marked === selected.folderId && (
                <p className="mt-3 rounded-lg border border-ink-200 bg-ink-100/60 px-3 py-2 text-xs text-ink-700 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-300">
                  Flagged locally on your screen only. No notification is sent and Jeremy is not
                  alerted — escalation routing isn&apos;t wired up yet. Tap again to clear.
                </p>
              )}
            </div>

            <GeneratorPanel folderId={selected.folderId} allowedKinds={[...COORDINATOR_KINDS]} />

            <div className="card-padded opacity-90">
              <div className="section-title">
                <div>
                  <h2 className="text-ink-700 dark:text-ink-300">Temporary note — not saved</h2>
                  <p>
                    A scratchpad for this session only. It is not stored anywhere and clears when
                    you reload the page.
                  </p>
                </div>
              </div>
              <textarea
                value={notes[selected.folderId] ?? ""}
                onChange={(e) =>
                  setNotes((cur) => ({ ...cur, [selected.folderId]: e.target.value }))
                }
                placeholder="Called borrower, left voicemail, waiting on bank statements…"
                className="textarea mt-3"
                aria-label="Temporary note, not saved"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
