"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface Connector {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  tier: string;
  status: string;
  provider: string;
  metadata?: { icon?: string; color?: string } | null;
  last_ping_at?: string | null;
}

function providerIcon(provider: string) {
  if (provider === "n8n") return <Zap size={13} />;
  if (provider === "telegram") return <Send size={13} />;
  return <Sparkles size={13} />;
}

function statusColor(status: string): string {
  if (status === "active") return "bg-status-ok";
  if (status === "error") return "bg-status-err";
  if (status === "coming_soon") return "bg-accent-gold/60";
  return "bg-ink-400 dark:bg-ink-500";
}

function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  if (status === "error") return "Error";
  if (status === "coming_soon") return "Coming Soon";
  return status;
}

function statusIcon(status: string) {
  if (status === "active") return <CheckCircle size={11} className="text-status-ok" />;
  if (status === "error") return <XCircle size={11} className="text-status-err" />;
  if (status === "coming_soon") return <Clock size={11} className="text-accent-gold/70" />;
  return <AlertCircle size={11} className="text-ink-500 dark:text-ink-500" />;
}

export function ConnectorPanel() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchConnectors(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/atlas/connectors");
      const data = (await res.json()) as { ok: boolean; connectors?: Connector[]; error?: string };
      if (data.ok && data.connectors) {
        setConnectors(data.connectors);
      } else {
        setError(data.error ?? "Failed to load connectors.");
      }
    } catch {
      setError("Network error loading connectors.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchConnectors();
  }, []);

  const ownerGlobal = connectors.filter((c) => c.tier === "owner_global");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-ink-200 dark:border-ink-800 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600 dark:text-ink-300">
          Connectors
        </p>
        <button
          type="button"
          onClick={() => fetchConnectors(true)}
          disabled={refreshing}
          className="text-ink-500 dark:text-ink-400 transition hover:text-ink-900 dark:hover:text-ink-100 disabled:opacity-40"
          title="Refresh connector status"
        >
          <RefreshCw size={11} className={cn(refreshing && "animate-spin")} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        {loading && (
          <div className="flex items-center gap-2 py-4 text-[11px] text-ink-500 dark:text-ink-400">
            <Loader2 size={12} className="animate-spin" />
            Loading…
          </div>
        )}

        {error && !loading && (
          <p className="py-3 text-[10px] text-status-err">{error}</p>
        )}

        {!loading && !error && ownerGlobal.length === 0 && (
          <p className="py-3 text-[10px] text-ink-500 dark:text-ink-500">No connectors found.</p>
        )}

        {!loading && ownerGlobal.map((c) => (
          <div
            key={c.id}
            className="mb-2 last:mb-0 rounded-lg border border-ink-200/70 dark:border-ink-800/70 bg-white/50 dark:bg-ink-900/50 px-2.5 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-ink-200 dark:border-ink-700 bg-ink-100/80 dark:bg-ink-800/80 text-ink-600 dark:text-ink-300"
                style={c.metadata?.color ? { borderColor: `${c.metadata.color}40`, color: c.metadata.color } : {}}
              >
                {providerIcon(c.provider)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-ink-900 dark:text-ink-100">
                  {c.display_name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {statusIcon(c.status)}
                  <span
                    className={cn(
                      "text-[9.5px] uppercase tracking-[0.12em]",
                      c.status === "active"
                        ? "text-status-ok"
                        : c.status === "coming_soon"
                        ? "text-accent-gold/70"
                        : c.status === "error"
                        ? "text-status-err"
                        : "text-ink-500 dark:text-ink-500"
                    )}
                  >
                    {statusLabel(c.status)}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  statusColor(c.status)
                )}
              />
            </div>

            {c.description && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-ink-500 dark:text-ink-500 line-clamp-2">
                {c.description}
              </p>
            )}

            {c.status === "coming_soon" && (
              <span className="mt-1.5 inline-flex items-center rounded-full border border-accent-gold/30 bg-accent-gold/5 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-accent-gold">
                Coming Soon
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer summary */}
      {!loading && connectors.length > 0 && (
        <div className="border-t border-ink-200 dark:border-ink-800 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
            <p className="text-[10px] text-ink-500 dark:text-ink-400">
              {connectors.filter((c) => c.status === "active").length} of{" "}
              {connectors.length} active
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
