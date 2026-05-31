"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Search,
} from "lucide-react";

import { PriorityPill, StageStatusPill } from "@/components/loanbrain/statusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

// Atlas hand-off contract: write the composed prompt to sessionStorage under
// this EXACT key, then navigate to /atlas. AtlasWorkspace consumes it on mount.
const ATLAS_PENDING_PROMPT_KEY = "atlas:pendingPrompt";

// Serializable row shape passed from the server page. Mirrors the store's
// BoardRow but kept local so this component is self-contained and client-safe.
export type MyLoanRow = {
  folderId: string;
  borrowerName: string;
  loanNumber: string | null;
  loanProgram: string | null;
  stage: string;
  stageStatus: string;
  priority: string;
  missingCount: number;
  conditionCount: number;
  driveUrl: string | null;
  nextStep: string | null;
};

function composeAtlasPrompt(row: MyLoanRow): string {
  const lines = [
    `Help me with my loan for ${row.borrowerName}.`,
    "",
    `Program: ${row.loanProgram ?? "TBD"}`,
    row.loanNumber ? `Loan #: ${row.loanNumber}` : null,
    `Stage: ${row.stage}`,
    `Status: ${row.stageStatus}`,
    `Priority: ${row.priority}`,
    row.missingCount > 0 ? `Missing documents: ${row.missingCount}` : null,
    row.conditionCount > 0 ? `Open conditions: ${row.conditionCount}` : null,
    row.nextStep ? `Next step: ${row.nextStep}` : null,
    "",
    "Draft a short, friendly borrower update I can review before sending, or explain what this stage means in plain language.",
  ].filter(Boolean);
  return lines.join("\n");
}

export function MyLoansView({ rows }: { rows: MyLoanRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    rows[0]?.folderId ?? null,
  );
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.borrowerName} ${r.loanProgram ?? ""} ${r.loanNumber ?? ""} ${r.stage}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const selected = useMemo(
    () =>
      filtered.find((r) => r.folderId === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  function sendToAtlas(row: MyLoanRow) {
    const prompt = composeAtlasPrompt(row);
    try {
      window.sessionStorage.setItem(ATLAS_PENDING_PROMPT_KEY, prompt);
    } catch {
      // sessionStorage unavailable — still navigate; Atlas opens empty.
    }
    router.push("/atlas");
  }

  async function copyPrompt(row: MyLoanRow) {
    const prompt = composeAtlasPrompt(row);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = prompt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing more we can do */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No loans assigned yet"
        description="When Jeremy assigns you a loan, it shows up here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* Left: searchable, clickable loan list */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-200 px-3 py-2.5 dark:border-ink-800">
          <Search size={14} className="shrink-0 text-ink-500 dark:text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your loans…"
            className="w-full bg-transparent text-sm text-ink-900 placeholder:text-ink-500 focus:outline-none dark:text-ink-100 dark:placeholder:text-ink-400"
          />
          <span className="shrink-0 text-[11px] tabular-nums text-ink-500 dark:text-ink-400">
            {filtered.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-600 dark:text-ink-400">
            No loans match “{query}”.
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-ink-200 overflow-y-auto scrollbar-thin dark:divide-ink-800">
            {filtered.map((r) => {
              const isActive = selected?.folderId === r.folderId;
              return (
                <li key={r.folderId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.folderId)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors",
                      isActive
                        ? "bg-accent-gold/10"
                        : "hover:bg-ink-100/70 dark:hover:bg-ink-800/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
                        {r.borrowerName}
                      </p>
                      <p className="truncate text-xs text-ink-600 dark:text-ink-400">
                        {r.loanProgram ?? "Program TBD"}
                        {r.loanNumber ? ` · #${r.loanNumber}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="chip capitalize">{r.stage}</span>
                        {r.missingCount > 0 && (
                          <span className="chip-warn">{r.missingCount} missing</span>
                        )}
                      </div>
                    </div>
                    <StageStatusPill status={r.stageStatus} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Right: detail panel for the selected loan */}
      {selected ? (
        <div className="card-padded flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-ink-900 dark:text-ink-100">
                {selected.borrowerName}
              </h2>
              <p className="text-xs text-ink-600 dark:text-ink-400">
                {selected.loanProgram ?? "Program TBD"}
                {selected.loanNumber ? ` · #${selected.loanNumber}` : ""}
              </p>
            </div>
            <StageStatusPill status={selected.stageStatus} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            <div>
              <dt className="label">Stage</dt>
              <dd className="mt-0.5 capitalize text-ink-800 dark:text-ink-200">
                {selected.stage}
              </dd>
            </div>
            <div>
              <dt className="label">Priority</dt>
              <dd className="mt-0.5">
                <PriorityPill priority={selected.priority} />
              </dd>
            </div>
            <div>
              <dt className="label">Missing docs</dt>
              <dd className="mt-0.5 tabular-nums text-ink-800 dark:text-ink-200">
                {selected.missingCount}
              </dd>
            </div>
            <div>
              <dt className="label">Open conditions</dt>
              <dd className="mt-0.5 tabular-nums text-ink-800 dark:text-ink-200">
                {selected.conditionCount}
              </dd>
            </div>
          </dl>

          {selected.nextStep && (
            <div className="rounded-xl border border-ink-200 bg-ink-100/60 p-3 dark:border-ink-800 dark:bg-ink-950/50">
              <p className="label">Next step</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                {selected.nextStep}
              </p>
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-ink-200 pt-3 dark:border-ink-800">
            <button
              type="button"
              onClick={() => sendToAtlas(selected)}
              className="btn-primary"
            >
              <MessageCircle size={14} /> Ask Atlas
            </button>
            <button
              type="button"
              onClick={() => copyPrompt(selected)}
              className="btn-secondary"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy prompt"}
            </button>
            {selected.driveUrl ? (
              <a
                href={selected.driveUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                <ExternalLink size={14} /> Drive folder
              </a>
            ) : (
              <span className="chip-off" title="No Drive folder linked for this loan">
                No Drive folder
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
