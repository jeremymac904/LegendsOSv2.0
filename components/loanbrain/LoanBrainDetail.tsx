"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Eye,
  ExternalLink,
  FileText,
  FlaskConical,
  Folder,
  Layers,
  ListChecks,
  Loader2,
  PenLine,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Tabs, type TabItem } from "@/components/ui/Tabs";
import type {
  DriveConnectionStatus,
  DriveFile,
  DriveFolder,
  GeneratorKind,
  LoanSummary,
} from "@/lib/loanbrain/types";
import { cn } from "@/lib/utils";

import { GeneratorPanel } from "./GeneratorPanel";
import { PriorityPill, StageStatusPill } from "./statusPill";

const PURPOSE: Record<string, string> = {
  purchase: "Purchase",
  rate_term_refinance: "Rate/Term Refi",
  cash_out_refinance: "Cash-Out Refi",
  heloc: "HELOC",
  construction: "Construction",
  other: "Other",
};

const DOC_STATUS_CHIP: Record<string, string> = {
  received: "chip-ok",
  missing: "chip-err",
  pending: "chip-warn",
  waived: "chip-off",
};

function SampleTag() {
  return (
    <span
      className="chip-warn"
      title="Sample data — connect read-only Drive for live files"
    >
      <FlaskConical size={11} className="shrink-0" />
      SAMPLE
    </span>
  );
}

interface LoanBrainDetailProps {
  folder: DriveFolder;
  files: DriveFile[];
  filesLoading: boolean;
  driveStatus: DriveConnectionStatus;
  allowedKinds: GeneratorKind[];
}

/**
 * Right-side detail panel for a selected borrower/loan folder. Organizes the
 * borrower view into the shared Tabs primitive: Summary, Documents, Conditions,
 * Tasks, Drafts (GeneratorPanel), and Drive setup (read-only status). Fetches
 * the loan summary once so the read-only tabs share a single source of truth;
 * the Drafts tab keeps the existing self-contained GeneratorPanel wiring.
 */
export function LoanBrainDetail({
  folder,
  files,
  filesLoading,
  driveStatus,
  allowedKinds,
}: LoanBrainDetailProps) {
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/loanbrain/drive?view=summary&id=${encodeURIComponent(folder.id)}`
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
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [folder.id]);

  useEffect(() => {
    setPreviewFile(null);
    loadSummary();
  }, [loadSummary]);

  // Treat the view as sample whenever Drive is not live OR the loaded summary
  // is explicitly flagged as sample data.
  const isSample = !driveStatus.connected || (summary?.isSample ?? true);

  const tabs: TabItem[] = [
    {
      id: "summary",
      label: "Summary",
      icon: Layers,
      content: (
        <SummaryTab
          summary={summary}
          loading={loading}
          error={error}
          isSample={isSample}
        />
      ),
    },
    {
      id: "documents",
      label: `Documents${files.length ? ` (${files.length})` : ""}`,
      icon: FileText,
      content: (
        <DocumentsTab
          files={files}
          loading={filesLoading}
          previewFile={previewFile}
          onPreview={setPreviewFile}
          driveConnected={driveStatus.connected}
        />
      ),
    },
    {
      id: "conditions",
      label: `Conditions${
        summary?.conditions.length ? ` (${summary.conditions.length})` : ""
      }`,
      icon: ListChecks,
      content: (
        <ConditionsTab summary={summary} loading={loading} isSample={isSample} />
      ),
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: ClipboardList,
      content: (
        <TasksTab summary={summary} loading={loading} isSample={isSample} />
      ),
    },
    {
      id: "drafts",
      label: "Drafts",
      icon: PenLine,
      content: (
        <GeneratorPanel folderId={folder.id} allowedKinds={allowedKinds} />
      ),
    },
    {
      id: "drive",
      label: "Drive setup",
      icon: ShieldCheck,
      content: <DriveSetupTab status={driveStatus} />,
    },
  ];

  return (
    <div className="card-padded">
      <DetailHeader
        folder={folder}
        summary={summary}
        isSample={isSample}
        driveUrl={summary?.driveFolderUrl ?? folder.driveUrl}
      />
      <div className="mt-4">
        <Tabs tabs={tabs} />
      </div>
    </div>
  );
}

function DetailHeader({
  folder,
  summary,
  isSample,
  driveUrl,
}: {
  folder: DriveFolder;
  summary: LoanSummary | null;
  isSample: boolean;
  driveUrl: string | null;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900 dark:text-ink-100">
          <Folder size={15} className="shrink-0 text-accent-gold/80" />
          <span className="truncate">{summary?.borrowerName ?? folder.label}</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">
          {summary
            ? [
                summary.loanProgram ?? "Program TBD",
                summary.loanPurpose
                  ? PURPOSE[summary.loanPurpose] ?? summary.loanPurpose
                  : null,
                summary.loanNumber ? `#${summary.loanNumber}` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : folder.description ?? "Borrower folder"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {summary && <StageStatusPill status={summary.stageStatus} />}
        {summary && <PriorityPill priority={summary.priority} />}
        {isSample && <SampleTag />}
        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost text-xs"
          >
            <ExternalLink size={13} /> Open in Drive
          </a>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Summary tab ------------------------------ */

function SummaryTab({
  summary,
  loading,
  error,
  isSample,
}: {
  summary: LoanSummary | null;
  loading: boolean;
  error: string | null;
  isSample: boolean;
}) {
  if (loading) return <TabLoading label="Loading borrower summary…" />;
  if (error && !summary)
    return (
      <p className="flex items-center gap-2 text-sm text-status-warn">
        <AlertTriangle size={14} /> {error}
      </p>
    );
  if (!summary)
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        No summary available for this folder yet.
      </p>
    );

  const received = summary.documentsReceived.length;
  const missing = summary.documentsMissing.length;
  const openConditions = summary.conditions.filter(
    (c) => c.status.toLowerCase() !== "cleared" && c.status.toLowerCase() !== "satisfied"
  ).length;

  return (
    <div className="space-y-4">
      {isSample && (
        <p className="rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-[11px] text-status-warn">
          SAMPLE overview — figures below are demo data until read-only Drive is
          connected.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Stage" value={summary.stage.replace(/_/g, " ")} />
        <MiniStat label="Docs in" value={String(received)} tone="ok" />
        <MiniStat label="Docs missing" value={String(missing)} tone="warn" />
        <MiniStat
          label="Open conditions"
          value={String(openConditions)}
          tone={openConditions > 0 ? "warn" : "ok"}
        />
      </div>

      {summary.propertyAddress && (
        <Field label="Property">{summary.propertyAddress}</Field>
      )}
      {summary.lender && <Field label="Lender">{summary.lender}</Field>}

      {summary.contacts.length > 0 && (
        <div>
          <p className="label mb-1.5">Contacts</p>
          <ul className="space-y-1">
            {summary.contacts.map((c, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-2 text-xs text-ink-700 dark:text-ink-200"
              >
                <span className="chip">{c.type}</span>
                <span className="font-medium">{c.name ?? "—"}</span>
                {c.company && (
                  <span className="text-ink-500 dark:text-ink-400">{c.company}</span>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="text-accent-gold hover:underline"
                  >
                    {c.email}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.risks.length > 0 && (
        <div>
          <p className="label mb-1.5">Risk flags</p>
          <ul className="space-y-1">
            {summary.risks.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs text-ink-700 dark:text-ink-200"
              >
                <AlertTriangle
                  size={13}
                  className="mt-0.5 shrink-0 text-status-warn"
                />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Documents tab ----------------------------- */

function DocumentsTab({
  files,
  loading,
  previewFile,
  onPreview,
  driveConnected,
}: {
  files: DriveFile[];
  loading: boolean;
  previewFile: DriveFile | null;
  onPreview: (f: DriveFile) => void;
  driveConnected: boolean;
}) {
  if (loading) return <TabLoading label="Loading files…" />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500 dark:text-ink-400">
        Read-only file list.{" "}
        {driveConnected
          ? "Inline preview opens the live read-only file."
          : "Preview is a placeholder until read-only Drive is connected."}
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.4fr]">
        <ul className="space-y-1">
          {files.length === 0 ? (
            <li className="text-xs text-ink-500 dark:text-ink-400">
              No files listed for this folder.
            </li>
          ) : (
            files.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onPreview(f)}
                  aria-pressed={previewFile?.id === f.id}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                    previewFile?.id === f.id
                      ? "border-accent-champagne/40 bg-accent-champagne/10 dark:bg-ink-800/40"
                      : "border-ink-200 bg-white/60 hover:border-accent-champagne/30 dark:border-ink-800 dark:bg-ink-950/40"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText
                      size={13}
                      className="shrink-0 text-ink-500 dark:text-ink-400"
                    />
                    <span className="truncate text-ink-700 dark:text-ink-200">
                      {f.name}
                    </span>
                  </span>
                  <span className={DOC_STATUS_CHIP[f.status] ?? "chip"}>
                    {f.status}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        {previewFile ? (
          <div className="rounded-xl border border-ink-200 bg-white/70 p-4 dark:border-ink-800 dark:bg-ink-950/60">
            <p className="flex items-center gap-2 text-xs font-medium text-ink-700 dark:text-ink-200">
              <Eye size={13} className="text-accent-gold" /> {previewFile.name}
              {previewFile.isSample && <SampleTag />}
            </p>
            {driveConnected && previewFile.driveUrl ? (
              <div className="mt-2 grid h-40 place-items-center rounded-lg border border-ink-200 bg-ink-50/60 text-center dark:border-ink-700 dark:bg-ink-900/40">
                <a
                  href={previewFile.driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs"
                >
                  <ExternalLink size={13} /> Open read-only in Drive
                </a>
              </div>
            ) : (
              <div className="mt-2 grid h-40 place-items-center rounded-lg border border-dashed border-ink-300 bg-ink-50/60 text-center dark:border-ink-700 dark:bg-ink-900/40">
                <div>
                  <FileText
                    size={22}
                    className="mx-auto text-ink-400 dark:text-ink-500"
                  />
                  <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
                    Inline preview placeholder
                  </p>
                  <p className="text-[10px] text-ink-400 dark:text-ink-500">
                    Renders the real file once read-only Drive is connected.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed border-ink-200 p-4 text-center text-[11px] text-ink-500 dark:border-ink-800 dark:text-ink-400">
            Select a file to preview it here.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Conditions tab ---------------------------- */

function ConditionsTab({
  summary,
  loading,
  isSample,
}: {
  summary: LoanSummary | null;
  loading: boolean;
  isSample: boolean;
}) {
  if (loading) return <TabLoading label="Loading conditions…" />;
  if (!summary || summary.conditions.length === 0)
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        No conditions recorded for this loan yet.
      </p>
    );

  return (
    <div className="space-y-3">
      {isSample && (
        <p className="rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-[11px] text-status-warn">
          SAMPLE conditions — not from a live loan. Connect read-only Drive /
          LOS for real condition tracking.
        </p>
      )}
      <ul className="divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
        {summary.conditions.map((c, i) => {
          const cleared =
            c.status.toLowerCase() === "cleared" ||
            c.status.toLowerCase() === "satisfied";
          return (
            <li
              key={i}
              className="flex items-start gap-2.5 bg-white/60 px-3 py-2.5 text-xs dark:bg-ink-950/30"
            >
              {cleared ? (
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-status-ok"
                />
              ) : (
                <Circle size={14} className="mt-0.5 shrink-0 text-status-warn" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-ink-700 dark:text-ink-200">{c.description}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500 dark:text-ink-400">
                  <span className="chip">{c.source}</span>
                  <span
                    className={cleared ? "chip-ok" : "chip-warn"}
                  >
                    {c.status}
                  </span>
                  {c.citationSource && (
                    <span className="text-ink-500 dark:text-ink-400">
                      cite: {c.citationSource}
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------- Tasks tab ------------------------------ */

function TasksTab({
  summary,
  loading,
  isSample,
}: {
  summary: LoanSummary | null;
  loading: boolean;
  isSample: boolean;
}) {
  if (loading) return <TabLoading label="Loading next steps…" />;
  if (!summary)
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        No tasks available for this folder yet.
      </p>
    );

  const hasContent =
    summary.nextSteps.length > 0 || summary.documentsMissing.length > 0;

  if (!hasContent)
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        Nothing outstanding — no next steps or missing items recorded.
      </p>
    );

  return (
    <div className="space-y-4">
      {isSample && (
        <p className="rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-[11px] text-status-warn">
          SAMPLE task list — demo next steps. These are read-only suggestions,
          not a live task tracker.
        </p>
      )}

      {summary.nextSteps.length > 0 && (
        <div>
          <p className="label mb-1.5">Priority next steps</p>
          <ul className="space-y-1.5">
            {summary.nextSteps.map((n, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white/60 px-3 py-2 text-xs text-ink-700 dark:border-ink-800 dark:bg-ink-950/30 dark:text-ink-200"
              >
                <Circle
                  size={13}
                  className="mt-0.5 shrink-0 text-accent-gold/80"
                />
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.documentsMissing.length > 0 && (
        <div>
          <p className="label mb-1.5">Missing items to collect</p>
          <ul className="space-y-1">
            {summary.documentsMissing.map((d, i) => (
              <li
                key={i}
                className="flex items-center gap-1.5 text-xs text-ink-700 dark:text-ink-200"
              >
                <XCircle size={13} className="shrink-0 text-status-warn" />
                {d.name}
                <span className="text-ink-500 dark:text-ink-400">
                  · {d.category}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Drive setup tab --------------------------- */

function DriveSetupTab({ status }: { status: DriveConnectionStatus }) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs",
          status.connected
            ? "border-status-ok/30 bg-status-ok/10 text-status-ok"
            : "border-status-warn/30 bg-status-warn/10 text-status-warn"
        )}
      >
        <span className="flex items-center gap-2 font-semibold uppercase tracking-[0.14em]">
          {status.connected ? (
            <ShieldCheck size={14} />
          ) : (
            <FlaskConical size={14} />
          )}
          {status.connected ? "LIVE — read-only" : "SAMPLE mode"}
        </span>
        <span className="chip">Read-only</span>
      </div>

      <p className="text-xs text-ink-600 dark:text-ink-300">{status.reason}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Root folder">{status.rootFolderLabel}</Field>
        <Field label="Scope needed">{status.scopeNeeded}</Field>
        <Field label="Identity needed">{status.identityNeeded}</Field>
        <Field label="Last checked">
          {status.lastCheckedAt
            ? new Date(status.lastCheckedAt).toLocaleString()
            : "—"}
        </Field>
      </div>

      <div>
        <p className="label mb-1.5">Connection checklist</p>
        <ul className="space-y-1">
          {status.checklist.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs text-ink-700 dark:text-ink-200"
            >
              {item.done ? (
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-status-ok"
                />
              ) : (
                <Circle
                  size={14}
                  className="mt-0.5 shrink-0 text-ink-400 dark:text-ink-500"
                />
              )}
              <span className={item.done ? "" : "text-ink-500 dark:text-ink-400"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {!status.connected && (
        <p className="flex items-start gap-1.5 rounded-lg border border-ink-200 bg-white/60 px-3 py-2 text-[11px] text-ink-600 dark:border-ink-800 dark:bg-ink-950/30 dark:text-ink-300">
          <ShieldCheck size={12} className="mt-0.5 shrink-0 text-accent-gold" />
          The Loan Brain never writes to Drive. Live mode only enables read-only
          access once the checklist above is complete.
        </p>
      )}

      {status.rootFolderUrl && (
        <a
          href={status.rootFolderUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost text-xs"
        >
          <ExternalLink size={13} /> Open pipeline folder in Drive
        </a>
      )}
    </div>
  );
}

/* ------------------------------- helpers -------------------------------- */

function TabLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-4 text-xs text-ink-600 dark:text-ink-300">
      <Loader2 size={14} className="animate-spin" /> {label}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white/60 px-3 py-2 dark:border-ink-800 dark:bg-ink-950/30">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold capitalize",
          tone === "ok"
            ? "text-status-ok"
            : tone === "warn"
            ? "text-status-warn"
            : "text-ink-900 dark:text-ink-100"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-ink-700 dark:text-ink-200">{children}</p>
    </div>
  );
}
