"use client";

// =============================================================================
// ProcessorCockpit — upgraded with 11 new panels
// =============================================================================
// Local state only (no DB calls from client). All stub data is clearly labeled.
// See individual panel files and processingStubData.ts for TODO/migration notes.
// =============================================================================

import { useState } from "react";
import {
  ClipboardList,
  FolderOpen,
  Inbox,
  ListChecks,
  FileX2,
  GitMerge,
  FileSearch,
  UserCheck,
  ShieldCheck,
  StickyNote,
} from "lucide-react";

import { GeneratorPanel } from "@/components/loanbrain/GeneratorPanel";
import { PriorityPill, StageStatusPill } from "@/components/loanbrain/statusPill";
import { Accordion } from "@/components/ui/Accordion";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BoardRow } from "@/lib/loanbrain/store";
import { cn } from "@/lib/utils";

// New panels
import { LoanHealthBadge, urgencyClass } from "./LoanHealthBadge";
import { PersistentNotesPanel } from "./PersistentNotesPanel";
import { TaskQueuePanel } from "./TaskQueuePanel";
import { MissingDocsPanel } from "./MissingDocsPanel";
import { ConditionTrackerPanel } from "./ConditionTrackerPanel";
import { DocReviewQueuePanel } from "./DocReviewQueuePanel";
import { DriveLinkPanel } from "./DriveLinkPanel";
import { BorrowerMatchPanel } from "./BorrowerMatchPanel";
import { DailyBriefingPanel } from "./DailyBriefingPanel";
import { ApprovalQueuePanel } from "./ApprovalQueuePanel";

// Stub data
import {
  STUB_TASKS,
  STUB_CONDITIONS,
  STUB_DOC_REVIEW,
  STUB_MISSING_DOCS,
  STUB_APPROVAL_QUEUE,
  STUB_BORROWER_MATCHES,
  STUB_DAILY_BRIEFING,
} from "./processingStubData";

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

  // Persistent notes keyed by folderId — survive file switching within the session.
  // TODO (DB): replace with API GET/POST to /api/processing/notes?loanId=xxx
  //            Requires migration: loan_notes table
  const [notesMap, setNotesMap] = useState<Map<string, string>>(new Map());

  function getNote(folderId: string): string {
    return notesMap.get(folderId) ?? "";
  }

  function setNote(folderId: string, value: string) {
    setNotesMap((prev) => {
      const next = new Map(prev);
      next.set(folderId, value);
      return next;
    });
  }

  function selectFile(row: BoardRow) {
    setSelected(row);
    // Notes are NOT cleared on file switch — they persist in the Map
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No files assigned yet"
        description="Processor handoffs will appear here once Jeremy assigns loans to you."
      />
    );
  }

  // Stub data for selected loan
  const selectedTasks = selected ? (STUB_TASKS[selected.folderId] ?? []) : [];
  const selectedConditions = selected ? (STUB_CONDITIONS[selected.folderId] ?? []) : [];
  const selectedDocReview = selected ? (STUB_DOC_REVIEW[selected.folderId] ?? []) : [];
  const selectedMissingDocs = selected ? (STUB_MISSING_DOCS[selected.folderId] ?? []) : [];

  return (
    <div className="space-y-4">
      {/* ── Daily Briefing (top-level, collapsible) ─────────────────────────── */}
      <DailyBriefingPanel briefing={STUB_DAILY_BRIEFING} defaultOpen={false} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* ── LEFT: Queue board ─────────────────────────────────────────────── */}
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
                  <p className="text-xs text-ink-600 dark:text-ink-400">Nothing here.</p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((r) => (
                      <li key={r.folderId}>
                        <button
                          type="button"
                          onClick={() => selectFile(r)}
                          aria-pressed={selected?.folderId === r.folderId}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                            urgencyClass(r), // color-coded urgency border
                            selected?.folderId === r.folderId
                              ? "border-accent-champagne/40 bg-accent-champagne/10 dark:bg-ink-800/40"
                              : "border-ink-200 bg-white/60 hover:border-accent-champagne/30 dark:border-ink-800 dark:bg-ink-950/40"
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                              {r.borrowerName}
                            </span>
                            <span className="block truncate text-[11px] text-ink-600 dark:text-ink-300">
                              {r.loanProgram ?? "Program TBD"}
                              {r.loanNumber ? ` · #${r.loanNumber}` : ""}
                            </span>
                            {/* Loan health badge — STUB logic */}
                            <span className="mt-1 block">
                              <LoanHealthBadge row={r} size="xs" />
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
                            {r.missingCount > 0 && (
                              <span className="chip-warn">{r.missingCount} missing</span>
                            )}
                            {r.conditionCount > 0 && (
                              <span className="chip-err">{r.conditionCount} cond.</span>
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

          {/* ── Global panels (not loan-scoped) ─────────────────────────────── */}
          {/* Approval Queue (Jeremy) */}
          <div className="card-padded">
            <div className="section-title mb-3">
              <div>
                <h2 className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-accent-gold" />
                  Approval queue — Jeremy
                </h2>
                <p>Items requiring Jeremy&apos;s decision across all loans.</p>
              </div>
              <span className="chip-err">{STUB_APPROVAL_QUEUE.length}</span>
            </div>
            <ApprovalQueuePanel items={STUB_APPROVAL_QUEUE} />
          </div>

          {/* Borrower Matching */}
          <div className="card-padded">
            <div className="section-title mb-3">
              <div>
                <h2 className="flex items-center gap-2">
                  <UserCheck size={14} className="text-accent-gold" />
                  Incoming document matches
                </h2>
                <p>Documents received and FLO&apos;s borrower match attempt.</p>
              </div>
              <span className="chip">{STUB_BORROWER_MATCHES.length}</span>
            </div>
            <BorrowerMatchPanel matches={STUB_BORROWER_MATCHES} />
          </div>
        </div>

        {/* ── RIGHT: Detail panels for selected loan ──────────────────────── */}
        <div className="space-y-4">
          {!selected ? (
            <EmptyState
              icon={ClipboardList}
              title="Pick a file"
              description="Select a loan from your board to see the handoff, documents, and draft tools."
            />
          ) : (
            <>
              {/* Header */}
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
                    <div className="mt-1.5">
                      <LoanHealthBadge row={selected} size="sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Accordion of per-loan panels */}
              <Accordion
                allowMultiple
                items={[
                  {
                    id: "drive",
                    title: "Drive folders",
                    icon: FolderOpen,
                    meta: selected.driveUrl ? "Linked" : "Not linked",
                    defaultOpen: true,
                    children: <DriveLinkPanel row={selected} />,
                  },
                  {
                    id: "tasks",
                    title: "Task queue",
                    icon: ListChecks,
                    meta: `${selectedTasks.filter((t) => t.status !== "done").length} open`,
                    defaultOpen: true,
                    children: <TaskQueuePanel tasks={selectedTasks} />,
                  },
                  {
                    id: "missing",
                    title: "Missing documents",
                    icon: FileX2,
                    meta: `${selectedMissingDocs.length}`,
                    defaultOpen: true,
                    children: <MissingDocsPanel docs={selectedMissingDocs} />,
                  },
                  {
                    id: "conditions",
                    title: "Condition tracker",
                    icon: GitMerge,
                    meta: `${selectedConditions.filter((c) => c.status === "open" || c.status === "in_progress").length} open`,
                    defaultOpen: true,
                    children: <ConditionTrackerPanel conditions={selectedConditions} />,
                  },
                  {
                    id: "doc-review",
                    title: "Document review queue",
                    icon: FileSearch,
                    meta: `${selectedDocReview.length}`,
                    defaultOpen: false,
                    children: <DocReviewQueuePanel docs={selectedDocReview} />,
                  },
                  {
                    id: "notes",
                    title: "Processor notes",
                    icon: StickyNote,
                    meta: getNote(selected.folderId).length > 0 ? "Has notes" : "Empty",
                    defaultOpen: false,
                    children: (
                      <PersistentNotesPanel
                        folderId={selected.folderId}
                        value={getNote(selected.folderId)}
                        onChange={(v) => setNote(selected.folderId, v)}
                      />
                    ),
                  },
                ]}
              />

              {/* Generator (AI drafts) */}
              <GeneratorPanel folderId={selected.folderId} allowedKinds={[...ASHLEY_KINDS]} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
