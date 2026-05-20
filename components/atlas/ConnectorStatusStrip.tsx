"use client";

// Horizontal connector-status strip for the Atlas chat surface. Renders a
// compact pill row showing each MCP connector's status. Click a pill to
// expand it and see the env-var setup hint + the (currently empty) list of
// tools that connector would surface once live execution ships.
//
// Premium dark-gold-glass theme to match the rest of AtlasShell. Colors:
//   * connected      — bg-status-ok / accent-gold dot
//   * disabled       — bg-status-warn / amber dot
//   * not_configured — bg-ink-700 / muted gray dot
//
// HARD RULES:
//   * Never render `auth_token` or any env var value. The /api/atlas/tools
//     endpoint only emits NAMES and a boolean `hasToken` for L2 rows.
//   * On fetch failure, fail silently (no error banner above the chat input).
//   * Refresh every 60s so newly-set env vars surface without a hard reload.

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Settings as SettingsIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AtlasToolManifest,
  McpConnector,
  McpStatus,
} from "@/lib/mcp/types";

interface ConnectorStatusStripProps {
  /** Optional className override for the outer container. */
  className?: string;
}

function statusDotClass(status: McpStatus): string {
  switch (status) {
    case "connected":
      return "bg-status-ok shadow-[0_0_6px_-1px_rgba(46,204,113,0.6)]";
    case "disabled":
      return "bg-status-warn";
    case "not_configured":
    default:
      return "bg-ink-600";
  }
}

function statusLabel(status: McpStatus): string {
  switch (status) {
    case "connected":
      return "connected";
    case "disabled":
      return "disabled";
    case "not_configured":
    default:
      return "not configured";
  }
}

function scopeLabel(scope: McpConnector["scope"]): string {
  switch (scope) {
    case "owner_global":
      return "Owner";
    case "lo_personal":
      return "Personal";
    case "future":
    default:
      return "Reserved";
  }
}

export function ConnectorStatusStrip({
  className,
}: ConnectorStatusStripProps) {
  const [manifest, setManifest] = useState<AtlasToolManifest | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/atlas/tools", { cache: "no-store" });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data?.ok && data.manifest) {
        setManifest(data.manifest as AtlasToolManifest);
      }
    } catch {
      // Silent — the chat surface keeps working without the strip.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  if (loading || !manifest) return null;
  if (manifest.connectors.length === 0) return null;

  const connectors = manifest.connectors;
  const expanded = expandedId
    ? connectors.find((c) => c.id === expandedId) ?? null
    : null;

  return (
    <div
      className={cn(
        "border-b border-ink-800 bg-ink-950/60 px-4 py-1.5 backdrop-blur sm:px-6",
        className
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-400">
          MCP
        </span>
        {connectors.map((c) => {
          const isExpanded = expandedId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : c.id)}
              title={
                c.status === "not_configured" && c.requiredEnv.length > 0
                  ? `Not configured — set ${c.requiredEnv.join(", ")}`
                  : `${c.name} — ${statusLabel(c.status)}`
              }
              className={cn(
                "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] font-medium transition",
                "border-ink-700/80 bg-ink-900/70 text-ink-200 backdrop-blur-sm",
                "hover:border-accent-gold/40 hover:text-ink-100",
                isExpanded && "border-accent-gold/60 bg-accent-gold/5 text-accent-gold"
              )}
              aria-expanded={isExpanded}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClass(c.status))} />
              <span className="truncate">{c.name}</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-ink-400">
                {scopeLabel(c.scope)}
              </span>
              {isExpanded ? (
                <ChevronUp size={10} className="shrink-0 opacity-70" />
              ) : (
                <ChevronDown size={10} className="shrink-0 opacity-70" />
              )}
            </button>
          );
        })}
        <a
          href="/settings#integrations"
          className="ml-auto inline-flex h-6 items-center gap-1 rounded-full border border-ink-700/80 bg-ink-900/70 px-2.5 text-[10px] text-ink-300 transition hover:border-accent-gold/40 hover:text-ink-100"
          title="Manage integrations"
        >
          <SettingsIcon size={9} />
          <span>Manage</span>
        </a>
      </div>
      {expanded && (
        <div className="mx-auto mt-1.5 max-w-3xl rounded-xl border border-accent-gold/25 bg-accent-gold/5 px-3 py-2 text-[11px] text-ink-200 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-ink-100">
              {expanded.name}{" "}
              <span className="ml-1 text-[9.5px] font-normal uppercase tracking-[0.18em] text-ink-300">
                · {statusLabel(expanded.status)} · {scopeLabel(expanded.scope)}
              </span>
            </p>
          </div>
          <p className="mt-1 text-ink-300">{expanded.description}</p>
          {expanded.requiredEnv.length > 0 && (
            <p className="mt-1.5 text-[10.5px] text-ink-400">
              Required env (names only):{" "}
              {expanded.requiredEnv.map((n) => (
                <code
                  key={n}
                  className="ml-1 rounded border border-ink-700 bg-ink-900/70 px-1.5 py-[1px] font-mono text-[10px] text-ink-100"
                >
                  {n}
                </code>
              ))}
            </p>
          )}
          {expanded.scope === "lo_personal" && (
            <p className="mt-1.5 text-[10.5px] text-ink-400">
              {expanded.hasToken
                ? "Auth token stored server-side."
                : "No auth token saved."}
              {expanded.savedAt
                ? ` · Saved ${new Date(expanded.savedAt).toLocaleDateString()}`
                : ""}
            </p>
          )}
          {expanded.status === "not_configured" && (
            <p className="mt-1.5 text-[10.5px] text-ink-300">
              {expanded.setupInstructions}
            </p>
          )}
          {expanded.availableTools.length === 0 ? (
            <p className="mt-1.5 text-[10.5px] text-ink-500">
              No live tool execution from this connector yet — status surfacing
              only.
            </p>
          ) : (
            <p className="mt-1.5 text-[10.5px] text-ink-300">
              Tools: {expanded.availableTools.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
