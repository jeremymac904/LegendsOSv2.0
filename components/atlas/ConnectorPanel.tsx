"use client";

import { useEffect, useState } from "react";
import { Plug, AlertTriangle, Sparkles, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AtlasConnector,
  AtlasConnectorStatus,
  AtlasConnectorType,
} from "@/lib/atlas/types";

type ConnectorTier = "core" | "automation" | "messaging" | "preview";

interface ConnectorPanelProps {
  /** Optional server-prefetched seed list. */
  initial?: AtlasConnector[] | null;
}

const STATUS_TONE: Record<AtlasConnectorStatus, string> = {
  active: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  inactive: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  error: "border-status-err/40 bg-status-err/10 text-status-err",
  coming_soon: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};

const STATUS_LABEL: Record<AtlasConnectorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  error: "Error",
  coming_soon: "Coming soon",
};

function tierFromType(type: AtlasConnectorType | string): ConnectorTier {
  if (type === "automation") return "automation";
  if (type === "messaging") return "messaging";
  if (type === "mcp") return "preview";
  return "core";
}

const TIER_LABEL: Record<ConnectorTier, string> = {
  core: "Core",
  automation: "Automation",
  messaging: "Messaging",
  preview: "Preview",
};

export function ConnectorPanel({ initial = null }: ConnectorPanelProps) {
  const [connectors, setConnectors] = useState<AtlasConnector[] | null>(initial);
  const [loading, setLoading] = useState(initial == null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (initial != null) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/atlas/connectors", {
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as
          | { ok: boolean; connectors?: AtlasConnector[] }
          | AtlasConnector[];
        if (cancelled) return;
        if (Array.isArray(data)) {
          setConnectors(data);
        } else if (data && Array.isArray(data.connectors)) {
          setConnectors(data.connectors);
        } else {
          setConnectors([]);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load connectors");
        setConnectors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <section
      aria-label="Atlas connectors"
      className="card overflow-hidden"
    >
      <header className="flex items-center justify-between gap-2 border-b border-ink-800/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-md border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
          >
            <Plug size={12} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              Connectors
            </p>
            <p className="text-[10px] text-ink-400">External tools Atlas can use</p>
          </div>
        </div>
        {loading && (
          <Loader2 size={12} className="animate-spin text-ink-400" aria-label="Loading" />
        )}
      </header>

      <div className="max-h-[260px] overflow-y-auto px-2 py-2 scrollbar-thin">
        {error && (
          <p className="flex items-center gap-1.5 rounded-lg border border-status-err/30 bg-status-err/10 px-2 py-1.5 text-[10.5px] text-status-err">
            <AlertTriangle size={11} /> {error}
          </p>
        )}

        {!loading && connectors && connectors.length === 0 && !error && (
          <div className="grid place-items-center gap-1 py-5 text-center">
            <Sparkles size={14} className="text-ink-400" />
            <p className="text-[11px] font-medium text-ink-200">No connectors yet</p>
            <p className="text-[10px] text-ink-400">
              Connectors will appear here once Track A wires the API.
            </p>
          </div>
        )}

        {loading && !connectors && (
          <ul className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                aria-hidden
                className="h-10 animate-pulse rounded-lg border border-ink-800/60 bg-ink-900/40"
              />
            ))}
          </ul>
        )}

        {connectors && connectors.length > 0 && (
          <ul className="space-y-1">
            {connectors.map((c) => {
              const status = (c.status as AtlasConnectorStatus) ?? "inactive";
              const tier = tierFromType(c.type);
              const isComing = status === "coming_soon";
              return (
                <li
                  key={c.id}
                  className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-ink-700/60 hover:bg-ink-800/40"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      status === "active"
                        ? "bg-emerald-400"
                        : status === "error"
                        ? "bg-status-err"
                        : status === "coming_soon"
                        ? "bg-amber-400"
                        : "bg-zinc-500"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-ink-100">
                      {c.name}
                    </p>
                    <p className="truncate text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
                      {TIER_LABEL[tier]}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.14em]",
                      STATUS_TONE[status] ??
                        "border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
                    )}
                  >
                    {STATUS_LABEL[status] ?? status}
                  </span>
                  {isComing && (
                    <button
                      type="button"
                      onClick={() => setToast(`${c.name} — coming soon`)}
                      className="shrink-0 rounded-md border border-accent-gold/30 bg-accent-gold/10 px-1.5 py-[2px] text-[9.5px] font-medium uppercase tracking-[0.14em] text-accent-gold transition hover:bg-accent-gold/15"
                    >
                      Connect
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {toast && (
        <div className="border-t border-ink-800/60 bg-accent-gold/5 px-3 py-1.5 text-center text-[10px] text-accent-gold">
          {toast}
        </div>
      )}
    </section>
  );
}
