"use client";

// =============================================================================
// DailyBriefingPanel — collapsible panel for Ashley's morning briefing from FLO
// =============================================================================
// DATA SOURCE: STUB — content from processingStubData.ts
// TODO (DB / n8n):
//   Requires migration: loan_briefings table
//     id uuid PK
//     briefing_date date UNIQUE
//     body text (markdown)
//     author text (default 'FLO AI')
//     created_at timestamptz
//
//   API route needed: GET /api/processing/briefing?date=today
//   Populated by: n8n workflow 008-morning-briefing (runs 7 AM daily)
//     → calls FLO AI to compile queue summary
//     → POSTs to /api/webhooks/loan-update or a new /api/processing/briefing endpoint
//
//   TODO: when live, fetch on mount and replace STUB_DAILY_BRIEFING import.
// =============================================================================

import { useState } from "react";
import { Sun, ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
// Type mirrors the shape of STUB_DAILY_BRIEFING from processingStubData.ts
type BriefingData = {
  date: string;
  author: string;
  body: string;
};

interface DailyBriefingPanelProps {
  briefing: BriefingData;
  defaultOpen?: boolean;
}

function renderBriefingBody(body: string) {
  // Very lightweight markdown-ish renderer — just bold and bullet points.
  // No external lib needed for this level of formatting.
  return body.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return (
        <p key={i} className="mt-3 text-[12px] font-semibold text-ink-800 dark:text-ink-200 first:mt-0">
          {line.replaceAll("**", "")}
        </p>
      );
    }
    if (line.startsWith("• ")) {
      return (
        <li key={i} className="ml-3 text-[12px] leading-relaxed text-ink-700 dark:text-ink-300">
          {line.replace(/^• /, "").replace(/\*\*(.+?)\*\*/g, "$1")}
        </li>
      );
    }
    if (line.trim() === "") return <br key={i} />;
    return (
      <p key={i} className="text-[12px] leading-relaxed text-ink-700 dark:text-ink-300">
        {line}
      </p>
    );
  });
}

export function DailyBriefingPanel({ briefing, defaultOpen = false }: DailyBriefingPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        open
          ? "border-accent-gold/30 bg-ink-950/40"
          : "border-ink-200 bg-white/60 dark:border-ink-800 dark:bg-ink-950/30"
      )}
    >
      {/* Header button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent-gold/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold/50"
      >
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
            open
              ? "border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
              : "border-ink-200 bg-ink-950/30 text-ink-300 dark:border-ink-800"
          )}
        >
          <Sun size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink-900 dark:text-ink-100">
            Morning briefing — {briefing.date}
          </span>
          <span className="block text-[11px] text-ink-500 dark:text-ink-400">
            {briefing.author}
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            "shrink-0 text-ink-400 transition-transform duration-200",
            open && "rotate-180 text-accent-gold"
          )}
        />
      </button>

      {/* Briefing body */}
      {open && (
        <div className="border-t border-ink-200/60 px-4 py-4 dark:border-ink-800/60">
          {/* STUB notice */}
          <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1.5 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
            <AlertTriangle size={11} className="shrink-0" />
            STUB content — n8n workflow 008-morning-briefing + loan_briefings table required for live briefings.
          </div>
          <ul className="space-y-0">
            {renderBriefingBody(briefing.body)}
          </ul>
        </div>
      )}
    </div>
  );
}
