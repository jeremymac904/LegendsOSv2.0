"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Share2 } from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";

type ConnectionStatus =
  | "connected"
  | "setup_needed"
  | "not_connected"
  | "error"
  | "disconnected"
  | "revoked"
  | "disabled";

type DestinationPlatform =
  | "facebook"
  | "instagram"
  | "google_business_profile"
  | "youtube";

interface SelectedDestinationRow {
  id: string;
  platform: DestinationPlatform;
  destination_label: string | null;
  destination_type: string | null;
  status: ConnectionStatus;
  is_publish_enabled: boolean;
  last_tested_at: string | null;
  updated_at: string;
}

interface ProviderView {
  provider: "facebook" | "google_social";
  label: string;
  status: ConnectionStatus;
  selected_destinations: SelectedDestinationRow[];
  updated_at: string | null;
}

interface TeamDestinationRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  platform: DestinationPlatform;
  destination_label: string | null;
  destination_type: string | null;
  status: ConnectionStatus;
  is_publish_enabled: boolean;
  updated_at: string | null;
}

interface ConnectionsResponse {
  ok: boolean;
  provisioned: boolean;
  connections: ProviderView[];
  destinations: SelectedDestinationRow[];
  isOwnerOrAdmin: boolean;
  team: Array<{
    user_id: string;
    full_name: string | null;
    email: string | null;
    provider: string;
    status: ConnectionStatus;
    updated_at: string | null;
  }> | null;
  team_destinations: TeamDestinationRow[] | null;
}

interface Props {
  canManage: boolean;
}

function pillFor(status: ConnectionStatus): {
  tone: "ok" | "info" | "warn" | "err" | "off";
  label: string;
} {
  switch (status) {
    case "connected":
      return { tone: "ok", label: "connected" };
    case "error":
      return { tone: "err", label: "needs attention" };
    case "revoked":
    case "disconnected":
    case "disabled":
      return { tone: "off", label: "off" };
    default:
      return { tone: "warn", label: "setup needed" };
  }
}

export function MetaPublishReadiness({ canManage }: Props) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "error"; message: string }
    | { phase: "ready"; data: ConnectionsResponse }
  >({ phase: "loading" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/connections", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      const json = (await res.json()) as ConnectionsResponse & {
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) {
        setState({
          phase: "error",
          message: json.message ?? "Could not load connection status.",
        });
        return;
      }
      setState({ phase: "ready", data: json });
    } catch {
      setState({
        phase: "error",
        message: "Network error loading connection status.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <section className="card-padded">
        <Header onRefresh={load} refreshing={false} />
        <div className="mt-4 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
          <Loader2 size={14} className="animate-spin" />
          Loading destination readiness…
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
  const providerMap = new Map(data.connections.map((row) => [row.provider, row]));
  const allDestinations = data.destinations ?? [];
  const readyDestinations = allDestinations.filter(
    (row) => row.status === "connected" && row.is_publish_enabled
  );
  const needsSelection = allDestinations.length === 0;
  const needsEnable = allDestinations.length > 0 && readyDestinations.length === 0;
  const ready = readyDestinations.length > 0;

  const facebook = providerMap.get("facebook");
  const googleSocial = providerMap.get("google_social");

  return (
    <section className="card-padded">
      <Header onRefresh={load} refreshing={false} />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
              Facebook destinations
            </p>
            <StatusPill
              status={pillFor(facebook?.status ?? "not_connected").tone}
              label={pillFor(facebook?.status ?? "not_connected").label}
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
            {facebook?.selected_destinations?.length ?? 0} selected destination
            {facebook?.selected_destinations?.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
              Google social destinations
            </p>
            <StatusPill
              status={pillFor(googleSocial?.status ?? "not_connected").tone}
              label={pillFor(googleSocial?.status ?? "not_connected").label}
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
            {googleSocial?.selected_destinations?.length ?? 0} selected
            destination
            {googleSocial?.selected_destinations?.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900 dark:text-ink-100">
              <Share2 size={13} className="text-accent-gold" />
              Publish readiness
            </p>
            <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
              {ready
                ? "At least one selected destination is enabled for publishing."
                : needsSelection
                ? "No destination selected yet. Open Connection Center and select one first."
                : "A destination is selected, but publishing is currently disabled for all of them."}
            </p>
          </div>
          <StatusPill
            status={ready ? "ok" : needsSelection ? "warn" : "off"}
            label={ready ? "ready to publish" : needsSelection ? "connect prompt" : "enable publishing"}
          />
        </div>

        {(needsSelection || needsEnable) && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-[11px] text-status-warn">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {needsSelection
              ? "Select a destination in Connection Center before scheduling or publishing."
              : "Enable publishing on at least one selected destination before scheduling or publishing."}
          </p>
        )}
      </div>

      {allDestinations.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
            Selected destinations
          </p>
          {allDestinations.map((destination) => {
            const pill = destination.status === "connected" && destination.is_publish_enabled
              ? { tone: "ok" as const, label: "publishing on" }
              : destination.status === "connected"
              ? { tone: "warn" as const, label: "publishing off" }
              : { tone: "off" as const, label: "off" };
            return (
              <div
                key={destination.id}
                className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                      {destination.destination_label ?? destination.destination_type ?? destination.platform}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-500 dark:text-ink-400">
                      {destination.platform}
                      {destination.destination_type ? ` · ${destination.destination_type}` : ""}
                    </p>
                  </div>
                  <StatusPill status={pill.tone} label={pill.label} />
                </div>
                <p className="mt-2 text-[11px] text-ink-600 dark:text-ink-400">
                  {destination.last_tested_at
                    ? `Last tested ${new Date(destination.last_tested_at).toLocaleString()}`
                    : "Not tested yet."}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {canManage && Array.isArray(data.team_destinations) && data.team_destinations.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-100 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-950/50 dark:text-ink-300">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Destination</th>
                <th className="px-3 py-2">Publishing</th>
              </tr>
            </thead>
            <tbody>
              {data.team_destinations.map((row) => (
                <tr
                  key={`${row.user_id}:${row.platform}:${row.destination_label ?? row.destination_type ?? row.updated_at}`}
                  className="border-t border-ink-200 dark:border-ink-800"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink-900 dark:text-ink-100">
                      {row.full_name ?? row.email ?? row.user_id}
                    </div>
                    <div className="text-[10px] text-ink-500 dark:text-ink-400">
                      {row.email ?? row.user_id}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-ink-700 dark:text-ink-300">
                    {row.platform}
                  </td>
                  <td className="px-3 py-2 text-ink-700 dark:text-ink-300">
                    {row.destination_label ?? row.destination_type ?? "Unknown"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill
                      status={row.is_publish_enabled ? "ok" : "off"}
                      label={row.is_publish_enabled ? "enabled" : "disabled"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/settings" className="btn-ghost text-xs">
          Open Connection Center
        </Link>
        <p className="text-[11px] text-ink-600 dark:text-ink-400">
          {data.isOwnerOrAdmin
            ? "Owner/admin can review team connection status."
            : "Only your own connection rows are visible here."}
        </p>
      </div>
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
        <h2>Destination readiness</h2>
        <p>
          Honest status for per-user Facebook, Instagram, GBP, and YouTube
          destinations.
        </p>
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
