"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  HardDrive,
  Link2,
  Loader2,
  Mail,
  PlugZap,
  RefreshCw,
  Share2,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";

type ConnectionStatus =
  | "connected"
  | "setup_needed"
  | "not_connected"
  | "error"
  | "disconnected"
  | "revoked"
  | "disabled";

type ProviderId =
  | "facebook"
  | "google_social"
  | "google"
  | "gmail"
  | "google_drive"
  | "google_calendar";

type DestinationPlatform =
  | "facebook"
  | "instagram"
  | "google_business_profile"
  | "youtube";

interface DestinationOption {
  platform: DestinationPlatform;
  destination_type: string;
  destination_ref: string;
  destination_label: string;
  account_ref?: string | null;
  page_id?: string | null;
  metadata?: Record<string, unknown>;
}

interface SelectedDestinationRow {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  user_integration_connection_id: string | null;
  platform: DestinationPlatform;
  account_ref: string | null;
  page_id: string | null;
  destination_type: string | null;
  destination_ref: string | null;
  destination_label: string | null;
  status: ConnectionStatus;
  connected_by: string | null;
  connected_at: string | null;
  last_tested_at: string | null;
  is_publish_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ProviderView {
  provider: ProviderId;
  label: string;
  status: ConnectionStatus;
  scopes: string[];
  connected_at: string | null;
  last_checked_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown>;
  selected_destinations: SelectedDestinationRow[];
  available_destinations: Record<string, DestinationOption[]>;
}

interface TeamConnectionRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  provider: ProviderId;
  status: ConnectionStatus;
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
  team: TeamConnectionRow[] | null;
  team_destinations: TeamDestinationRow[] | null;
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  facebook: "Meta / Instagram Direct API",
  google_social: "Google Social APIs",
  google: "Google Workspace account",
  gmail: "Gmail",
  google_drive: "Google Drive",
  google_calendar: "Google Calendar",
};

const PROVIDER_ICONS: Record<ProviderId, typeof Mail> = {
  facebook: Share2,
  google_social: Link2,
  google: PlugZap,
  gmail: Mail,
  google_drive: HardDrive,
  google_calendar: CalendarDays,
};

const PROVIDER_DESCRIPTIONS: Record<ProviderId, string> = {
  facebook:
    "Advanced direct API path. Zapier is recommended for Facebook and Instagram publishing.",
  google_social:
    "Optional direct integration for advanced YouTube and Google Business Profile API publishing. Not required for Zapier publishing.",
  google: "Base Google Workspace grant used by Gmail, Drive, and Calendar.",
  gmail: "Gmail access for listing recent messages, creating drafts, and gated sends.",
  google_drive: "Drive access for listing folders plus gated folder, upload, move, and edit actions.",
  google_calendar: "Calendar access to read and create scheduled events.",
};

const AVAILABLE_GROUP_LABELS: Record<string, string> = {
  facebook_pages: "Facebook Pages",
  instagram_accounts: "Instagram business accounts",
  google_business_accounts: "Google Business accounts",
  google_business_locations: "Google Business locations",
  youtube_channels: "YouTube channels",
};

const ZAPIER_PLATFORMS = [
  "Facebook",
  "Instagram",
  "YouTube",
  "TikTok",
  "Google Business Profile",
  "LinkedIn",
] as const;

function pillFor(status: ConnectionStatus, provider?: ProviderId): {
  tone: "ok" | "info" | "warn" | "err" | "off";
  label: string;
} {
  if (provider === "google_social" && status !== "connected" && status !== "error") {
    return { tone: "info", label: "optional direct integration" };
  }
  switch (status) {
    case "connected":
      return { tone: "ok", label: "connected" };
    case "error":
      return { tone: "err", label: "needs attention" };
    case "revoked":
    case "disconnected":
    case "disabled":
      return { tone: "off", label: "revoked" };
    default:
      return { tone: "warn", label: "setup needed" };
  }
}

function ZapierConnectionWizard() {
  const [selected, setSelected] = useState<string[]>([...ZAPIER_PLATFORMS]);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "checking" | "connected" | "missing">("idle");
  const [saved, setSaved] = useState(false);

  async function verify() {
    setVerifyStatus("checking");
    try {
      const res = await fetch("/api/integrations/mcp", {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        connections?: Array<{ provider?: string }>;
      };
      const hasZapier = Boolean(
        json.ok && json.connections?.some((connection) => connection.provider === "zapier")
      );
      setVerifyStatus(hasZapier ? "connected" : "missing");
    } catch {
      setVerifyStatus("missing");
    }
  }

  function togglePlatform(platform: string) {
    setSaved(false);
    setSelected((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  function savePlan() {
    try {
      window.localStorage.setItem(
        "legendsos:zapier-publishing-platforms",
        JSON.stringify(selected)
      );
    } catch {
      // Local browser storage is only a user preference; failing to write it
      // should not block the wizard.
    }
    setSaved(true);
  }

  return (
    <section className="rounded-2xl border border-accent-gold/25 bg-accent-gold/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            Zapier Publishing Wizard
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-700 dark:text-ink-300">
            Recommended: Connect your social accounts through Zapier for the
            fastest setup and highest reliability.
          </p>
        </div>
        <StatusPill
          status={verifyStatus === "connected" ? "ok" : verifyStatus === "missing" ? "warn" : "info"}
          label={
            verifyStatus === "connected"
              ? "Zapier MCP connected"
              : verifyStatus === "missing"
                ? "connect Zapier MCP"
                : "recommended"
          }
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
            Step 1
          </p>
          <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">
            Connect Zapier MCP
          </p>
          <a href="#mcp-connections" className="btn-ghost mt-3 h-8 px-3 text-xs">
            Open MCP Connections
          </a>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
            Step 2
          </p>
          <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">
            Verify MCP connection
          </p>
          <button
            type="button"
            onClick={() => void verify()}
            disabled={verifyStatus === "checking"}
            className="btn-secondary mt-3 h-8 px-3 text-xs disabled:opacity-40"
          >
            {verifyStatus === "checking" ? "Checking..." : "Verify Zapier MCP"}
          </button>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
            Step 3
          </p>
          <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">
            Choose platforms
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ZAPIER_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={
                  selected.includes(platform)
                    ? "rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-3 py-1.5 text-xs text-accent-gold"
                    : "rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-600 dark:border-ink-800 dark:text-ink-300"
                }
              >
                Zapier -&gt; {platform}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
            Step 4
          </p>
          <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">
            Save publishing plan
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={savePlan}
              disabled={selected.length === 0}
              className="btn-primary h-8 px-3 text-xs disabled:opacity-40"
            >
              Save
            </button>
            {saved && (
              <span className="text-[11px] text-status-ok">
                Saved selected Zapier publishing platforms.
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function providerForPlatform(platform: DestinationPlatform): ProviderId {
  return platform === "facebook" || platform === "instagram"
    ? "facebook"
    : "google_social";
}

function destinationStatus(row: SelectedDestinationRow): {
  tone: "ok" | "info" | "warn" | "err" | "off";
  label: string;
} {
  if (row.status === "connected" && row.is_publish_enabled) {
    return { tone: "ok", label: "publishing on" };
  }
  if (row.status === "connected") {
    return { tone: "warn", label: "publishing off" };
  }
  if (row.status === "revoked") {
    return { tone: "off", label: "revoked" };
  }
  return { tone: "warn", label: "needs attention" };
}

function getDestinationGroups(
  available: Record<string, DestinationOption[]>,
  provider: ProviderId
): Array<{ title: string; items: DestinationOption[] }> {
  if (provider === "facebook") {
    return [
      { title: AVAILABLE_GROUP_LABELS.facebook_pages, items: available.facebook_pages ?? [] },
      {
        title: AVAILABLE_GROUP_LABELS.instagram_accounts,
        items: available.instagram_accounts ?? [],
      },
    ];
  }
  if (provider === "google_social") {
    return [
      {
        title: AVAILABLE_GROUP_LABELS.google_business_accounts,
        items: available.google_business_accounts ?? [],
      },
      {
        title: AVAILABLE_GROUP_LABELS.google_business_locations,
        items: available.google_business_locations ?? [],
      },
      { title: AVAILABLE_GROUP_LABELS.youtube_channels, items: available.youtube_channels ?? [] },
    ];
  }
  return [];
}

export function IntegrationConnections() {
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/connections", {
        credentials: "include",
      });
      const json = (await res.json()) as ConnectionsResponse;
      if (json.ok) setData(json);
    } catch {
      // Keep rendering any cached state in the component.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function postAction(body: Record<string, unknown>, key: string) {
    setBusyKey(key);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/connections", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        message?: string;
        authorize_url?: string;
        status?: string;
      };
      if (!res.ok || !json.ok) {
        setMessage(json.message ?? "Action failed.");
        return;
      }
      setMessage("Saved.");
      await load();
    } catch {
      setMessage("Network error.");
    } finally {
      setBusyKey(null);
    }
  }

  async function connect(provider: ProviderId) {
    setBusyKey(`connect:${provider}`);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          return_to: `${window.location.pathname}${window.location.search}`,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        status?: string;
        message?: string;
        authorize_url?: string;
      };
      if (!json.ok) {
        setMessage(json.message ?? "Could not start connect.");
        return;
      }
      if (json.status === "oauth_start" && json.authorize_url) {
        window.location.href = json.authorize_url;
        return;
      }
      setMessage(
        json.message ??
          "Setup needed — admin must configure the app credentials in Netlify."
      );
    } catch {
      setMessage("Network error starting connect.");
    } finally {
      setBusyKey(null);
    }
  }

  const connections = data?.connections ?? [];
  const provisioned = data?.provisioned ?? false;
  const isOwnerOrAdmin = data?.isOwnerOrAdmin ?? false;

  const STUB_PROVIDERS = new Set<ProviderId>(["facebook", "google_social", "google", "google_drive", "google_calendar"]);

  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>Connection center</h2>
          <p>
            Google Workspace covers Gmail, Drive, and Calendar. Zapier is the
            recommended social publishing path; direct social APIs are optional
            advanced integrations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-ghost text-xs"
          disabled={loading || busyKey !== null}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {!loading && !provisioned && (
        <p className="mt-3 rounded-lg border border-status-warn/30 bg-status-warn/5 px-3 py-2 text-[11px] text-ink-700 dark:text-ink-300">
          Integration storage is not provisioned yet. Once the migration is
          applied, each user can connect their own destinations.
        </p>
      )}

      {message && (
        <p className="mt-3 rounded-lg border border-accent-gold/20 bg-accent-gold/5 px-3 py-2 text-[11px] text-ink-700 dark:text-ink-300">
          {message}
        </p>
      )}

      <div className="mt-4">
        <ZapierConnectionWizard />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {(loading ? [] : connections).filter((connection) => connection.provider !== "google").map((connection) => {
          const Icon = PROVIDER_ICONS[connection.provider];
          const providerPill = pillFor(connection.status, connection.provider);
          const selected = connection.selected_destinations ?? [];
          const groups = getDestinationGroups(
            connection.available_destinations,
            connection.provider
          );

          return (
            <article
              key={connection.provider}
              className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-accent-champagne/10 dark:bg-ink-950/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
                  <Icon size={16} />
                </div>
                <StatusPill status={providerPill.tone} label={providerPill.label} />
              </div>

              <p className="mt-3 text-sm font-medium text-ink-900 dark:text-ink-100">
                {PROVIDER_LABELS[connection.provider]}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                {PROVIDER_DESCRIPTIONS[connection.provider]}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {STUB_PROVIDERS.has(connection.provider) ? (
                  <span className="inline-flex h-8 items-center rounded-lg border border-ink-200 bg-ink-100/50 px-3 text-xs font-medium text-ink-500 dark:border-ink-700 dark:bg-ink-900/30 dark:text-ink-400">
                    Coming soon
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void connect(connection.provider)}
                    disabled={busyKey === `connect:${connection.provider}`}
                    className="btn-secondary h-8 px-3 text-xs disabled:opacity-40"
                  >
                    {busyKey === `connect:${connection.provider}`
                      ? "Starting…"
                      : connection.status === "connected"
                        ? "Reconnect"
                        : "Connect"}
                  </button>
                )}
                {connection.updated_at && (
                  <span className="text-[10px] text-ink-600 dark:text-ink-400">
                    updated {new Date(connection.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {connection.provider !== "google" &&
                connection.provider !== "gmail" &&
                connection.provider !== "google_drive" &&
                connection.provider !== "google_calendar" && (
                  <div className="mt-4 space-y-3">
                    {groups.map((group) => (
                      <div key={group.title}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                          {group.title}
                        </p>
                        <div className="mt-2 space-y-2">
                          {group.items.length === 0 ? (
                            <p className="text-[11px] text-ink-600 dark:text-ink-400">
                              {connection.provider === "google_social"
                                ? "Optional Direct Integration. Use Zapier for the recommended publishing path."
                                : "No destinations detected yet."}
                            </p>
                          ) : (
                            group.items.map((destination) => {
                              const selectKey = `select:${connection.provider}:${destination.destination_ref}`;
                              return (
                                <div
                                  key={`${destination.platform}:${destination.destination_ref}`}
                                  className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                                        {destination.destination_label}
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-ink-500 dark:text-ink-400">
                                        {destination.destination_type}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void postAction(
                                          {
                                            action: "select_destination",
                                            provider: providerForPlatform(
                                              destination.platform
                                            ),
                                            destination,
                                          },
                                          selectKey
                                        )
                                      }
                                      disabled={
                                        busyKey === selectKey ||
                                        connection.status !== "connected"
                                      }
                                      className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                                    >
                                      {busyKey === selectKey
                                        ? "Selecting…"
                                        : connection.status !== "connected"
                                        ? "Connect first"
                                        : "Select destination"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              {selected.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                    Selected destinations
                  </p>
                  {selected.map((destination) => {
                    const rowPill = destinationStatus(destination);
                    const testKey = `test:${destination.id}`;
                    const revokeKey = `revoke:${destination.id}`;
                    const publishKey = `publish:${destination.id}`;
                    return (
                      <div
                        key={destination.id}
                        className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                              {destination.destination_label ?? destination.destination_ref}
                            </p>
                            <p className="mt-0.5 text-[10px] text-ink-500 dark:text-ink-400">
                              {destination.platform}
                              {destination.destination_type
                                ? ` · ${destination.destination_type}`
                                : ""}
                            </p>
                          </div>
                          <StatusPill status={rowPill.tone} label={rowPill.label} />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void postAction(
                                { action: "test_destination", destination_id: destination.id },
                                testKey
                              )
                            }
                            disabled={busyKey === testKey || destination.status !== "connected"}
                            className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                          >
                            {busyKey === testKey ? "Testing…" : "Test"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void postAction(
                                { action: "revoke_destination", destination_id: destination.id },
                                revokeKey
                              )
                            }
                            disabled={busyKey === revokeKey}
                            className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                          >
                            {busyKey === revokeKey ? "Revoking…" : "Revoke"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void postAction(
                                {
                                  action: "set_publish_enabled",
                                  destination_id: destination.id,
                                  enabled: !destination.is_publish_enabled,
                                },
                                publishKey
                              )
                            }
                            disabled={busyKey === publishKey || destination.status !== "connected"}
                            className="btn-secondary h-8 px-3 text-xs disabled:opacity-40"
                          >
                            {busyKey === publishKey
                              ? "Saving…"
                              : destination.status !== "connected"
                                ? "Reconnect first"
                                : destination.is_publish_enabled
                                  ? "Disable publishing"
                                  : "Enable publishing"}
                          </button>
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
            </article>
          );
        })}
      </div>

      {isOwnerOrAdmin && (
        <section className="mt-6 rounded-2xl border border-ink-200 bg-white/70 p-4 dark:border-ink-800 dark:bg-ink-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Team connection status
              </h3>
              <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
                Owner/admin view only. Tokens stay server-side and are never
                shown here.
              </p>
            </div>
            <StatusPill status="info" label="status only" />
          </div>

          {Array.isArray(data?.team_destinations) && data.team_destinations.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-100 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-950/50 dark:text-ink-300">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Platform</th>
                    <th className="px-3 py-2">Destination</th>
                    <th className="px-3 py-2">Publishing</th>
                    <th className="px-3 py-2">Updated</th>
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
                      <td className="px-3 py-2 text-ink-600 dark:text-ink-400">
                        {row.updated_at
                          ? new Date(row.updated_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-xs text-ink-600 dark:text-ink-300">
              No team destinations have been saved yet.
            </p>
          )}
        </section>
      )}

      {loading && (
        <p className="mt-4 py-4 text-center text-[11px] text-ink-600 dark:text-ink-400">
          <Loader2 size={14} className="mr-2 inline animate-spin align-[-2px]" />
          Loading connection status…
        </p>
      )}
      <p className="mt-4 text-[11px] text-ink-600 dark:text-ink-400">
        Connection rows stay user-owned. Publishing toggles are per destination,
        and the app never falls back to a shared owner destination.
      </p>
      <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-400">
        {isOwnerOrAdmin
          ? "Team status visible: yes."
          : "Team status visible only to owner/admin."}
      </p>
    </section>
  );
}
