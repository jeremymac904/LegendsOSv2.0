"use client";

import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Mail,
  Phone,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  prompt: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Quick Actions — pre-built Atlas prompts
// ---------------------------------------------------------------------------

// These are prompt starters — they insert text into the Atlas composer for the
// AI to answer. They do NOT query a live rate API, leads table, or automation
// engine, so the labels are framed as "ask/explain" rather than "run/check" to
// avoid implying a real data source exists yet.
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "rate_sheet",
    label: "Explain Rates",
    icon: TrendingDown,
    prompt: "Summarize today's rate environment for conventional, FHA, and VA loans for a 740+ credit score borrower in Florida putting 20% down.",
    color: "text-accent-gold",
  },
  {
    id: "lead_status",
    label: "Underwriting FAQ",
    icon: UserCheck,
    prompt: "What are the most common reasons a mortgage application gets stuck in underwriting, and what should I tell the borrower?",
    color: "text-status-ok",
  },
  {
    id: "draft_email",
    label: "Draft Follow-Up",
    icon: Mail,
    prompt: "Draft a follow-up email to a lead who came in for a pre-qualification 7 days ago and hasn't responded. Keep it warm, short, and include a clear next step.",
    color: "text-accent-orange",
  },
  {
    id: "trigger_automation",
    label: "Ask About Automations",
    icon: Zap,
    prompt: "What automations do I have available in n8n? List them so I can choose one to trigger.",
    color: "text-[#EA4B71]",
  },
];

// ---------------------------------------------------------------------------
// Rate Snapshot — SAMPLE DATA ONLY. These are static placeholder numbers shown
// to illustrate the widget layout. They are NOT a live rate feed. The UI labels
// every instance "Sample — not live". Replace with a real feed when wired.
// ---------------------------------------------------------------------------

interface RateEntry {
  label: string;
  rate: string;
  change: number; // basis points vs yesterday, positive = worse for buyer
}

const MOCK_RATES: RateEntry[] = [
  { label: "30yr Conv", rate: "6.875%", change: -8 },
  { label: "15yr Conv", rate: "6.250%", change: -12 },
  { label: "30yr FHA",  rate: "6.625%", change: -5 },
  { label: "30yr VA",   rate: "6.375%", change: -10 },
];

// ---------------------------------------------------------------------------
// Pipeline Summary — SAMPLE DATA ONLY. Static placeholder counts that show the
// widget shape; they are NOT this user's real leads and are labeled "Sample —
// not live" in the UI. Replace with a live query when a leads table exists.
// ---------------------------------------------------------------------------

interface PipelineStage {
  label: string;
  count: number;
  color: string;
}

const MOCK_PIPELINE: PipelineStage[] = [
  { label: "Pre-qual",    count: 4,  color: "bg-accent-gold" },
  { label: "Processing",  count: 7,  color: "bg-accent-orange" },
  { label: "Underwriting", count: 3, color: "bg-[#EA4B71]" },
  { label: "Clear to Close", count: 2, color: "bg-status-ok" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600 dark:text-ink-300">
        {title}
      </p>
      {open ? (
        <ChevronUp size={11} className="text-ink-500 dark:text-ink-500" />
      ) : (
        <ChevronDown size={11} className="text-ink-500 dark:text-ink-500" />
      )}
    </button>
  );
}

function SampleBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-status-warn/40 bg-status-warn/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-[0.12em] text-status-warn">
      <span className="h-1 w-1 shrink-0 rounded-full bg-status-warn" />
      Sample — not live
    </span>
  );
}

function PipelineCard() {
  const total = MOCK_PIPELINE.reduce((s, p) => s + p.count, 0);
  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-status-warn/30 bg-white/50 dark:bg-ink-900/50 p-2.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Users size={12} className="text-ink-500 dark:text-ink-400" />
            <p className="text-[11px] font-semibold text-ink-900 dark:text-ink-100">Example pipeline</p>
          </div>
          <SampleBadge />
        </div>
        <div className="flex gap-1 mb-2">
          {MOCK_PIPELINE.map((s) => (
            <div
              key={s.label}
              className={cn("h-1.5 flex-1 rounded-full", s.color)}
              style={{ opacity: 0.7 + s.count / total * 0.3 }}
              title={`${s.label}: ${s.count} (sample)`}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {MOCK_PIPELINE.map((s) => (
            <div key={s.label} className="flex items-center gap-1">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.color)} />
              <span className="truncate text-[10px] text-ink-500 dark:text-ink-400">{s.label}</span>
              <span className="ml-auto text-[10px] font-medium text-ink-800 dark:text-ink-200">{s.count}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[9px] italic leading-snug text-ink-700 dark:text-ink-500">
          Setup required for live pipeline. These are placeholder numbers, not your real leads.
        </p>
      </div>
    </div>
  );
}

function RateSheetWidget() {
  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-status-warn/30 bg-white/50 dark:bg-ink-900/50 p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <DollarSign size={12} className="text-ink-500 dark:text-ink-400" />
          <p className="text-[11px] font-semibold text-ink-900 dark:text-ink-100">Example rates</p>
          <span className="ml-auto">
            <SampleBadge />
          </span>
        </div>
        {MOCK_RATES.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-2 py-0.5"
          >
            <span className="text-[10px] text-ink-500 dark:text-ink-400">{r.label}</span>
            <div className="flex items-center gap-1.5">
              {r.change < 0 ? (
                <TrendingDown size={10} className="text-status-ok" />
              ) : r.change > 0 ? (
                <TrendingUp size={10} className="text-status-err" />
              ) : null}
              <span className="text-[11px] font-medium text-ink-900 dark:text-ink-100">{r.rate}</span>
              {r.change !== 0 && (
                <span
                  className={cn(
                    "text-[9px]",
                    r.change < 0 ? "text-status-ok" : "text-status-err"
                  )}
                >
                  {r.change < 0 ? "" : "+"}
                  {r.change}bp
                </span>
              )}
            </div>
          </div>
        ))}
        <p className="mt-1.5 text-[9px] italic leading-snug text-ink-700 dark:text-ink-500">
          Sample numbers, not a live rate feed. Setup required for live rates — always confirm with your lock desk.
        </p>
      </div>
    </div>
  );
}

function QuickActions({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="px-3 pb-3">
      <div className="grid grid-cols-2 gap-1.5">
        {QUICK_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPrompt(a.prompt)}
              className="flex items-center gap-1.5 rounded-lg border border-ink-200/80 dark:border-ink-800/80 bg-white/60 dark:bg-ink-900/60 px-2 py-1.5 text-left text-[10px] text-ink-800 dark:text-ink-200 transition hover:border-accent-gold/30 hover:bg-accent-gold/5 hover:text-ink-900 dark:hover:text-ink-100 active:scale-[0.98]"
            >
              <Icon
                size={11}
                className={cn("shrink-0", a.color ?? "text-ink-500 dark:text-ink-400")}
              />
              <span className="truncate">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalculatorShortcut({ onPrompt }: { onPrompt: (p: string) => void }) {
  const [price, setPrice] = useState("");
  const [down, setDown] = useState("20");
  const [rate, setRate] = useState("6.875");

  function compute() {
    const p = parseFloat(price.replace(/[,$]/g, ""));
    const d = parseFloat(down);
    const r = parseFloat(rate);
    if (!p || !d || !r) return;
    const prompt = `Calculate the monthly principal and interest for a $${p.toLocaleString()} home with ${d}% down at ${r}% interest rate on a 30-year mortgage. Also estimate taxes, insurance, and PMI if applicable. Show total PITI.`;
    onPrompt(prompt);
  }

  return (
    <div className="px-3 pb-3">
      <div className="rounded-lg border border-ink-200/70 dark:border-ink-800/70 bg-white/50 dark:bg-ink-900/50 p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Calculator size={12} className="text-accent-gold" />
          <p className="text-[11px] font-semibold text-ink-900 dark:text-ink-100">Quick Calculator</p>
        </div>
        <div className="space-y-1.5 mb-2">
          <div className="flex items-center gap-1.5">
            <label className="w-14 shrink-0 text-[10px] text-ink-500 dark:text-ink-400">Price</label>
            <input
              type="text"
              placeholder="400,000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="flex-1 rounded border border-ink-200 dark:border-ink-700 bg-ink-100/50 dark:bg-ink-800/50 px-1.5 py-1 text-[10px] text-ink-900 dark:text-ink-100 placeholder:text-ink-700 dark:placeholder:text-ink-600 outline-none focus:border-accent-gold/40"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="w-14 shrink-0 text-[10px] text-ink-500 dark:text-ink-400">Down %</label>
            <input
              type="text"
              placeholder="20"
              value={down}
              onChange={(e) => setDown(e.target.value)}
              className="flex-1 rounded border border-ink-200 dark:border-ink-700 bg-ink-100/50 dark:bg-ink-800/50 px-1.5 py-1 text-[10px] text-ink-900 dark:text-ink-100 placeholder:text-ink-700 dark:placeholder:text-ink-600 outline-none focus:border-accent-gold/40"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="w-14 shrink-0 text-[10px] text-ink-500 dark:text-ink-400">Rate %</label>
            <input
              type="text"
              placeholder="6.875"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="flex-1 rounded border border-ink-200 dark:border-ink-700 bg-ink-100/50 dark:bg-ink-800/50 px-1.5 py-1 text-[10px] text-ink-900 dark:text-ink-100 placeholder:text-ink-700 dark:placeholder:text-ink-600 outline-none focus:border-accent-gold/40"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={compute}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-gold/15 px-3 py-1.5 text-[10px] font-medium text-accent-gold transition hover:bg-accent-gold/25 active:scale-[0.98]"
        >
          <Bot size={10} />
          Ask Atlas to Calculate
          <ArrowRight size={10} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LOWorkspace component
// ---------------------------------------------------------------------------

export function LOWorkspace({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  const [pipelineOpen, setPipelineOpen] = useState(true);
  const [ratesOpen, setRatesOpen] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [calcOpen, setCalcOpen] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      {/* Quick Actions */}
      <div className="border-b border-ink-200 dark:border-ink-800">
        <SectionHeader
          title="Quick Actions"
          open={actionsOpen}
          onToggle={() => setActionsOpen((o) => !o)}
        />
        {actionsOpen && <QuickActions onPrompt={onPrompt} />}
      </div>

      {/* Pipeline — sample data only, clearly labeled inside the card */}
      <div className="border-b border-ink-200 dark:border-ink-800">
        <SectionHeader
          title="Pipeline (sample)"
          open={pipelineOpen}
          onToggle={() => setPipelineOpen((o) => !o)}
        />
        {pipelineOpen && <PipelineCard />}
      </div>

      {/* Rate Sheet — sample data only, clearly labeled inside the card */}
      <div className="border-b border-ink-200 dark:border-ink-800">
        <SectionHeader
          title="Rates (sample)"
          open={ratesOpen}
          onToggle={() => setRatesOpen((o) => !o)}
        />
        {ratesOpen && <RateSheetWidget />}
      </div>

      {/* Calculator */}
      <div className="border-b border-ink-200 dark:border-ink-800">
        <SectionHeader
          title="Calculator"
          open={calcOpen}
          onToggle={() => setCalcOpen((o) => !o)}
        />
        {calcOpen && <CalculatorShortcut onPrompt={onPrompt} />}
      </div>

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}
