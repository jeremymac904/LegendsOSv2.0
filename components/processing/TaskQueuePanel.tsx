"use client";

// =============================================================================
// TaskQueuePanel — per-loan task list
// =============================================================================
// DATA SOURCE: STUB — loaded from processingStubData.ts
// TODO (DB): replace stub with GET /api/processing/tasks?loanId=xxx
//   Requires migration: loan_tasks table
//   Status transitions should POST to /api/processing/tasks/:id/status
//   Assignment changes should POST to /api/processing/tasks/:id/assign
// =============================================================================

import { useState } from "react";
import { CheckSquare, Square, Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StubTask, TaskStatus } from "./processingStubData";

const STATUS_META: Record<TaskStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  todo: { label: "To do", icon: Square, cls: "text-ink-400" },
  in_progress: { label: "In progress", icon: Clock, cls: "text-status-warn" },
  done: { label: "Done", icon: CheckCircle2, cls: "text-status-ok" },
  blocked: { label: "Blocked", icon: XCircle, cls: "text-status-err" },
};

function TaskRow({ task, onToggleDone }: { task: StubTask; onToggleDone: (id: string) => void }) {
  const meta = STATUS_META[task.status];
  const Icon = meta.icon;
  const isDone = task.status === "done";

  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-ink-200/60 bg-white/40 px-3 py-2 dark:border-ink-800/60 dark:bg-ink-950/40">
      <button
        type="button"
        onClick={() => onToggleDone(task.id)}
        className="mt-0.5 shrink-0 transition-opacity hover:opacity-70"
        aria-label={isDone ? "Mark as to-do" : "Mark as done"}
        title="TODO: persist status change to DB via POST /api/processing/tasks/:id/status"
      >
        {isDone ? (
          <CheckSquare size={15} className="text-status-ok" />
        ) : (
          <Square size={15} className="text-ink-400" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-medium", isDone && "text-ink-400 line-through dark:text-ink-600")}>
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <Icon size={11} className={cn("shrink-0", meta.cls)} />
          <span className={cn("text-[11px]", meta.cls)}>{meta.label}</span>
          {task.dueLabel && (
            <>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">{task.dueLabel}</span>
            </>
          )}
          <span className="text-ink-300 dark:text-ink-700">·</span>
          <span className="text-[11px] text-ink-500 dark:text-ink-400">{task.assignee}</span>
        </div>
      </div>
    </li>
  );
}

export function TaskQueuePanel({ tasks }: { tasks: StubTask[] }) {
  // TODO: replace local toggle with API PATCH to /api/processing/tasks/:id/status
  //       Requires DB migration: loan_tasks(status) update
  const [localTasks, setLocalTasks] = useState<StubTask[]>(tasks);

  function handleToggle(id: string) {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "done" ? "todo" : ("done" as TaskStatus) }
          : t
      )
    );
  }

  const open = localTasks.filter((t) => t.status !== "done");
  const done = localTasks.filter((t) => t.status === "done");

  if (localTasks.length === 0) {
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        No tasks. STUB — connect DB to populate.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
        <AlertTriangle size={11} className="shrink-0" />
        STUB data — connect loan_tasks table to show live tasks.
        Toggle is session-only; DB migration required to persist.
      </p>

      {open.length > 0 && (
        <ul className="space-y-1.5">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} onToggleDone={handleToggle} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-ink-400 hover:text-ink-600 dark:text-ink-500 dark:hover:text-ink-300 select-none">
            {done.length} completed task{done.length !== 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 space-y-1.5 opacity-60">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onToggleDone={handleToggle} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
