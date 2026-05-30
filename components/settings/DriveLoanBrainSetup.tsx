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
import { StatusPill } from "@/components/ui/StatusPill";

export function DriveLoanBrainSetup() {
  const [status, setStatus] = useState<DriveConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loanbrain/drive?view=status");
      const data = await res.json();
      if (data.ok) setStatus(data.status as DriveConnectionStatus);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function testConnection() {
    setTesting(true);
    await load();
    setTesting(false);
  }

  return (
    <section className="card-padded" id="drive-loan-brain">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-accent-gold" />
            Google Drive Loan Brain
          </h2>
          <p>Read-only connection to the Jeremy Applicants Pipeline. Never writes to Drive.</p>
        </div>
        {status && (
          <StatusPill
            status={status.connected ? "ok" : "warn"}
            label={status.connected ? "connected" : "sample mode"}
          />
        )}
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
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-300">
          <Loader2 size={14} className="animate-spin" /> Checking connection…
        </p>
      ) : status ? (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <dt className="text-ink-300">Status</dt>
            <dd className="col-span-2 text-ink-100">{status.reason}</dd>
            <dt className="text-ink-300">Identity needed</dt>
            <dd className="col-span-2 text-ink-100">{status.identityNeeded}</dd>
            <dt className="text-ink-300">Scope needed</dt>
            <dd className="col-span-2 text-ink-100">{status.scopeNeeded}</dd>
            <dt className="text-ink-300">Pipeline folder</dt>
            <dd className="col-span-2">
              {status.rootFolderUrl ? (
                <a
                  href={status.rootFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent-gold hover:underline"
                >
                  {status.rootFolderLabel} <ExternalLink size={11} />
                </a>
              ) : (
                <span className="text-ink-400">Not set</span>
              )}
            </dd>
          </dl>

          <div className="mt-4">
            <p className="label mb-2">Setup checklist</p>
            <ul className="space-y-1.5">
              {status.checklist.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-ink-200">
                  {item.done ? (
                    <CheckCircle2 size={14} className="shrink-0 text-status-ok" />
                  ) : (
                    <Circle size={14} className="shrink-0 text-ink-500" />
                  )}
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="btn-secondary text-xs"
            >
              {testing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Test connection
            </button>
            {!status.connected && (
              <span className="text-[11px] text-ink-400">
                Disabled features stay off until all checklist items are green.
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 text-xs text-status-warn">Could not load connection status.</p>
      )}
    </section>
  );
}
