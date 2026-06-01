"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Facebook,
  HardDrive,
  KeyRound,
  Loader2,
  Mail,
  PlugZap,
  ShieldCheck,
  Workflow,
  Youtube,
  Zap,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { LiveActionToggles } from "@/components/settings/LiveActionToggles";
import { cn } from "@/lib/utils";

// Owner-facing OAuth Connection Center (client).
//
// HONESTY CONTRACT: every status pill is derived from real data returned by the
// four /api/integrations/* GET routes. We never render "Connected"/"Enabled"
// unless a row actually says so. Missing credentials produce a "Not configured"
// pill plus a non-secret setup checklist (env var NAMES + the redirect URI to
// register) — we never print a secret value. Buttons that can't act yet are
// absent or disabled with a reason, never dead.

// ---------------------------------------------------------------------------
// API response types (mirrors of the route contracts; client-side only).
// ---------------------------------------------------------------------------

interface StatusResponse {
  ok: boolean;
  providers: Record<string, { configured: boolean; paid_enabled: boolean }>;
  automations: {
    n8n: {
      configured: boolean;
      base_url_present: boolean;
      webhooks: Record<string, boolean>;
    };
  };
  integrations: {
    meta: { configured: boolean; paid_enabled: boolean; capabilities: string[] };
    gbp: {
      configured: boolean;
      publish_implemented: boolean;
      capabilities: string[];
    };
    youtube: {
      configured: boolean;
      publish_implemented: boolean;
      capabilities: string[];
    };
    google_oauth: {
      configured: boolean;
      redirect_uri_expected: string;
      capabilities: string[];
    };
  };
  safety_flags: Record<string, boolean>;
  owner_email: string | null;
  supabase_project_url: string | null;
}

type ConnStatus = "connected" | "setup_needed" | "error" | "disconnected";

interface UserConnection {
  provider: string;
  label: string;
  status: ConnStatus;
  scopes: string[];
  updated_at: string | null;
}

interface TeamConnection {
  user_id: string;
  full_name: string | null;
  email: string | null;
  provider: string;
  status: ConnStatus;
  updated_at: string | null;
}

interface UserConnectionsResponse {
  ok: boolean;
  provisioned: boolean;
  connections: UserConnection[];
  isOwnerOrAdmin: boolean;
  team: TeamConnection[] | null;
}

interface MetaResponse {
  ok: boolean;
  provisioned: boolean;
  connection: {
    connected: boolean;
    account_ref: string | null;
    is_publish_enabled: boolean;
    status: string | null;
    updated_at: string | null;
  } | null;
  config: { configured: boolean; paid_enabled: boolean; capabilities: string[] };
  readiness: unknown;
  can_manage: boolean;
}

export interface IntegrationActivityRow {
  id: string;
  action: string;
  provider: string | null;
  actor_id: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface Props {
  recentActivity: IntegrationActivityRow[];
  ownerEmail: string | null;
}

type PillTone = "ok" | "info" | "warn" | "err" | "off";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    const json = (await res.json()) as T & { ok?: boolean };
    if (json && json.ok === false) return null;
    return json as T;
  } catch {
    return null;
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function prettyAction(action: string): string {
  return action.replace(/[_.]/g, " ");
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function CardShell({
  icon: Icon,
  title,
  subtitle,
  pillTone,
  pillLabel,
  children,
}: {
  icon: typeof Mail;
  title: string;
  subtitle: string;
  pillTone: PillTone;
  pillLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-ink-200 bg-white/60 p-4 dark:border-ink-800 dark:bg-ink-900/40">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
          <Icon size={16} />
        </div>
        <StatusPill status={pillTone} label={pillLabel} />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
        {subtitle}
      </p>
      <div className="mt-3 flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

// A non-secret setup checklist. Shows env var NAMES (never values) and an
// optional redirect URI to register. Present items show a green check derived
// from real config; unknown presence shows a neutral dot.
function SetupChecklist({
  title = "Setup checklist",
  vars,
  note,
  redirectUri,
}: {
  title?: string;
  vars: { name: string; present?: boolean }[];
  note?: string;
  redirectUri?: string;
}) {
  return (
    <div className="mt-1 rounded-lg border border-ink-200 bg-ink-50/60 p-2.5 dark:border-ink-800 dark:bg-ink-950/30">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {vars.map((v) => (
          <li
            key={v.name}
            className="flex items-center gap-2 font-mono text-[10px] text-ink-700 dark:text-ink-300"
          >
            <span
              aria-hidden
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                v.present === true
                  ? "bg-status-ok"
                  : v.present === false
                    ? "bg-status-warn"
                    : "bg-ink-400"
              )}
            />
            {v.name}
            {v.present === true && (
              <span className="font-sans text-[9px] text-status-ok">present</span>
            )}
            {v.present === false && (
              <span className="font-sans text-[9px] text-status-warn">missing</span>
            )}
          </li>
        ))}
      </ul>
      {redirectUri && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
            Redirect URI to register
          </p>
          <p className="mt-0.5 break-all font-mono text-[10px] text-ink-700 dark:text-ink-300">
            {redirectUri}
          </p>
          <p className="mt-0.5 text-[10px] text-ink-500 dark:text-ink-400">
            Register this exact URL in your Google Cloud OAuth client.
          </p>
        </div>
      )}
      {note && (
        <p className="mt-2 text-[10px] leading-relaxed text-ink-600 dark:text-ink-400">
          {note}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const GOOGLE_CARD_META: Record<
  string,
  { provider: "gmail" | "google_drive" | "google_calendar"; icon: typeof Mail; subtitle: string }
> = {
  gmail: {
    provider: "gmail",
    icon: Mail,
    subtitle:
      "Read-only Gmail access for AI intake and follow-up drafting. Acts on your own connection.",
  },
  google_drive: {
    provider: "google_drive",
    icon: HardDrive,
    subtitle:
      "Read-only Drive access so Atlas can retrieve approved files. Acts on your own connection.",
  },
  google_calendar: {
    provider: "google_calendar",
    icon: CalendarDays,
    subtitle:
      "Calendar access to read and create your scheduled events. Acts on your own connection.",
  },
};

export function ConnectionCenter({ recentActivity, ownerEmail }: Props) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [userConns, setUserConns] = useState<UserConnectionsResponse | null>(null);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-provider action feedback + in-flight markers for the Google cards.
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [metaBusy, setMetaBusy] = useState(false);

  const loadAll = useCallback(async () => {
    const [s, u, m] = await Promise.all([
      getJson<StatusResponse>("/api/integrations/status"),
      getJson<UserConnectionsResponse>("/api/integrations/user-connections"),
      getJson<MetaResponse>("/api/integrations/meta"),
    ]);
    if (s) setStatus(s);
    if (u) setUserConns(u);
    if (m) setMeta(m);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const googleOauth = status?.integrations.google_oauth;
  const oauthConfigured = Boolean(googleOauth?.configured);
  const connByProvider = new Map(
    (userConns?.connections ?? []).map((c) => [c.provider, c])
  );

  // Map a Google connection row to an honest pill. When no row says connected,
  // "Ready to connect" only when OAuth is configured; otherwise "Not configured".
  function googlePill(conn: UserConnection | undefined): {
    tone: PillTone;
    label: string;
  } {
    const s = conn?.status ?? "setup_needed";
    if (s === "connected") return { tone: "ok", label: "Connected" };
    if (s === "error") return { tone: "err", label: "Needs reauth / failed" };
    if (s === "disconnected") return { tone: "off", label: "Disabled by user" };
    return oauthConfigured
      ? { tone: "info", label: "Ready to connect" }
      : { tone: "warn", label: "Not configured" };
  }

  // ----- Google per-card actions (act on the OWNER'S own connection) -----

  async function googleAction(
    provider: "gmail" | "google_drive" | "google_calendar",
    kind: "connect" | "test" | "revoke"
  ) {
    const key = `${provider}:${kind}`;
    setBusy(key);
    setActionMsg((m) => ({ ...m, [provider]: "" }));
    try {
      const res = await fetch(`/api/integrations/${kind}`, {
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

      if (kind === "connect") {
        if (json.ok && json.status === "oauth_start" && json.authorize_url) {
          setActionMsg((m) => ({ ...m, [provider]: "Opening Google sign-in…" }));
          window.location.href = json.authorize_url;
          return;
        }
        setActionMsg((m) => ({
          ...m,
          [provider]:
            json.message ??
            "Setup needed — admin must configure Google OAuth before connecting.",
        }));
        return;
      }

      // test / revoke: surface the returned status + message, then refetch.
      const label = json.status ? json.status.replace(/_/g, " ") : json.ok ? "ok" : "failed";
      setActionMsg((m) => ({
        ...m,
        [provider]: json.message ? `${label} — ${json.message}` : label,
      }));
      await loadAll();
    } catch {
      setActionMsg((m) => ({ ...m, [provider]: "Network error. Try again." }));
    } finally {
      setBusy(null);
    }
  }

  // ----- Meta owner-approval switch -----

  async function setMetaPublishEnabled(enabled: boolean) {
    setMetaBusy(true);
    setActionMsg((m) => ({ ...m, meta: "" }));
    try {
      const res = await fetch("/api/integrations/meta", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "set_publish_enabled", enabled }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; note?: string };
      if (!json.ok) {
        setActionMsg((m) => ({
          ...m,
          meta: json.message ?? "Could not update the approval switch.",
        }));
      } else {
        setActionMsg((m) => ({ ...m, meta: json.note ?? "Approval switch updated." }));
        await loadAll();
      }
    } catch {
      setActionMsg((m) => ({ ...m, meta: "Network error updating switch." }));
    } finally {
      setMetaBusy(false);
    }
  }

  // ----- Derived bits for the Google OAuth plumbing card -----

  const oauthPill: { tone: PillTone; label: string } = oauthConfigured
    ? { tone: "ok", label: "Ready (OAuth configured)" }
    : { tone: "warn", label: "Not configured" };

  const n8n = status?.automations.n8n;
  const n8nConfigured = Boolean(n8n?.configured);
  const metaConfig = meta?.config ?? status?.integrations.meta;
  const metaConfigured = Boolean(metaConfig?.configured);
  const metaConnected = Boolean(meta?.connection?.connected);
  const metaPublishEnabled = Boolean(meta?.connection?.is_publish_enabled);
  const metaCanManage = meta?.can_manage ?? true;

  const youtube = status?.integrations.youtube;
  const gbp = status?.integrations.gbp;

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connection status…
        </div>
      )}

      {!loading && !status && (
        <section className="card-padded border-status-warn/30 bg-status-warn/10">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 text-status-warn" />
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Status feed unavailable
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                The integration status endpoint did not return data. Cards below
                fall back to honest &ldquo;Not configured&rdquo; states instead of
                pretending anything is connected.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 1) Live actions (owner) ------------------------------------------ */}
      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2 className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-accent-gold" />
              Live actions (owner)
            </h2>
            <p>
              Org-wide kill switch and per-channel live toggles. These gate
              whether email/social/calendar/Drive actions actually execute. Safe
              defaults are off.
            </p>
          </div>
        </div>
        <LiveActionToggles scope="global" />
      </section>

      {/* 2) Integrations grid -------------------------------------------- */}
      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2 className="flex items-center gap-2">
              <PlugZap size={15} className="text-accent-gold" />
              Integrations
            </h2>
            <p>
              Each card shows a real, data-derived status. Missing credentials
              show a non-secret setup checklist (env var names only) — secret
              values are never displayed.
            </p>
          </div>
          {ownerEmail && (
            <span className="text-[11px] text-ink-500 dark:text-ink-400">
              owner · {ownerEmail}
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {/* Google OAuth (plumbing) */}
          <CardShell
            icon={KeyRound}
            title="Google OAuth (plumbing)"
            subtitle="The OAuth client every Google integration (Gmail, Drive, Calendar) authenticates through. Configure once in Google Cloud."
            pillTone={oauthPill.tone}
            pillLabel={oauthPill.label}
          >
            <SetupChecklist
              title="Required env vars"
              vars={[
                // configured implies the first two are present.
                { name: "GOOGLE_OAUTH_CLIENT_ID", present: oauthConfigured ? true : undefined },
                { name: "GOOGLE_OAUTH_CLIENT_SECRET", present: oauthConfigured ? true : undefined },
                { name: "GOOGLE_OAUTH_REDIRECT_URI" },
              ]}
              redirectUri={googleOauth?.redirect_uri_expected}
            />
          </CardShell>

          {/* Gmail / Drive / Calendar */}
          {(["gmail", "google_drive", "google_calendar"] as const).map((providerKey) => {
            const cfg = GOOGLE_CARD_META[providerKey];
            const conn = connByProvider.get(providerKey);
            const pill = googlePill(conn);
            const title =
              providerKey === "gmail"
                ? "Gmail"
                : providerKey === "google_drive"
                  ? "Google Drive"
                  : "Google Calendar";
            const msg = actionMsg[providerKey];
            const isConnected = conn?.status === "connected";
            const connectBusy = busy === `${providerKey}:connect`;
            const testBusy = busy === `${providerKey}:test`;
            const revokeBusy = busy === `${providerKey}:revoke`;
            return (
              <CardShell
                key={providerKey}
                icon={cfg.icon}
                title={title}
                subtitle={cfg.subtitle}
                pillTone={pill.tone}
                pillLabel={pill.label}
              >
                {conn?.scopes && conn.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {conn.scopes.slice(0, 3).map((s) => (
                      <span key={s} className="chip font-mono text-[10px]">
                        {s.replace("https://www.googleapis.com/auth/", "")}
                      </span>
                    ))}
                  </div>
                )}

                {!oauthConfigured && (
                  <SetupChecklist
                    vars={[
                      { name: "GOOGLE_OAUTH_CLIENT_ID", present: false },
                      { name: "GOOGLE_OAUTH_CLIENT_SECRET", present: false },
                    ]}
                    note="Configure the Google OAuth client (above) before this can connect."
                  />
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => googleAction(cfg.provider, "connect")}
                    disabled={connectBusy}
                    className="btn-secondary h-8 px-3 text-xs disabled:opacity-40"
                  >
                    {connectBusy ? "Starting…" : isConnected ? "Reconnect" : "Connect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => googleAction(cfg.provider, "test")}
                    disabled={testBusy}
                    className="btn-ghost h-8 px-3 text-xs disabled:opacity-40"
                  >
                    {testBusy ? "Testing…" : "Test"}
                  </button>
                  <button
                    type="button"
                    onClick={() => googleAction(cfg.provider, "revoke")}
                    disabled={revokeBusy || !isConnected}
                    title={isConnected ? "Revoke this connection" : "Nothing to revoke yet"}
                    className="btn-ghost h-8 px-3 text-xs text-status-err disabled:opacity-40"
                  >
                    {revokeBusy ? "Revoking…" : "Revoke"}
                  </button>
                  {conn?.updated_at && (
                    <span className="text-[10px] text-ink-500 dark:text-ink-400">
                      updated {formatWhen(conn.updated_at)}
                    </span>
                  )}
                </div>

                {msg && (
                  <p className="text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
                    {msg}
                  </p>
                )}
              </CardShell>
            );
          })}

          {/* Meta (Facebook + Instagram) */}
          <CardShell
            icon={Facebook}
            title="Meta (Facebook + Instagram)"
            subtitle="Page + Instagram publishing. Requires a connected account, owner approval, and the live-social toggle. Publisher wiring is pending."
            pillTone={
              !metaConfigured
                ? "warn"
                : metaConnected
                  ? metaPublishEnabled
                    ? "ok"
                    : "info"
                  : "info"
            }
            pillLabel={
              !metaConfigured
                ? "Not configured"
                : metaConnected
                  ? metaPublishEnabled
                    ? "Connected · approved"
                    : "Connected · owner approval required"
                  : "Configured · not connected"
            }
          >
            {!metaConfigured ? (
              <SetupChecklist
                vars={[
                  { name: "META_APP_ID", present: false },
                  { name: "META_APP_SECRET", present: false },
                  { name: "META_PAGE_ID", present: false },
                  { name: "META_INSTAGRAM_ACCOUNT_ID", present: false },
                ]}
                note="Live publishing requires connected account + owner approval + live-social toggle; publisher wiring is pending."
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white/50 p-2.5 dark:border-ink-800 dark:bg-ink-950/30">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-900 dark:text-ink-100">
                      Owner approval to publish
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-600 dark:text-ink-300">
                      Approval alone never sends. Live-social toggle + connected
                      account are still required.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={metaPublishEnabled}
                    disabled={!metaCanManage || metaBusy}
                    onClick={() => setMetaPublishEnabled(!metaPublishEnabled)}
                    title={
                      metaCanManage
                        ? metaPublishEnabled
                          ? "Click to remove approval"
                          : "Click to approve publishing"
                        : "Owner only"
                    }
                    className={cn(
                      "relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border transition",
                      metaPublishEnabled
                        ? "border-status-ok/40 bg-status-ok/30"
                        : "border-ink-300 bg-ink-200 dark:border-ink-700 dark:bg-ink-800",
                      (!metaCanManage || metaBusy) && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition dark:bg-ink-100",
                        metaPublishEnabled ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
                <p className="text-[10px] leading-relaxed text-ink-600 dark:text-ink-300">
                  Live publishing requires connected account + owner approval +
                  live-social toggle; publisher wiring is pending.
                </p>
              </>
            )}
            {actionMsg.meta && (
              <p className="text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
                {actionMsg.meta}
              </p>
            )}
          </CardShell>

          {/* YouTube */}
          <CardShell
            icon={Youtube}
            title="YouTube"
            subtitle="Channel target for future publishing. Authentication runs through Google OAuth."
            pillTone={youtube?.configured ? "info" : "warn"}
            pillLabel={
              youtube?.configured ? "Configured (publisher pending)" : "Not configured"
            }
          >
            <SetupChecklist
              vars={[{ name: "YOUTUBE_CHANNEL_ID", present: youtube?.configured ?? undefined }]}
              note="Publishing not implemented yet — there is no Test/Publish action because the platform cannot post to YouTube."
            />
          </CardShell>

          {/* Google Business Profile */}
          <CardShell
            icon={Building2}
            title="Google Business Profile"
            subtitle="GBP location target for future posts + review replies. Authentication runs through Google OAuth."
            pillTone={gbp?.configured ? "info" : "warn"}
            pillLabel={
              gbp?.configured ? "Configured (publisher pending)" : "Not configured"
            }
          >
            <SetupChecklist
              vars={[
                { name: "GBP_ACCOUNT_ID", present: gbp?.configured ?? undefined },
                { name: "GBP_LOCATION_ID", present: gbp?.configured ?? undefined },
              ]}
              note="Publishing not implemented yet — there is no Test/Publish action because the platform cannot post to GBP."
            />
          </CardShell>

          {/* n8n */}
          <CardShell
            icon={Workflow}
            title="n8n automations"
            subtitle="Workflow webhooks Atlas and the studios trigger. Configure a base URL and per-workflow webhook URLs."
            pillTone={n8nConfigured ? "ok" : "warn"}
            pillLabel={n8nConfigured ? "Configured" : "Not configured"}
          >
            <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-2.5 dark:border-ink-800 dark:bg-ink-950/30">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                Base URL
              </p>
              <p className="mt-0.5 text-[11px] text-ink-700 dark:text-ink-300">
                {n8n?.base_url_present ? "present" : "missing"}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                Webhooks
              </p>
              {n8n && Object.keys(n8n.webhooks).length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {Object.entries(n8n.webhooks).map(([name, present]) => (
                    <li
                      key={name}
                      className="flex items-center gap-2 font-mono text-[10px] text-ink-700 dark:text-ink-300"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          present ? "bg-status-ok" : "bg-ink-400"
                        )}
                      />
                      {name}
                      <span className="font-sans text-[9px] text-ink-500 dark:text-ink-400">
                        {present ? "set" : "unset"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-[11px] text-ink-600 dark:text-ink-400">
                  No webhook keys reported.
                </p>
              )}
            </div>
          </CardShell>

          {/* Zapier MCP */}
          <CardShell
            icon={Zap}
            title="Zapier MCP"
            subtitle="Per-user automation bridge. Configured individually under Settings → MCP connections, not globally here."
            pillTone="info"
            pillLabel="Configured per user"
          >
            <p className="text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
              Zapier MCP is connected per team member in{" "}
              <span className="font-medium text-ink-800 dark:text-ink-200">
                Settings → MCP connections
              </span>
              . There is no org-wide credential to set here.
            </p>
          </CardShell>
        </div>
      </section>

      {/* 3) Connected team members --------------------------------------- */}
      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Connected team members</h2>
            <p>Who has connected what. Status only — no tokens are ever read or shown.</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-100/70 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
              <tr>
                <th className="px-3 py-2">Team member</th>
                <th className="px-3 py-2">Integration</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {!userConns?.provisioned || (userConns?.team ?? []).length === 0 ? (
                <tr className="border-t border-ink-200 dark:border-ink-800">
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-[11px] text-ink-500 dark:text-ink-400"
                  >
                    No team connections yet.
                  </td>
                </tr>
              ) : (
                (userConns?.team ?? []).map((row, i) => {
                  const pill = googlePill({
                    provider: row.provider,
                    label: row.provider,
                    status: row.status,
                    scopes: [],
                    updated_at: row.updated_at,
                  });
                  return (
                    <tr
                      key={`${row.user_id}-${row.provider}-${i}`}
                      className="border-t border-ink-200 dark:border-ink-800"
                    >
                      <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                        {row.full_name || row.email || row.user_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 text-ink-700 dark:text-ink-300">
                        {row.provider}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={pill.tone} label={pill.label} />
                      </td>
                      <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                        {formatWhen(row.updated_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4) Recent integration activity ---------------------------------- */}
      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Recent integration activity</h2>
            <p>
              Append-only audit of integration actions (NON-secret detail only),
              newest first.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-100/70 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
              <tr>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr className="border-t border-ink-200 dark:border-ink-800">
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-[11px] text-ink-500 dark:text-ink-400"
                  >
                    No integration activity yet.
                  </td>
                </tr>
              ) : (
                recentActivity.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-ink-200 dark:border-ink-800"
                  >
                    <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                      {prettyAction(row.action)}
                    </td>
                    <td className="px-3 py-2 text-ink-700 dark:text-ink-300">
                      {row.provider ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                      {formatWhen(row.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
