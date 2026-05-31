"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Inbox, UserCheck } from "lucide-react";

import { GeneratorPanel } from "@/components/loanbrain/GeneratorPanel";
import { PriorityPill, StageStatusPill } from "@/components/loanbrain/statusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BoardRow } from "@/lib/loanbrain/store";
import { cn } from "@/lib/utils";

// Geraldine drafts missing-item requests and pipeline updates. "Draft borrower
// message" is served by the missing-items starter. Everything is draft-first.
const COORDINATOR_KINDS = ["missing_items", "pipeline_update"] as const;

// Compact follow-up filters. Replaces the old three-column Kanban card wall with
// a single dense list + segmented status filter, so Geraldine sees the whole
// queue above the fold and drills into a detail panel on the right.
type FilterKey = "all" | "today" | "waiting" | "handled";

const FILTERS: { key: FilterKey; title: string; match: (r: BoardRow) => boolean }[] = [
  { key: "all", title: "All", match: () => true },
  { key: "today", title: "Reach out today", match: (r) => r.stageStatus === "blocked" },
  { key: "waiting", title: "Waiting", match: (r) => r.stageStatus === "working" },
  {
    key: "handled",
    title: "Handled",
    match: (r) => r.stageStatus === "done" || r.stageStatus === "seen",
  },
];

export function CoordinatorBoard({ rows }: { rows: BoardRow[] }) {
  const [selected, setSelected] = useState<BoardRow | null>(rows[0] ?? null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [notes, setNotes] = useState("");
  const [escalated, setEscalated] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = {} as Record<FilterKey, number>;
    for (const f of FILTERS) map[f.key] = rows.filter(f.match).length;
    return map;
  }, [rows]);

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const visible = useMemo(() => rows.filter(activeFilter.match), [rows, activeFilter]);

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
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      {/* Follow-up queue — compact filterable list */}
      <div className="card-padded flex flex-col">
        {/* Segmented status filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                filter === f.key
                  ? "border-accent-champagne/40 bg-accent-gold/10 text-ink-900 dark:text-ink-100"
                  : "border-ink-200 text-ink-600 hover:border-accent-champagne/30 dark:border-ink-800 dark:text-ink-300"
              )}
            >
              {f.title}
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  filter === f.key
                    ? "bg-accent-gold/20 text-ink-900 dark:text-ink-100"
                    : "bg-ink-100 text-ink-600 dark:bg-ink-800/60 dark:text-ink-300"
                )}
              >
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Dense scrollable list — only this list scrolls, not the page */}
        <div className="mt-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {visible.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-ink-600 dark:text-ink-400">
              Nothing in {activeFilter.title.toLowerCase()}.
            </p>
          ) : (
            <ul className="divide-y divide-ink-200 dark:divide-ink-800/70">
              {visible.map((r) => (
                <li key={r.folderId}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                      selected?.folderId === r.folderId
                        ? "bg-accent-gold/10 ring-1 ring-inset ring-accent-champagne/30"
                        : "hover:bg-ink-100/70 dark:hover:bg-ink-800/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                        {r.borrowerName}
                      </span>
                      <StageStatusPill status={r.stageStatus} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-700 dark:text-ink-300">
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
      </div>

      {/* Detail */}
      <div className="space-y-4">
        {!selected ? (
          <EmptyState
            icon={UserCheck}
            title="Pick a borrower"
            description="Select someone from your queue to draft follow-ups and track document collection."
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
