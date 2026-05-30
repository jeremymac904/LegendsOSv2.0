"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  ShieldAlert,
} from "lucide-react";

import type { GeneratedDraft, GeneratorKind, LoanSummary } from "@/lib/loanbrain/types";
import { cn } from "@/lib/utils";

import { PriorityPill, StageStatusPill } from "./statusPill";

const KIND_LABELS: Record<GeneratorKind, string> = {
  loan_summary: "Loan summary",
  processor_handoff: "Processor handoff",
  missing_items: "Missing items",
  ashley_email: "Ashley email",
  condition_plan: "Condition plan",
  overlay_note: "Overlay risk note",
  pipeline_update: "Pipeline update",
};

const PURPOSE: Record<string, string> = {
  purchase: "Purchase",
  rate_term_refinance: "Rate/Term Refi",
  cash_out_refinance: "Cash-Out Refi",
  heloc: "HELOC",
  construction: "Construction",
  other: "Other",
};

export function GeneratorPanel({
  folderId,
  allowedKinds,
}: {
  folderId: string;
  allowedKinds: GeneratorKind[];
}) {
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [busyKind, setBusyKind] = useState<GeneratorKind | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const res = await fetch(
        `/api/loanbrain/drive?view=summary&id=${encodeURIComponent(folderId)}`
      );
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "No summary available for this folder yet.");
        setSummary(null);
      } else {
        setSummary(data.summary as LoanSummary);
      }
    } catch {
      setError("Could not load the borrower summary. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function generate(kind: GeneratorKind) {
    setBusyKind(kind);
    setCopied(false);
    try {
      const res = await fetch("/api/loanbrain/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, folderId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "Could not generate that draft.");
        return;
      }
      setDraft(data.draft as GeneratedDraft);
    } catch {
      setError("Draft generation failed. Refresh and try again.");
    } finally {
      setBusyKind(null);
    }
  }

  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can be blocked; ignore
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-xs text-ink-300">
        <Loader2 size={14} className="animate-spin" /> Loading borrower summary…
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="card-padded">
        <p className="flex items-center gap-2 text-sm text-status-warn">
          <AlertTriangle size={14} /> {error}
        </p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-4">
      {/* Borrower summary header */}
      <div className="card-padded">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink-100">{summary.borrowerName}</p>
            <p className="text-xs text-ink-300">
              {summary.loanProgram ?? "Program TBD"}
              {summary.loanPurpose ? ` · ${PURPOSE[summary.loanPurpose] ?? summary.loanPurpose}` : ""}
              {summary.loanNumber ? ` · #${summary.loanNumber}` : ""}
            </p>
            {summary.propertyAddress && (
              <p className="mt-0.5 text-xs text-ink-400">{summary.propertyAddress}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StageStatusPill status={summary.stageStatus} />
            <PriorityPill priority={summary.priority} />
            {summary.isSample && (
              <span className="chip-warn" title="Fake borrower — connect read-only Drive for real files">
                SAMPLE
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DocList
            title="Documents received"
            tone="ok"
            items={summary.documentsReceived.map((d) => `${d.name}`)}
            emptyText="None recorded yet."
          />
          <DocList
            title="Documents missing"
            tone="warn"
            items={summary.documentsMissing.map((d) => `${d.name}`)}
            emptyText="Nothing outstanding."
          />
        </div>

        {summary.conditions.length > 0 && (
          <div className="mt-4">
            <p className="label mb-1.5">Conditions</p>
            <ul className="space-y-1">
              {summary.conditions.map((c, i) => (
                <li key={i} className="text-xs text-ink-200">
                  <span className="chip mr-1.5">{c.source}</span>
                  {c.description}
                  <span className="text-ink-400"> — {c.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.nextSteps.length > 0 && (
          <div className="mt-4">
            <p className="label mb-1.5">Priority next steps</p>
            <ul className="list-inside list-disc space-y-0.5 text-xs text-ink-200">
              {summary.nextSteps.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Generators */}
      <div className="card-padded">
        <div className="section-title">
          <div>
            <h2>Generate a draft</h2>
            <p>Every output is a draft for review. Nothing is sent or written to Drive.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {allowedKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => generate(kind)}
              disabled={busyKind !== null}
              className={cn("btn-secondary text-xs", busyKind === kind && "opacity-70")}
            >
              {busyKind === kind ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FileText size={13} />
              )}
              {KIND_LABELS[kind]}
            </button>
          ))}
        </div>

        {draft && (
          <div className="mt-4 rounded-xl border border-accent-champagne/15 bg-ink-950/40 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink-100">{draft.title}</p>
              <button type="button" onClick={copyDraft} className="btn-ghost text-xs">
                <Copy size={13} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-2 space-y-1 rounded-lg border border-status-warn/30 bg-status-warn/10 p-2.5">
              {draft.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px] text-status-warn">
                  <ShieldAlert size={12} className="mt-0.5 shrink-0" /> {w}
                </p>
              ))}
            </div>
            <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-950/60 p-3 text-[12px] leading-relaxed text-ink-200 scrollbar-thin">
{draft.body}
            </pre>
          </div>
        )}
      </div>

      {summary.driveFolderUrl && (
        <a
          href={summary.driveFolderUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost text-xs"
        >
          <ExternalLink size={13} /> Open borrower folder in Drive
        </a>
      )}
    </div>
  );
}

function DocList({
  title,
  tone,
  items,
  emptyText,
}: {
  title: string;
  tone: "ok" | "warn";
  items: string[];
  emptyText: string;
}) {
  return (
    <div>
      <p className="label mb-1.5">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-ink-400">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-ink-200">
              {tone === "ok" ? (
                <CheckCircle2 size={13} className="shrink-0 text-status-ok" />
              ) : (
                <Circle size={13} className="shrink-0 text-status-warn" />
              )}
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
