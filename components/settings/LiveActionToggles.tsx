"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

// Real, in-app live-action toggles backed by integration_settings.
//   scope="global" → owner controls the org-wide defaults + safe_mode.
//   scope="user"   → a member controls their own override (inherits global).
// Every flip persists via POST /api/integrations/settings and is enforced
// server-side by the email/social/calendar routes. Safe defaults: off.

type Channel = "live_email" | "live_social" | "live_calendar" | "live_drive_write";

const CHANNELS: { key: Channel; label: string; help: string }[] = [
  { key: "live_email", label: "Live email send", help: "Allow outbound email to actually send (not just draft)." },
  { key: "live_social", label: "Live social publish", help: "Allow scheduled posts to publish (still needs a connected, approved account)." },
  { key: "live_calendar", label: "Live calendar write", help: "Allow creating real calendar events." },
  { key: "live_drive_write", label: "Live Drive write", help: "Allow writing/moving files in Google Drive." },
];

interface SettingsResponse {
  ok: boolean;
  can_manage_global: boolean;
  can_manage_users: boolean;
  safe_mode: boolean;
  global: Record<Channel, boolean> & { safe_mode: boolean; source: string; updated_at: string | null };
  self: {
    has_override: boolean;
    values: Record<Channel, boolean> | null;
    resolved: Record<string, { allowed: boolean; reason: string }>;
  };
}

function Switch({
  on,
  disabled,
  pending,
  onClick,
  title,
}: {
  on: boolean;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled || pending}
      onClick={onClick}
      title={title}
      className={cn(
        "relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border transition",
        on ? "border-status-ok/40 bg-status-ok/30" : "border-ink-300 bg-ink-200 dark:border-ink-700 dark:bg-ink-800",
        (disabled || pending) && "cursor-not-allowed opacity-60"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition dark:bg-ink-100",
          on ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function LiveActionToggles({
  scope,
  targetUserId,
}: {
  scope: "global" | "user";
  targetUserId?: string;
}) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/settings", { headers: { accept: "application/json" } });
      const json = (await res.json()) as SettingsResponse;
      if (!json.ok) {
        setError("Could not load live-action settings.");
      } else {
        setData(json);
        setError(null);
      }
    } catch {
      setError("Could not load live-action settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = scope === "global" ? Boolean(data?.can_manage_global) : true;

  async function write(patch: Record<string, boolean>, key: string) {
    if (!canEdit) return;
    setPendingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/integrations/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, target_user_id: scope === "user" ? targetUserId : undefined, patch }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message ?? json.error ?? "Save failed.");
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setPendingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading live-action settings…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="text-sm text-status-err">{error ?? "Settings unavailable."}</div>
    );
  }

  const safeMode = data.global.safe_mode;

  return (
    <div className="space-y-3">
      {scope === "global" && (
        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border p-3",
            safeMode
              ? "border-status-warn/40 bg-status-warn/10"
              : "border-ink-200 bg-white/60 dark:border-ink-800 dark:bg-ink-900/40"
          )}
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-ink-900 dark:text-ink-100">
              {safeMode ? <AlertTriangle className="h-4 w-4 text-status-warn" /> : <ShieldCheck className="h-4 w-4 text-status-ok" />}
              Safe mode {safeMode ? "ON — all live actions forced off" : "off"}
            </div>
            <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">
              Master kill switch. When on, no live email/social/calendar/drive action runs, regardless of the toggles below.
            </p>
          </div>
          <Switch
            on={safeMode}
            disabled={!canEdit}
            pending={pendingKey === "safe_mode"}
            onClick={() => write({ safe_mode: !safeMode }, "safe_mode")}
            title={canEdit ? "Toggle safe mode" : "Owner only"}
          />
        </div>
      )}

      <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
        {CHANNELS.map((ch) => {
          // resolved keys are "email" | "social" | "calendar" | "drive_write".
          const resolved = data.self.resolved[ch.key.replace("live_", "")];
          const effectiveAllowed = resolved?.allowed ?? false;
          const reason = resolved?.reason ?? "";

          // What the switch shows:
          //  - global scope → the org-wide boolean
          //  - user scope   → the user's explicit override if any, else the
          //                   inherited global effective value.
          const explicit =
            scope === "global"
              ? data.global[ch.key]
              : data.self.values
              ? data.self.values[ch.key]
              : effectiveAllowed;
          const inheriting = scope === "user" && !data.self.values;

          const disabledBySafe = scope === "global" ? false : safeMode;

          return (
            <li key={ch.key} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink-900 dark:text-ink-100">{ch.label}</div>
                <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">{ch.help}</p>
                {scope === "user" && (
                  <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
                    {inheriting ? "Inheriting team default · " : "Custom · "}
                    Effective:{" "}
                    <span className={effectiveAllowed ? "text-status-ok" : "text-ink-500 dark:text-ink-400"}>
                      {effectiveAllowed ? "live" : `off${reason && reason !== "ok" ? ` (${reason.replace(/_/g, " ")})` : ""}`}
                    </span>
                  </p>
                )}
              </div>
              <Switch
                on={Boolean(explicit)}
                disabled={!canEdit || disabledBySafe}
                pending={pendingKey === ch.key}
                onClick={() => write({ [ch.key]: !explicit }, ch.key)}
                title={
                  !canEdit
                    ? "Owner only"
                    : disabledBySafe
                    ? "Safe mode is on"
                    : explicit
                    ? "Click to disable"
                    : "Click to enable"
                }
              />
            </li>
          );
        })}
      </ul>

      {error && <p className="text-xs text-status-err">{error}</p>}
      {scope === "global" && data.global.source === "env_default" && (
        <p className="text-[11px] text-ink-500 dark:text-ink-400">
          Showing environment defaults (no saved settings yet). Flipping a toggle creates the in-app setting.
        </p>
      )}
    </div>
  );
}
