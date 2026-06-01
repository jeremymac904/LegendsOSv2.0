"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  HardDrive,
  Mail,
  UserCircle,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";

// Sprint 4 — Lane 5. Per-user Google integration cards in Settings.
//
// HONESTY: every status comes from /api/integrations/user-connections, which
// degrades to "setup_needed" when the user_integration_connections table is not
// provisioned yet (migration not applied). The Connect button calls
// /api/integrations/connect, which returns an honest setup-needed payload when
// Google OAuth env vars are absent. No token ever touches the client.

type ConnectionStatus =
  | "connected"
  | "setup_needed"
  | "error"
  | "disconnected";

interface ConnectionView {
  provider: "google" | "gmail" | "google_drive" | "google_calendar";
  label: string;
  status: ConnectionStatus;
  scopes: string[];
  updated_at: string | null;
}

interface TeamConnectionRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  provider: string;
  status: ConnectionStatus;
  updated_at: string | null;
}

interface ConnectionsResponse {
  ok: boolean;
  provisioned: boolean;
  connections: ConnectionView[];
  isOwnerOrAdmin: boolean;
  team: TeamConnectionRow[] | null;
}

const ICONS: Record<ConnectionView["provider"], typeof Mail> = {
  google: UserCircle,
  gmail: Mail,
  google_drive: HardDrive,
  google_calendar: CalendarDays,
};

const DESCRIPTIONS: Record<ConnectionView["provider"], string> = {
  google: "Sign in with Google to link your Workspace account to LegendsOS.",
  gmail: "Read-only Gmail access for AI intake and follow-up drafting.",
  google_drive: "Read-only Drive access so Atlas can retrieve approved files.",
  google_calendar: "Calendar access to read and create your scheduled events.",
};

// Map an honest connection status to a StatusPill tone + label. We never show
// green "connected" unless the API actually reports a connected row.
function pillFor(status: ConnectionStatus): {
  tone: "ok" | "info" | "warn" | "err" | "off";
  label: string;
} {
  switch (status) {
    case "connected":
      return { tone: "ok", label: "connected" };
    case "error":
      return { tone: "err", label: "needs attention" };
    case "disconnected":
      return { tone: "off", label: "disconnected" };
    default:
      return { tone: "warn", label: "setup needed" };
  }
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "google":
      return "Google account";
    case "gmail":
      return "Gmail";
    case "google_drive":
      return "Google Drive";
    case "google_calendar":
      return "Google Calendar";
    default:
      return provider;
  }
}

export function IntegrationConnections() {
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Per-provider connect feedback ("setup needed", "opening Google…", error).
  const [connectMsg, setConnectMsg] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  // Tracks an in-flight test/revoke action, keyed `${provider}:${action}`.
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/user-connections", {
        credentials: "include",
      });
      const json = (await res.json()) as ConnectionsResponse;
      if (json.ok) setData(json);
    } catch {
      // Network failure — keep whatever we have; cards still render defaults.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function connect(provider: ConnectionView["provider"]) {
    setConnecting(provider);
    setConnectMsg((m) => ({ ...m, [provider]: "" }));
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        status?: string;
        message?: string;
        authorize_url?: string;
      };
      if (!json.ok) {
        setConnectMsg((m) => ({
          ...m,
          [provider]: json.message ?? "Could not start connect.",
        }));
        return;
      }
      if (json.status === "oauth_start" && json.authorize_url) {
        // OAuth is configured — send the user to Google's consent screen.
        setConnectMsg((m) => ({ ...m, [provider]: "Opening Google sign-in…" }));
        window.location.href = json.authorize_url;
        return;
      }
      // Honest setup-needed (OAuth not configured by admin yet).
      setConnectMsg((m) => ({
        ...m,
        [provider]:
          json.message ?? "Setup needed — admin must configure Google OAuth.",
      }));
    } catch {
      setConnectMsg((m) => ({
        ...m,
        [provider]: "Network error starting connect.",
      }));
    } finally {
      setConnecting(null);
    }
  }

  async function test(provider: ConnectionView["provider"]) {
    setActionBusy(`${provider}:test`);
    setConnectMsg((m) => ({ ...m, [provider]: "Testing connection…" }));
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; error?: string };
      setConnectMsg((m) => ({ ...m, [provider]: json.message ?? json.error ?? "Test complete." }));
      await load();
    } catch {
      setConnectMsg((m) => ({ ...m, [provider]: "Network error testing connection." }));
    } finally {
      setActionBusy(null);
    }
  }

  async function revoke(provider: ConnectionView["provider"]) {
    setActionBusy(`${provider}:revoke`);
    setConnectMsg((m) => ({ ...m, [provider]: "Revoking…" }));
    try {
      const res = await fetch("/api/integrations/revoke", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; error?: string };
      setConnectMsg((m) => ({
        ...m,
        [provider]: json.ok ? "Disconnected. Tokens deleted server-side." : json.message ?? "Revoke failed.",
      }));
      await load();
    } catch {
      setConnectMsg((m) => ({ ...m, [provider]: "Network error revoking." }));
    } finally {
      setActionBusy(null);
    }
  }

  const connections = data?.connections ?? [];
  const provisioned = data?.provisioned ?? false;

  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>Google integrations</h2>
          <p>
            Connect your own Google account, Gmail, Drive, and Calendar. Status
            is honest — &ldquo;connected&rdquo; only appears after a real grant.
            Tokens are stored server-side only and never shown here.
          </p>
        </div>
      </div>

      {!loading && !provisioned && (
        <p className="mt-3 rounded-lg border border-status-warn/30 bg-status-warn/5 px-3 py-2 text-[11px] text-ink-700 dark:text-ink-300">
          Integration storage is not provisioned yet. These cards show the setup
          path; connecting becomes available once the migration is applied and
          Google OAuth is configured.
        </p>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(loading ? [] : connections).map((c) => {
          const Icon = ICONS[c.provider];
          const pill = pillFor(c.status);
          const msg = connectMsg[c.provider];
          const isConnected = c.status === "connected";
          return (
            <div
              key={c.provider}
              className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-accent-champagne/10 dark:bg-ink-950/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
                  <Icon size={16} />
                </div>
                <StatusPill status={pill.tone} label={pill.label} />
              </div>
              <p className="mt-3 text-sm font-medium text-ink-900 dark:text-ink-100">
                {c.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                {DESCRIPTIONS[c.provider]}
              </p>

              {c.scopes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.scopes.slice(0, 3).map((s) => (
                    <span key={s} className="chip font-mono text-[10px]">
                      {s.replace("https://www.googleapis.com/auth/", "")}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => connect(c.provider)}
                  disabled={connecting === c.provider}
                  className="btn-secondary h-8 px-3 text-xs disabled:opacity-40"
                >
                  {connecting === c.provider
                    ? "Starting…"
                    : isConnected
                      ? "Reconnect"
                      : "Connect"}
                </button>
                <button
                  type="button"
                  onClick={() => test(c.provider)}
                  disabled={actionBusy === `${c.provider}:test`}
                  className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                >
                  {actionBusy === `${c.provider}:test` ? "Testing…" : "Test"}
                </button>
                {(isConnected || c.status === "error") && (
                  <button
                    type="button"
                    onClick={() => revoke(c.provider)}
                    disabled={actionBusy === `${c.provider}:revoke`}
                    className="btn-ghost h-8 px-3 text-xs text-status-err disabled:opacity-40"
                  >
                    {actionBusy === `${c.provider}:revoke` ? "Revoking…" : "Revoke"}
                  </button>
                )}
                {c.updated_at && (
                  <span className="text-[10px] text-ink-600 dark:text-ink-400">
                    updated {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {msg && (
                <p className="mt-2 text-[11px] leading-relaxed text-ink-700 dark:text-ink-300">
                  {msg}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {loading && (
        <p className="mt-4 py-4 text-center text-[11px] text-ink-600 dark:text-ink-400">
          Loading connection status…
        </p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-ink-600 dark:text-ink-400">
        The Connect button starts a real Google OAuth step when the admin has
        configured the OAuth client. When it has not, it honestly says
        &ldquo;setup needed&rdquo; instead of pretending to connect. Token
        exchange + storage are server-side only.
      </p>

      {data?.isOwnerOrAdmin && (
        <div className="mt-6">
          <div className="section-title">
            <div>
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Team connection status
              </h3>
              <p className="text-xs text-ink-700 dark:text-ink-300">
                Who has connected what. Status only — no tokens are ever read or
                shown.
              </p>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-accent-champagne/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-100 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-950/50 dark:text-ink-300">
                <tr>
                  <th className="px-3 py-2">Team member</th>
                  <th className="px-3 py-2">Integration</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(data.team ?? []).length === 0 ? (
                  <tr className="border-t border-accent-champagne/10">
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-[11px] text-ink-600 dark:text-ink-400"
                    >
                      No team connections yet.
                    </td>
                  </tr>
                ) : (
                  (data.team ?? []).map((row, i) => {
                    const pill = pillFor(row.status);
                    return (
                      <tr
                        key={`${row.user_id}-${row.provider}-${i}`}
                        className="border-t border-accent-champagne/10"
                      >
                        <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                          {row.full_name || row.email || row.user_id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2 text-ink-700 dark:text-ink-300">
                          {providerLabel(row.provider)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill status={pill.tone} label={pill.label} />
                        </td>
                        <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                          {row.updated_at
                            ? new Date(row.updated_at).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
