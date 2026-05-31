"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";

// Mirrors the API shape from /api/integrations/meta (GET). Kept inline so this
// component does not depend on a shared types export.
interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

interface MetaStatusResponse {
  ok: boolean;
  provisioned: boolean;
  connection: {
    connected: boolean;
    account_ref: string | null;
    is_publish_enabled: boolean;
    status: string;
    updated_at: string | null;
  } | null;
  config: {
    configured: boolean;
    paid_enabled: boolean;
    capabilities: string[];
  };
  readiness: {
    checks: ReadinessCheck[];
    all_passed: boolean;
    configured: boolean;
    app_configured: boolean;
    identity_present: boolean;
  };
  can_manage: boolean;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; data: MetaStatusResponse };

interface Props {
  /** Owner-only: gates whether the approval switch is interactive. */
  canManage: boolean;
}

export function MetaPublishReadiness({ canManage }: Props) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [pending, startTransition] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/meta", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json()) as MetaStatusResponse & {
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) {
        setState({
          phase: "error",
          message: json.message ?? "Could not load Meta status.",
        });
        return;
      }
      setState({ phase: "ready", data: json });
    } catch {
      setState({ phase: "error", message: "Network error loading Meta status." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = useCallback(
    (enabled: boolean) => {
      setSwitchError(null);
      startTransition(async () => {
        try {
          const res = await fetch("/api/integrations/meta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ action: "set_publish_enabled", enabled }),
          });
          const json = (await res.json()) as {
            ok: boolean;
            error?: string;
            message?: string;
          };
          if (!res.ok || !json.ok) {
            setSwitchError(
              json.message ??
                (json.error === "not_provisioned"
                  ? "Connection table not provisioned yet."
                  : "Could not update the switch.")
            );
            return;
          }
          await load();
        } catch {
          setSwitchError("Network error updating the switch.");
        }
      });
    },
    [load]
  );

  if (state.phase === "loading") {
    return (
      <section className="card-padded">
        <Header onRefresh={load} refreshing={false} />
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
          <Loader2 size={14} className="animate-spin" />
          Loading Meta publish readiness…
        </div>
      </section>
    );
  }

  if (state.phase === "error") {
    return (
      <section className="card-padded">
        <Header onRefresh={load} refreshing={false} />
        <p className="mt-4 rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-xs text-status-warn">
          {state.message}
        </p>
      </section>
    );
  }

  const { data } = state;
  const { provisioned, connection, config, readiness } = data;
  const publishEnabled = Boolean(connection?.is_publish_enabled);

  // Connection model status pill.
  const connectionStatus: "ok" | "warn" | "off" = !provisioned
    ? "warn"
    : connection?.connected
    ? "ok"
    : "off";
  const connectionLabel = !provisioned
    ? "setup needed"
    : connection?.connected
    ? "connection saved"
    : "not connected";

  // App-config pill (env presence only).
  const appStatus = config.configured ? "ok" : "off";
  const appLabel = config.configured ? "app configured" : "not connected";

  // The draft -> publish CTA. DISABLED until every readiness check passes AND
  // owner approval is on. Even when enabled, this sprint it never sends — the
  // label reflects that honestly.
  const publishReady = readiness.all_passed && publishEnabled;

  return (
    <section className="card-padded">
      <Header onRefresh={load} refreshing={state.phase !== "ready" && pending} />

      {/* Connection model row */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
              Meta app credentials
            </p>
            <StatusPill status={appStatus} label={appLabel} />
          </div>
          <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
            Detected from environment variable names only — never values.
          </p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
              Page / account connection
            </p>
            <StatusPill status={connectionStatus} label={connectionLabel} />
          </div>
          <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
            {!provisioned
              ? "Connection storage isn't provisioned yet (migration pending)."
              : connection?.account_ref
              ? `Account ref: ${connection.account_ref}`
              : "No Facebook Page or Instagram account linked in LegendsOS yet."}
          </p>
        </div>
      </div>

      {/* Readiness checklist */}
      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
          Publish readiness
        </p>
        <ul className="mt-2 space-y-1.5">
          {readiness.checks.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white/60 px-3 py-2 dark:border-ink-800 dark:bg-ink-950/30"
            >
              {c.passed ? (
                <CheckCircle2
                  size={15}
                  className="mt-0.5 shrink-0 text-status-ok"
                />
              ) : (
                <CircleDashed
                  size={15}
                  className="mt-0.5 shrink-0 text-status-warn"
                />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-medium",
                    c.passed
                      ? "text-ink-900 dark:text-ink-100"
                      : "text-ink-600 dark:text-ink-300"
                  )}
                >
                  {c.label}
                </p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">
                  {c.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Owner approval switch */}
      <div className="mt-4 rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900 dark:text-ink-100">
              <Lock size={13} className="text-accent-gold" />
              Owner approval to publish
            </p>
            <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
              {canManage
                ? "Turning this on does NOT publish. It records that the owner approves Meta publishing once full wiring is live."
                : "Only the owner can change this approval switch."}
            </p>
          </div>
          <ApprovalSwitch
            on={publishEnabled}
            disabled={!canManage || !provisioned || pending}
            pending={pending}
            onChange={onToggle}
          />
        </div>
        {!provisioned && (
          <p className="mt-2 text-[11px] text-status-warn">
            The connection table isn&apos;t provisioned yet, so this switch is
            read-only until the Sprint 4 migration is applied.
          </p>
        )}
        {switchError && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-status-err">
            <AlertTriangle size={12} />
            {switchError}
          </p>
        )}
      </div>

      {/* Draft -> publish flow (gated, never sends this sprint) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
            Direct Meta publish
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
            {publishReady
              ? "All checks pass — live wiring is pending, so nothing sends yet."
              : "Disabled until every readiness check passes and owner approval is on."}
          </p>
        </div>
        <button
          type="button"
          disabled
          aria-disabled
          title={
            publishReady
              ? "Ready (pending live wiring) — sending is not enabled this release."
              : "Complete all readiness checks and owner approval first."
          }
          className={cn(
            "btn-ghost cursor-not-allowed text-xs opacity-70",
            publishReady && "border-accent-gold/30 text-accent-gold"
          )}
        >
          {publishReady ? "Ready (pending live wiring)" : "Publish (disabled)"}
        </button>
      </div>

      {/* Failure-handling / audit placeholder */}
      <p className="mt-3 text-[11px] text-ink-500 dark:text-ink-400">
        Publish attempts and failures will be recorded for audit once live
        wiring is enabled. No attempts have been made — nothing publishes from
        this screen today.
      </p>
    </section>
  );
}

function Header({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void | Promise<void>;
  refreshing: boolean;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>Meta publish readiness</h2>
        <p>Honest status for direct Facebook / Instagram publishing.</p>
      </div>
      <button
        type="button"
        onClick={() => void onRefresh()}
        className="btn-ghost text-xs"
        disabled={refreshing}
      >
        <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        Refresh
      </button>
    </div>
  );
}

function ApprovalSwitch({
  on,
  disabled,
  pending,
  onChange,
}: {
  on: boolean;
  disabled: boolean;
  pending: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
        on
          ? "border-status-ok/40 bg-status-ok/80"
          : "border-ink-300 bg-ink-200 dark:border-ink-700 dark:bg-ink-800",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-6" : "translate-x-1"
        )}
      >
        {pending && (
          <Loader2 size={12} className="m-0.5 animate-spin text-ink-500" />
        )}
      </span>
    </button>
  );
}
