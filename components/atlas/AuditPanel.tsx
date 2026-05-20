"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Eye, Loader2 } from "lucide-react";

import { cn, formatRelative } from "@/lib/utils";
import type { AtlasAuditEntry } from "@/lib/atlas/types";

interface AuditPanelProps {
  /** Optional server-prefetched seed list. */
  initial?: AtlasAuditEntry[] | null;
}

function actionTone(action: string): string {
  const a = (action ?? "").toLowerCase();
  if (a.includes("error") || a.includes("failed")) return "text-status-err";
  if (a.includes("delete") || a.includes("revoke")) return "text-status-warn";
  if (a.includes("create") || a.includes("triggered")) return "text-accent-gold";
  return "text-ink-200";
}

export function AuditPanel({ initial = null }: AuditPanelProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AtlasAuditEntry[] | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(initial != null);

  // Lazy-load on first expansion so we don't waste a request when the panel
  // stays collapsed.
  useEffect(() => {
    if (!open || hasFetched) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/atlas/audit", {
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as
          | { ok: boolean; entries?: AtlasAuditEntry[] }
          | AtlasAuditEntry[];
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.entries)
          ? data.entries
          : [];
        setEntries(list.slice(0, 25));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load audit");
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHasFetched(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, hasFetched]);

  return (
    <section aria-label="Atlas audit log" className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 border-b border-ink-800/70 px-3.5 py-2.5 text-left transition hover:bg-ink-800/30"
        aria-expanded={open}
        aria-controls="atlas-audit-body"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-md border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
          >
            <Eye size={12} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              Audit log
            </p>
            <p className="text-[10px] text-ink-400">Latest 25 Atlas actions</p>
          </div>
        </div>
        <span className="text-ink-300">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div
          id="atlas-audit-body"
          className="max-h-[260px] overflow-y-auto px-2 py-2 scrollbar-thin"
        >
          {loading && (
            <p className="flex items-center justify-center gap-1.5 py-3 text-[10.5px] text-ink-400">
              <Loader2 size={11} className="animate-spin" />
              Loading audit entries…
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-2 py-1.5 text-[10.5px] text-status-err">
              {error}
            </p>
          )}
          {!loading && entries && entries.length === 0 && !error && (
            <p className="px-1 py-3 text-center text-[10.5px] text-ink-400">
              No audit entries yet.
            </p>
          )}
          {entries && entries.length > 0 && (
            <ul className="space-y-1">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-ink-800/60 bg-ink-900/40 px-2 py-1.5"
                  title={
                    e.metadata && Object.keys(e.metadata).length > 0
                      ? JSON.stringify(e.metadata).slice(0, 280)
                      : undefined
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-[11.5px] font-medium",
                        actionTone(e.action)
                      )}
                    >
                      {e.action}
                    </p>
                    <span className="shrink-0 text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
                      {formatRelative(e.created_at)}
                    </span>
                  </div>
                  {e.target_type && (
                    <p className="truncate text-[10px] text-ink-400">
                      {e.target_type}
                      {e.target_id ? ` · ${e.target_id.slice(0, 8)}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
