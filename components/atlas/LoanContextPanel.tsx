"use client";

// LegendsOS v2 — Atlas Loan Context panel.
// A small, non-intrusive panel that shows the loan "memory" Atlas loaded
// before answering a loan-related question. Fed by the loan context object
// the chat API returns when a message resolves to a loan. Renders a subtle
// hint when null so it never takes space uninvited.

import { Brain, FlaskConical, MapPin, ShieldAlert, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

// Compact, nullable context shape returned by the chat route. Kept loose so
// the route can grow fields without breaking the panel.
export interface AtlasLoanContext {
  borrower_name?: string | null;
  loan_number?: string | null;
  current_stage?: string | null;
  last_update?: string | null;
  main_blocker?: string | null;
  sources_checked?: string[] | null;
  match_status?: string | null;
  is_sample?: boolean | null;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "Unknown";
  const s = String(v).trim();
  return s.length ? s : "Unknown";
}

function fmtWhen(v: unknown): string {
  if (!v) return "Unknown";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function LoanContextPanel({ context }: { context: AtlasLoanContext | null | undefined }) {
  if (!context) {
    return (
      <div className="border-t border-ink-200 px-3 py-2 dark:border-ink-800">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400">
          <Brain size={11} /> Loan memory
        </p>
        <p className="mt-1 text-[10.5px] leading-snug text-ink-500 dark:text-ink-500">
          No loan context loaded. Ask a borrower-specific question and Atlas will pull that loan&apos;s memory here.
        </p>
      </div>
    );
  }

  const isSample = context.is_sample === true;
  const sources = context.sources_checked ?? [];

  return (
    <div className="border-t border-ink-200 p-3 dark:border-ink-800">
      <div className="rounded-xl border border-accent-gold/25 bg-accent-gold/[0.06] p-3">
        <div className="flex items-center gap-1.5">
          <Brain size={12} className="text-accent-gold" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">Loaded memory</p>
          {isSample && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-status-warn/30 bg-status-warn/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-status-warn">
              <FlaskConical size={9} /> Sample
            </span>
          )}
        </div>

        <p className="mt-1.5 truncate text-[12.5px] font-semibold text-ink-900 dark:text-ink-100">
          {fmt(context.borrower_name)}
        </p>
        <p className="text-[11px] text-ink-600 dark:text-ink-300">
          {context.loan_number ? `Loan #${context.loan_number}` : "Loan # unknown"}
        </p>

        <dl className="mt-2 space-y-1">
          <Row icon={Sparkles} label="Stage" value={fmt(context.current_stage)} />
          {context.main_blocker && (
            <Row icon={ShieldAlert} label="Blocker" value={context.main_blocker} tone="warn" />
          )}
          <Row icon={MapPin} label="Last update" value={fmtWhen(context.last_update)} />
        </dl>

        {sources.length > 0 && (
          <p className="mt-2 border-t border-ink-200/60 pt-1.5 text-[10px] leading-snug text-ink-500 dark:border-ink-800 dark:text-ink-400">
            Sources checked: {sources.join(", ")}
          </p>
        )}
        {context.match_status && context.match_status !== "matched" && (
          <p className="mt-1 text-[10px] text-status-warn">
            Match: {context.match_status.replace(/_/g, " ")} — Atlas may ask to confirm which borrower.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <Icon size={10} className="shrink-0 text-ink-500 dark:text-ink-400" />
      <span className="shrink-0 text-ink-500 dark:text-ink-400">{label}:</span>
      <span
        className={cn(
          "min-w-0 truncate font-medium",
          tone === "warn" ? "text-status-warn" : "text-ink-900 dark:text-ink-100",
          value === "Unknown" && "font-normal text-ink-500 dark:text-ink-400"
        )}
      >
        {value}
      </span>
    </div>
  );
}
