"use client";

// EnvChecklist — owner-only environment variable health checklist.
//
// Fetches GET /api/integrations/status and renders every required env var
// grouped by category with present/missing pills, descriptions, and per-group
// summary badges. Fully collapsible. Never shows or logs values — presence
// booleans only.

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Chrome,
  Globe,
  KeyRound,
  Loader2,
  Monitor,
  RefreshCw,
  Share2,
  Webhook,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnvVarEntry {
  present: boolean;
  category: string;
  description: string;
}

interface StatusResponse {
  ok: boolean;
  redirect_uri?: string;
  env_checklist?: Record<string, EnvVarEntry>;
}

interface CategoryMeta {
  key: string;
  label: string;
  icon: typeof KeyRound;
  varOrder: string[];
}

// ---------------------------------------------------------------------------
// Category definitions (fixed display order + icons)
// ---------------------------------------------------------------------------

const CANONICAL_REDIRECT_URI = "https://legndsosv20.netlify.app/api/integrations/connect/callback";

const CATEGORIES: CategoryMeta[] = [
  {
    key: "google_oauth",
    label: "Google OAuth",
    icon: KeyRound,
    varOrder: [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REDIRECT_URI",
    ],
  },
  {
    key: "webhooks",
    label: "Webhooks",
    icon: Webhook,
    varOrder: [
      "LEGENDSOS_WEBHOOK_SECRET",
      "N8N_WEBHOOK_BASE_URL",
      "N8N_WEBHOOK_SECRET",
      "N8N_API_KEY",
    ],
  },
  {
    key: "meta_social",
    label: "Meta / Social",
    icon: Share2,
    varOrder: [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_ACCESS_TOKEN",
      "META_PAGE_ID",
      "META_INSTAGRAM_ACCOUNT_ID",
      "ALLOW_LIVE_SOCIAL_PUBLISH",
      "ALLOW_LIVE_EMAIL_SEND",
    ],
  },
  {
    key: "google_services",
    label: "Google Services",
    icon: Globe,
    varOrder: ["GBP_ACCOUNT_ID", "GBP_LOCATION_ID", "YOUTUBE_CHANNEL_ID"],
  },
  {
    key: "zapier",
    label: "Zapier",
    icon: Zap,
    varOrder: ["ZAP_MCP_KEY"],
  },
  {
    key: "ai_providers",
    label: "AI Providers",
    icon: Bot,
    varOrder: [
      "OPENROUTER_API_KEY",
      "DEEPSEEK_API_KEY",
      "NVIDIA_API_KEY",
      "FAL_KEY",
      "HF_TOKEN",
      "HEYGEN_API_KEY",
    ],
  },
  {
    key: "browser_companion",
    label: "Browser Companion",
    icon: Chrome,
    varOrder: ["LEGENDSOS_BROWSER_EXTENSION_ORIGINS"],
  },
];

// ---------------------------------------------------------------------------
// Copy-to-clipboard (clipboard API guard)
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Clipboard unavailable — URI is still visible for manual copy.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="btn-ghost h-6 px-2 text-[10px]"
      title="Copy to clipboard"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CategoryRow — collapsible group
// ---------------------------------------------------------------------------

function CategoryRow({
  meta,
  checklist,
  redirectUri,
}: {
  meta: CategoryMeta;
  checklist: Record<string, EnvVarEntry>;
  redirectUri: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = meta.icon;

  const vars = meta.varOrder.map((name) => ({
    name,
    entry: checklist[name] ?? null,
  }));
  const total = vars.length;
  const present = vars.filter((v) => v.entry?.present === true).length;
  const allGood = present === total;
  const noneGood = present === 0;

  const summaryTone = allGood
    ? "bg-status-ok/20 text-status-ok"
    : noneGood
      ? "bg-status-warn/20 text-status-warn"
      : "bg-status-info/20 text-status-info";

  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-800">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-ink-50 dark:hover:bg-ink-900/40"
        aria-expanded={open}
      >
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
          <Icon size={13} />
        </div>
        <span className="flex-1 text-sm font-semibold text-ink-900 dark:text-ink-100">
          {meta.label}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
            summaryTone
          )}
        >
          {present}/{total}
        </span>
        {open ? (
          <ChevronDown size={14} className="shrink-0 text-ink-400" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-ink-400" />
        )}
      </button>

      {/* Expandable body */}
      {open && (
        <div className="border-t border-ink-200 px-3 pb-3 pt-2 dark:border-ink-800">
          {/* Canonical redirect URI for Google OAuth category */}
          {meta.key === "google_oauth" && (
            <div className="mb-2.5 rounded-lg border border-ink-200 bg-ink-50/60 p-2 dark:border-ink-800 dark:bg-ink-950/30">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                  Canonical Redirect URI
                </p>
                <CopyButton text={redirectUri} />
              </div>
              <p className="mt-0.5 break-all font-mono text-[10px] text-ink-700 dark:text-ink-300">
                {redirectUri}
              </p>
              <p className="mt-0.5 text-[10px] text-ink-500 dark:text-ink-400">
                Register this exact URL in your Google Cloud OAuth client.
              </p>
            </div>
          )}

          {/* Var list */}
          <ul className="space-y-1.5">
            {vars.map(({ name, entry }) => {
              const isPresent = entry?.present === true;
              const isMissing = entry?.present === false;
              return (
                <li key={name} className="flex items-start gap-2.5">
                  {/* Status dot */}
                  <span
                    aria-hidden
                    className={cn(
                      "mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full",
                      isPresent
                        ? "bg-status-ok"
                        : isMissing
                          ? "bg-status-warn"
                          : "bg-ink-400"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-ink-800 dark:text-ink-200">
                        {name}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                          isPresent
                            ? "bg-status-ok/15 text-status-ok"
                            : isMissing
                              ? "bg-status-warn/15 text-status-warn"
                              : "bg-ink-200 text-ink-500 dark:bg-ink-800 dark:text-ink-400"
                        )}
                      >
                        {isPresent ? "present" : isMissing ? "missing" : "unknown"}
                      </span>
                    </div>
                    {entry?.description && (
                      <p className="mt-0.5 text-[10px] leading-relaxed text-ink-500 dark:text-ink-400">
                        {entry.description}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnvChecklist — top-level component (exported)
// ---------------------------------------------------------------------------

export function EnvChecklist() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/status", {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as StatusResponse;
      if (json?.ok !== false) {
        setData(json);
        setLastFetched(new Date());
      }
    } catch {
      // Degrade gracefully — checklist shows unknowns rather than crashing.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checklist = data?.env_checklist ?? {};
  const redirectUri = data?.redirect_uri ?? CANONICAL_REDIRECT_URI;

  // Global summary across all vars
  const allVarNames = CATEGORIES.flatMap((c) => c.varOrder);
  const totalVars = allVarNames.length;
  const presentVars = allVarNames.filter(
    (name) => checklist[name]?.present === true
  ).length;

  const globalTone =
    presentVars === totalVars
      ? "text-status-ok"
      : presentVars === 0
        ? "text-status-warn"
        : "text-status-info";

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-accent-gold" />
          <span className="text-xs font-semibold text-ink-900 dark:text-ink-100">
            Environment Variables
          </span>
          {!loading && (
            <span className={cn("text-xs font-semibold tabular-nums", globalTone)}>
              {presentVars}/{totalVars} configured
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="text-[10px] text-ink-500 dark:text-ink-400">
              checked{" "}
              {lastFetched.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="btn-ghost h-7 gap-1.5 px-2 text-[11px] disabled:opacity-40"
            title="Refresh env var status"
          >
            <RefreshCw
              size={11}
              className={cn(loading && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking environment variables…
        </div>
      )}

      {!loading && !data && (
        <p className="text-xs text-status-warn">
          Could not load env status — you may need to be signed in as owner.
        </p>
      )}

      {/* Category rows */}
      {data && (
        <div className="space-y-2">
          {CATEGORIES.map((cat) => (
            <CategoryRow
              key={cat.key}
              meta={cat}
              checklist={checklist}
              redirectUri={redirectUri}
            />
          ))}
        </div>
      )}
    </div>
  );
}
