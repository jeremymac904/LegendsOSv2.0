"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";

// PairExtensionPanel — registers this browser/device with the companion
// session API and shows the honest pairing status.
//
// Token-free model: the request rides the user's existing LegendsOS session
// cookie (credentials: "include"). We never store or read any token here. The
// only thing the extension keeps is non-secret prefs (base URL, last assistant)
// in chrome.storage.local, which is outside this component's concern.
const SESSION_ENDPOINT = "/api/browser-companion/session";

interface SessionStatus {
  authenticated?: boolean;
  paired?: boolean;
  provisioned?: boolean;
  session_id?: string | null;
  // The session API doesn't return these today, but we read them defensively
  // so a richer future payload renders without code changes.
  device_label?: string | null;
  last_seen_at?: string | null;
  message?: string | null;
}

type PanelState =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "not_provisioned"; message?: string | null }
  | { kind: "not_detected" }
  | { kind: "error"; message: string }
  | { kind: "ready"; status: SessionStatus };

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "This browser";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/Chrome\//.test(ua)) return "Google Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "This browser";
}

export function PairExtensionPanel() {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [pairing, setPairing] = useState(false);

  const loadStatus = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(SESSION_ENDPOINT, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        setState({ kind: "unauthenticated" });
        return;
      }
      if (res.status === 404) {
        setState({ kind: "not_detected" });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: `Service returned ${res.status}.` });
        return;
      }
      const status = (await res.json()) as SessionStatus;
      if (status.provisioned === false) {
        setState({ kind: "not_provisioned", message: status.message });
        return;
      }
      setState({ kind: "ready", status });
    } catch {
      setState({ kind: "not_detected" });
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const pairDevice = useCallback(async () => {
    setPairing(true);
    try {
      const res = await fetch(SESSION_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "register_device",
          device_label: deviceLabel(),
        }),
      });
      if (res.status === 401 || res.status === 403) {
        setState({ kind: "unauthenticated" });
        return;
      }
      if (res.status === 404) {
        setState({ kind: "not_detected" });
        return;
      }
      if (!res.ok) {
        setState({
          kind: "error",
          message: `Pairing failed (${res.status}).`,
        });
        return;
      }
      const status = (await res.json().catch(() => ({}))) as SessionStatus;
      if (status.provisioned === false) {
        setState({ kind: "not_provisioned", message: status.message });
        return;
      }
      setState({ kind: "ready", status: { paired: true, ...status } });
    } catch {
      setState({
        kind: "error",
        message: "Network error while pairing. Try again.",
      });
    } finally {
      setPairing(false);
    }
  }, []);

  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>Pair this browser</h2>
          <p>
            Register this browser with your LegendsOS session so the companion
            can route captures here. No tokens are stored — it rides your
            existing sign-in.
          </p>
        </div>
        <PairStatusPill state={state} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={pairDevice}
          disabled={pairing || state.kind === "loading"}
          className="btn-primary text-sm disabled:opacity-60"
        >
          {pairing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Link2 size={14} />
          )}
          {state.kind === "ready" && state.status.paired
            ? "Re-pair this browser"
            : "Pair extension"}
        </button>
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={state.kind === "loading"}
          className="btn-ghost text-xs"
        >
          <RefreshCw
            size={13}
            className={state.kind === "loading" ? "animate-spin" : ""}
          />
          Refresh status
        </button>
      </div>

      <div className="mt-4 text-xs text-ink-600 dark:text-ink-300">
        {state.kind === "loading" && (
          <span className="flex items-center gap-2">
            <Loader2 size={13} className="animate-spin" /> Checking pairing…
          </span>
        )}
        {state.kind === "ready" && state.status.paired && (
          <span className="flex items-center gap-2 text-status-ok">
            <ShieldCheck size={13} />
            Paired
            {state.status.device_label
              ? ` · ${state.status.device_label}`
              : ""}
            {state.status.last_seen_at
              ? ` · last seen ${new Date(
                  state.status.last_seen_at
                ).toLocaleString()}`
              : ""}
          </span>
        )}
        {state.kind === "ready" && !state.status.paired && (
          <span>
            This browser is not paired yet. Click “Pair extension” after
            installing the Chrome companion.
          </span>
        )}
        {state.kind === "unauthenticated" && (
          <span className="text-status-warn">
            Sign in to LegendsOS to pair this browser.
          </span>
        )}
        {state.kind === "not_provisioned" && (
          <span className="text-status-warn">
            {state.message ??
              "Pairing storage isn’t provisioned yet (setup needed). Apply the companion migration to enable pairing."}
          </span>
        )}
        {state.kind === "not_detected" && (
          <span className="text-ink-500 dark:text-ink-400">
            Companion service not detected. Install the extension below, or it
            may not be deployed in this environment yet.
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-status-err">{state.message}</span>
        )}
      </div>
    </section>
  );
}

function PairStatusPill({ state }: { state: PanelState }) {
  switch (state.kind) {
    case "ready":
      return (
        <StatusPill
          status={state.status.paired ? "ok" : "warn"}
          label={state.status.paired ? "paired" : "not paired"}
        />
      );
    case "unauthenticated":
      return <StatusPill status="warn" label="sign in" />;
    case "not_provisioned":
      return <StatusPill status="warn" label="setup needed" />;
    case "not_detected":
      return <StatusPill status="off" label="not detected" />;
    case "error":
      return <StatusPill status="err" label="error" />;
    default:
      return <StatusPill status="info" label="checking…" />;
  }
}
