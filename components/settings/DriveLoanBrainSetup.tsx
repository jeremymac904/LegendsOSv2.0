"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import type { DriveConnectionStatus } from "@/lib/loanbrain/types";
import { cn } from "@/lib/utils";

export function DriveLoanBrainSetup() {
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // READ-ONLY status check. This GET only reflects getDriveConnectionStatus()
      // on the server (presence of OAuth env names + opt-in flag). It never
      // writes, moves, renames, uploads, or deletes anything in Drive.
      const res = await fetch("/api/loanbrain/drive?view=status");
      const data = await res.json();
      if (data.ok && data.status) {
        setStatus(data.status as DriveConnectionStatus);
      } else {
        setError("Could not load connection status.");
      }
    } catch {
      setError("Could not reach the connection status check.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function testConnection() {
    // Honest report based purely on the server-rendered status — no live writes.
    // Re-fetches the read-only ?view=status endpoint, which reflects
    // getDriveConnectionStatus() (OAuth env presence + opt-in flag).
    setTesting(true);
    await load();
    setTesting(false);
  }

  const isLive = status?.connected === true;

  return (
    <section className="card-padded" id="drive-loan-brain">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2 text-ink-900 dark:text-ink-100">
            <ShieldCheck size={15} className="text-accent-gold" />
            Google Drive Loan Brain
          </h2>
          <p className="text-ink-600 dark:text-ink-300">
            Read-only connection to the Jeremy Applicants Pipeline. Never writes to Drive.
          </p>
        </div>
        {status && <ModeBadge live={isLive} />}
      </div>

      {/* Read-only warning — always visible */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-status-info/30 bg-status-info/10 px-3 py-2.5 text-xs text-status-info">
        <Lock size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>Read-only by design.</strong> LegendsOS can browse and summarize borrower
          files. It never moves, renames, uploads, overwrites, or deletes anything in Drive,
          and it never sends email from here.
        </span>
      </div>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
          <Loader2 size={14} className="animate-spin" /> Checking connection…
        </p>
      ) : status ? (
        <>
          {/* Prominent mode summary line */}
          <div
            className={cn(
              "mt-4 rounded-xl border px-3 py-2.5 text-xs",
              isLive
                ? "border-status-ok/30 bg-status-ok/10 text-status-ok"
                : "border-status-warn/30 bg-status-warn/10 text-status-warn"
            )}
          >
            <strong>{isLive ? "Live read-only mode." : "Sample mode."}</strong>{" "}
            {isLive
              ? "Connected to Google Drive read-only. Loan Brain reads live folder metadata."
              : "Live OAuth not yet connected — running on safe SAMPLE data until connected."}
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <dt className="text-ink-500 dark:text-ink-400">Status</dt>
            <dd className="col-span-2 text-ink-700 dark:text-ink-200">{status.reason}</dd>
            <dt className="text-ink-500 dark:text-ink-400">Identity needed</dt>
            <dd className="col-span-2 text-ink-700 dark:text-ink-200">{status.identityNeeded}</dd>
            <dt className="text-ink-500 dark:text-ink-400">Scope needed</dt>
            <dd className="col-span-2 text-ink-700 dark:text-ink-200">{status.scopeNeeded}</dd>
            <dt className="text-ink-500 dark:text-ink-400">Pipeline folder</dt>
            <dd className="col-span-2">
              {status.rootFolderUrl ? (
                <a
                  href={status.rootFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent-gold hover:underline"
                >
                  {status.rootFolderLabel} (read-only) <ExternalLink size={11} />
                </a>
              ) : (
                <span className="text-ink-500 dark:text-ink-400">Connected path needed</span>
              )}
            </dd>
          </dl>

          <div className="mt-4">
            <p className="label mb-2">Setup checklist</p>
            <ul className="space-y-1.5">
              {status.checklist.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs text-ink-700 dark:text-ink-200"
                >
                  {item.done ? (
                    <CheckCircle2 size={14} className="shrink-0 text-status-ok" />
                  ) : (
                    <Circle size={14} className="shrink-0 text-ink-400 dark:text-ink-500" />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="btn-secondary text-xs"
            >
              {testing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Test connection
            </button>
            <span className="text-[11px] text-ink-500 dark:text-ink-400">
              {isLive
                ? "Read-only check confirmed connected."
                : "Read-only check — reports connected vs. not connected. No Drive writes."}
            </span>
          </div>

          {!isLive && (
            <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
              Disabled features stay off until all checklist items are green. To go live:
              add the Google OAuth client, request a read-only scope, share the pipeline
              folder read-only, then set the owner opt-in flag.
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-xs text-status-warn">
          {error ?? "Could not load connection status."}
        </p>
      )}
    </section>
  );
}

function ModeBadge({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        live
          ? "border-status-ok/40 bg-status-ok/15 text-status-ok"
          : "border-status-warn/40 bg-status-warn/15 text-status-warn"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          live ? "bg-status-ok" : "bg-status-warn"
        )}
      />
      {live ? "Live" : "Sample"}
    </span>
  );
}
