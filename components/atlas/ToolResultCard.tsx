"use client";

import {
  BookOpen,
  Calculator,
  Calendar as CalendarIcon,
  Info,
  Mail,
  Scale,
  Share2,
  User,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn, truncate } from "@/lib/utils";
import type {
  AtlasLeadSummaryPayload,
  AtlasLoanComparisonPayload,
  AtlasMortgageCalcPayload,
  AtlasToolMetaKind,
  AtlasToolResultMeta,
  AtlasTriggerAutomationPayload,
} from "@/lib/atlas/types";

interface ToolResultCardProps {
  result: AtlasToolResultMeta;
  createdAt: string;
}

interface KindConfig {
  icon: LucideIcon;
  label: string;
  openLabel: string;
  createdVerb: string;
}

const KIND_CONFIG: Record<AtlasToolMetaKind, KindConfig> = {
  create_social: {
    icon: Share2,
    label: "Social draft",
    openLabel: "Open",
    createdVerb: "Created",
  },
  create_email: {
    icon: Mail,
    label: "Newsletter draft",
    openLabel: "Open",
    createdVerb: "Created",
  },
  create_calendar: {
    icon: CalendarIcon,
    label: "Calendar item",
    openLabel: "Open",
    createdVerb: "Created",
  },
  explain_capabilities: {
    icon: Info,
    label: "Atlas capabilities",
    openLabel: "Settings",
    createdVerb: "Snapshot",
  },
  create_knowledge_note: {
    icon: BookOpen,
    label: "Knowledge note",
    openLabel: "Open",
    createdVerb: "Created",
  },
  mortgage_calc: {
    icon: Calculator,
    label: "Mortgage calc",
    openLabel: "Open",
    createdVerb: "Computed",
  },
  loan_comparison: {
    icon: Scale,
    label: "Loan comparison",
    openLabel: "Open",
    createdVerb: "Computed",
  },
  lead_summary: {
    icon: User,
    label: "Lead summary",
    openLabel: "Open lead",
    createdVerb: "Snapshot",
  },
  trigger_automation: {
    icon: Workflow,
    label: "Automation",
    openLabel: "Open run",
    createdVerb: "Triggered",
  },
};

// Pull the headline title — prefer structured title, else extract the
// first quoted segment, else slice the summary down. Never returns raw JSON.
function deriveTitle(result: AtlasToolResultMeta): string {
  if (result.title && result.title.trim().length > 0) return result.title.trim();
  const quoted = result.summary.match(/"([^"]+)"/);
  if (quoted && quoted[1]) return quoted[1];
  return truncate(result.summary, 60);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatUSD(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatUSDPrecise(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function ToolResultCard({ result, createdAt }: ToolResultCardProps) {
  const config = KIND_CONFIG[result.kind as AtlasToolMetaKind];
  if (!config) return null;
  const Icon = config.icon;
  const title = deriveTitle(result);
  const timeLabel = formatTime(createdAt);

  // Variant-specific bodies. We always render a card; some variants extend
  // it with structured rows beneath the header.
  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-accent-gold/30 bg-accent-gold/5 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent-gold/30 bg-accent-gold/15 text-accent-gold">
          <Icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
            {config.label}
            {timeLabel ? (
              <span className="ml-1.5 font-normal text-ink-300">
                · {config.createdVerb} {timeLabel}
              </span>
            ) : null}
          </p>
          <p className="truncate text-[12px] font-medium text-ink-100">{title}</p>
        </div>
        {result.link && (
          <a
            href={result.link}
            className="btn-secondary h-8 shrink-0 px-2.5 text-[11px]"
            aria-label={`${config.openLabel} ${config.label.toLowerCase()}`}
          >
            {config.openLabel} →
          </a>
        )}
      </div>

      {result.kind === "explain_capabilities" && result.capabilities && (
        <CapabilityRow providers={result.capabilities.providers} />
      )}
      {result.kind === "mortgage_calc" && result.mortgage_calc && (
        <MortgageRow payload={result.mortgage_calc} />
      )}
      {result.kind === "loan_comparison" && result.loan_comparison && (
        <ComparisonRow payload={result.loan_comparison} />
      )}
      {result.kind === "lead_summary" && result.lead_summary && (
        <LeadSummaryRow payload={result.lead_summary} />
      )}
      {result.kind === "trigger_automation" && result.trigger_automation && (
        <AutomationRow payload={result.trigger_automation} />
      )}
    </div>
  );
}

function CapabilityRow({
  providers,
}: {
  providers: { id: string; label: string; status: string; next_action: string | null }[];
}) {
  if (!providers || providers.length === 0) return null;
  return (
    <div className="border-t border-accent-gold/15 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {providers.slice(0, 6).map((p) => (
          <span
            key={p.id}
            title={p.next_action ?? `${p.label} is ${p.status}`}
            className="inline-flex items-center gap-1 rounded-full border border-ink-700/80 bg-ink-900/60 px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.14em] text-ink-300"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                p.status === "ready"
                  ? "bg-status-ok"
                  : p.status === "disabled"
                  ? "bg-status-off"
                  : p.status === "configured"
                  ? "bg-status-info"
                  : "bg-status-warn"
              )}
            />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MortgageRow({ payload }: { payload: AtlasMortgageCalcPayload }) {
  return (
    <div className="border-t border-accent-gold/15 px-3 py-2.5">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        <Stat label="Principal" value={formatUSD(payload.principal)} />
        <Stat label="Rate" value={`${payload.rate_pct.toFixed(3)}%`} />
        <Stat label="Term" value={`${payload.term_years} yrs`} />
        <Stat
          label="Monthly"
          value={formatUSDPrecise(payload.monthly_payment)}
          highlight
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink-800/60 pt-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-400">
          Total interest
        </p>
        <p className="text-[11px] font-semibold text-ink-100">
          {formatUSDPrecise(payload.total_interest)}
        </p>
      </div>
      {payload.notes && (
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-300">
          {payload.notes}
        </p>
      )}
    </div>
  );
}

function ComparisonRow({ payload }: { payload: AtlasLoanComparisonPayload }) {
  return (
    <div className="border-t border-accent-gold/15 px-3 py-2.5">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-ink-400">
        {formatUSD(payload.principal)} · {payload.term_years} yrs
      </p>
      <div className="overflow-hidden rounded-lg border border-ink-800/70">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-ink-900/60 text-[10px] uppercase tracking-[0.14em] text-ink-400">
              <th className="px-2 py-1.5 text-left font-medium">Option</th>
              <th className="px-2 py-1.5 text-right font-medium">Rate</th>
              <th className="px-2 py-1.5 text-right font-medium">APR</th>
              <th className="px-2 py-1.5 text-right font-medium">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {payload.options.map((o, i) => (
              <tr
                key={`${o.label}-${i}`}
                className={cn(
                  "border-t border-ink-800/60",
                  i === 0 && "bg-accent-gold/[0.04]"
                )}
              >
                <td className="px-2 py-1.5 text-ink-100">{o.label}</td>
                <td className="px-2 py-1.5 text-right text-ink-200">
                  {o.rate_pct.toFixed(3)}%
                </td>
                <td className="px-2 py-1.5 text-right text-ink-300">
                  {o.apr_pct != null ? `${o.apr_pct.toFixed(3)}%` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-ink-100">
                  {formatUSDPrecise(o.monthly_payment)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadSummaryRow({ payload }: { payload: AtlasLeadSummaryPayload }) {
  return (
    <div className="border-t border-accent-gold/15 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-700 bg-ink-900/70 text-[12px] font-semibold text-ink-200">
          {payload.lead_name
            .split(/\s+/)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase() ?? "")
            .join("")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-ink-100">
            {payload.lead_name}
          </p>
          <p className="truncate text-[10.5px] uppercase tracking-[0.14em] text-ink-300">
            {payload.status}
            {payload.stage ? ` · ${payload.stage}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {payload.next_step && (
          <Detail label="Next step" value={payload.next_step} />
        )}
        {payload.contact && <Detail label="Contact" value={payload.contact} />}
        {payload.last_activity && (
          <Detail label="Last activity" value={payload.last_activity} />
        )}
      </div>
    </div>
  );
}

function AutomationRow({ payload }: { payload: AtlasTriggerAutomationPayload }) {
  const statusTone =
    payload.status === "succeeded"
      ? "border-status-ok/40 bg-status-ok/10 text-status-ok"
      : payload.status === "failed"
      ? "border-status-err/40 bg-status-err/10 text-status-err"
      : payload.status === "running" || payload.status === "queued"
      ? "border-status-info/40 bg-status-info/10 text-status-info"
      : payload.status === "not_configured"
      ? "border-status-warn/40 bg-status-warn/10 text-status-warn"
      : "border-status-off/40 bg-status-off/10 text-status-off";

  return (
    <div className="border-t border-accent-gold/15 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-400">
            Workflow
          </p>
          <p className="truncate text-[12px] font-medium text-ink-100">
            {payload.workflow_label ?? payload.workflow_id}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-medium uppercase tracking-[0.14em]",
            statusTone
          )}
        >
          {payload.status.replace("_", " ")}
        </span>
      </div>
      {payload.execution_id && (
        <p className="mt-1 truncate text-[10px] text-ink-400">
          Execution: <span className="text-ink-300">{payload.execution_id}</span>
        </p>
      )}
      {payload.message && (
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-300">
          {payload.message}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-400">{label}</p>
      <p
        className={cn(
          "text-[12px] font-semibold",
          highlight ? "text-accent-gold" : "text-ink-100"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-[0.14em] text-ink-400">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink-200">{value}</span>
    </div>
  );
}
