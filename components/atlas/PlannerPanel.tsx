"use client";

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  ListChecks,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { AtlasPlanStep, AtlasPlanStepStatus } from "@/lib/atlas/types";

interface PlannerPanelProps {
  steps?: AtlasPlanStep[] | null;
}

const STATUS_TONE: Record<AtlasPlanStepStatus, string> = {
  queued: "text-ink-300",
  running: "text-accent-gold",
  done: "text-status-ok",
  error: "text-status-err",
};

function StatusIcon({ status }: { status: AtlasPlanStepStatus }) {
  if (status === "queued") return <Circle size={13} aria-label="queued" />;
  if (status === "running")
    return <Loader2 size={13} className="animate-spin" aria-label="running" />;
  if (status === "done") return <CheckCircle2 size={13} aria-label="done" />;
  return <AlertCircle size={13} aria-label="error" />;
}

export function PlannerPanel({ steps }: PlannerPanelProps) {
  const list = steps ?? [];
  return (
    <section
      aria-label="Atlas planner"
      className="card overflow-hidden"
    >
      <header className="flex items-center justify-between gap-2 border-b border-ink-800/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-md border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
          >
            <ListChecks size={12} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              Planner
            </p>
            <p className="text-[10px] text-ink-400">Multi-step task progress</p>
          </div>
        </div>
        {list.length > 0 && (
          <span className="chip h-5 px-1.5 text-[9px]">{list.length} steps</span>
        )}
      </header>

      <div className="px-3 py-2.5">
        {list.length === 0 ? (
          <div className="grid place-items-center gap-1 py-5 text-center">
            <Circle size={14} className="text-ink-500" />
            <p className="text-[11px] font-medium text-ink-200">No active plan</p>
            <p className="text-[10px] text-ink-400">
              Multi-step tasks will show progress here.
            </p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {list.map((step, idx) => {
              const status = (step.status ?? "queued") as AtlasPlanStepStatus;
              return (
                <li
                  key={step.id}
                  className="flex items-start gap-2 rounded-lg border border-ink-800/70 bg-ink-900/40 px-2 py-1.5"
                >
                  <span
                    className={cn(
                      "mt-[2px] inline-flex shrink-0",
                      STATUS_TONE[status]
                    )}
                  >
                    <StatusIcon status={status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-medium leading-tight text-ink-100">
                      <span className="mr-1 text-ink-400">{idx + 1}.</span>
                      {step.label}
                    </p>
                    {step.detail && (
                      <p
                        className={cn(
                          "mt-0.5 truncate text-[10px] leading-snug",
                          status === "error" ? "text-status-err" : "text-ink-300"
                        )}
                        title={step.detail}
                      >
                        {step.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
