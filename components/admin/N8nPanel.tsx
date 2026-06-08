"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";

type PillTone = "ok" | "warn" | "err" | "info" | "off";

interface N8nConfigState {
  configured: boolean;
  base_url_present: boolean;
  webhooks: Record<string, boolean>;
  api_key_present: boolean;
  hmac_secret_present: boolean;
  n8n_dispatch_allowed: boolean;
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  tags?: string[];
}

interface LocalWorkflow {
  file: string;
  name: string;
  active: boolean;
  node_count: number;
  credential_reference_count: number;
  credential_placeholder_count: number;
  env_reference_count: number;
  env_references: string[];
  webhook_paths: string[];
}

interface WebhookStatus {
  key: string;
  env_var: string;
  present: boolean;
}

interface AutomationJobRow {
  id: string;
  user_id: string | null;
  job_type: string;
  module: string | null;
  target_table: string | null;
  target_id: string | null;
  inferred_webhook_key: string | null;
  webhook_configured: boolean;
  webhook_url_present: boolean;
  status: string;
  attempts: number;
  created_at: string | null;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
}

interface DispatchLog {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string | null;
  metadata: Record<string, unknown>;
}

interface CredentialPresence {
  provider: string;
  stored_status: string | null;
  env_var_name: string | null;
  is_enabled: boolean | null;
  updated_at: string | null;
}

interface N8nStatusResponse {
  ok: boolean;
  configured: boolean;
  api_configured: boolean;
  workflow_list_status: string;
  workflow_list_message: string;
  config: N8nConfigState;
  webhookStatus: WebhookStatus[];
  workflows: N8nWorkflow[];
  localWorkflows: LocalWorkflow[];
  recentJobs: AutomationJobRow[];
  dispatchLogs: DispatchLog[];
  credentialPresence: CredentialPresence | null;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "-";
}

function pretty(value: string | null | undefined): string {
  return value ? value.replace(/_/g, " ") : "-";
}

function jobTone(status: string): PillTone {
  if (status === "succeeded" || status === "sent") return "ok";
  if (status === "failed") return "err";
  if (status === "queued") return "info";
  if (status === "cancelled") return "off";
  return "warn";
}

function PresenceLine({
  label,
  present,
  detail,
}: {
  label: string;
  present: boolean;
  detail?: string | null;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white/60 px-3 py-2 text-sm dark:border-ink-800 dark:bg-ink-900/40">
      <div className="min-w-0">
        <p className="font-medium text-ink-900 dark:text-ink-100">{label}</p>
        {detail && (
          <p className="mt-0.5 break-all font-mono text-[10px] text-ink-500 dark:text-ink-400">
            {detail}
          </p>
        )}
      </div>
      <StatusPill
        status={present ? "ok" : "warn"}
        label={present ? "present" : "missing"}
      />
    </li>
  );
}

function SectionBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="card-padded space-y-4">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2">
            <Icon size={15} className="text-accent-gold" />
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export function N8nPanel() {
  const [data, setData] = useState<N8nStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryResults, setRetryResults] = useState<
    Record<string, { ok: boolean; message: string } | null>
  >({});
  const [retryBusy, setRetryBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/n8n", {
        credentials: "include",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        setFetchError(`API returned ${res.status}`);
        return;
      }
      setData((await res.json()) as N8nStatusResponse);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retryJob(jobId: string) {
    setRetryBusy(jobId);
    setRetryResults((r) => ({ ...r, [jobId]: null }));
    try {
      const res = await fetch("/api/admin/n8n", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retry_job", job_id: jobId }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        status?: string;
        reason?: string;
        new_job_id?: string;
        dispatch?: boolean;
        dispatch_reason?: string;
        message?: string;
      };
      setRetryResults((r) => ({
        ...r,
        [jobId]: {
          ok: json.ok,
          message: json.ok
            ? `New job ${shortId(json.new_job_id)} (${json.status}; ${json.dispatch ? "dispatch requested" : `queued: ${json.dispatch_reason}`})`
            : json.message ?? json.reason ?? "Retry failed",
        },
      }));
      if (json.ok) void load();
    } catch {
      setRetryResults((r) => ({
        ...r,
        [jobId]: { ok: false, message: "Network error" },
      }));
    } finally {
      setRetryBusy(null);
    }
  }

  const config = data?.config;
  const failedJobs = data?.recentJobs.filter((job) => job.status === "failed") ?? [];

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading n8n status...
        </div>
      )}

      {!loading && fetchError && (
        <section className="rounded-xl border border-status-err/30 bg-status-err/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 text-status-err" />
            <div>
              <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Could not load n8n status
              </p>
              <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
                {fetchError}
              </p>
            </div>
          </div>
        </section>
      )}

      {!loading && !fetchError && data && config && (
        <>
          <section className="card-padded space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                  <Zap size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                    n8n control center
                  </p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    Presence-only config, queue status, safe retry, and workflow registry.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill
                  status={data.configured ? "ok" : "warn"}
                  label={data.configured ? "configured" : "setup needed"}
                />
                <button
                  type="button"
                  onClick={() => void load()}
                  className="btn-ghost h-7 px-2 text-xs"
                  title="Refresh"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <PresenceLine
                label="Base URL"
                present={config.base_url_present}
                detail="N8N_BASE_URL / N8N_WEBHOOK_BASE_URL"
              />
              <PresenceLine
                label="API key"
                present={config.api_key_present}
                detail="N8N_API_KEY"
              />
              <PresenceLine
                label="Callback HMAC"
                present={config.hmac_secret_present}
                detail="N8N_WEBHOOK_SECRET"
              />
              <PresenceLine
                label="n8n dispatch gate"
                present={config.n8n_dispatch_allowed}
                detail="integration_settings.provider_flags.allow_n8n_dispatch"
              />
            </div>

            <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3 dark:border-ink-800 dark:bg-ink-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
                    <KeyRound size={14} className="text-accent-gold" />
                    Credential presence
                  </p>
                  <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
                    Environment and stored provider rows only. Secret values are never returned.
                  </p>
                </div>
                <StatusPill
                  status={data.credentialPresence?.stored_status === "configured" ? "ok" : "warn"}
                  label={data.credentialPresence?.stored_status ?? "missing"}
                />
              </div>
              <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
                Stored provider row:{" "}
                <span className="font-mono">
                  {data.credentialPresence?.env_var_name ?? "n8n provider row not found"}
                </span>
                {data.credentialPresence?.updated_at
                  ? ` · updated ${formatWhen(data.credentialPresence.updated_at)}`
                  : ""}
              </p>
            </div>
          </section>

          <SectionBlock title="Webhook Status" icon={Webhook}>
            <div className="grid gap-2 md:grid-cols-2">
              {data.webhookStatus.map((hook) => (
                <PresenceLine
                  key={hook.key}
                  label={hook.key}
                  present={hook.present}
                  detail={hook.env_var}
                />
              ))}
            </div>
          </SectionBlock>

          <SectionBlock title="Workflow Registry" icon={Workflow}>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-ink-200 dark:border-ink-800">
                <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-3 py-2 dark:border-ink-800">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
                    <FileJson size={14} className="text-accent-gold" />
                    Local workflow files
                  </p>
                  <StatusPill status="info" label={`${data.localWorkflows.length} files`} />
                </div>
                <div className="divide-y divide-ink-200 dark:divide-ink-800">
                  {data.localWorkflows.length === 0 ? (
                    <p className="p-3 text-xs text-ink-500 dark:text-ink-400">
                      No local workflow files found.
                    </p>
                  ) : (
                    data.localWorkflows.map((wf) => (
                      <div key={wf.file} className="p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-ink-900 dark:text-ink-100">
                              {wf.name}
                            </p>
                            <p className="mt-0.5 break-all font-mono text-[10px] text-ink-500 dark:text-ink-400">
                              {wf.file}
                            </p>
                          </div>
                          <StatusPill
                            status={wf.active ? "warn" : "off"}
                            label={wf.active ? "active in file" : "inactive"}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-ink-600 dark:text-ink-300">
                          {wf.node_count} nodes · {wf.credential_reference_count} credential refs · {wf.credential_placeholder_count} placeholders · {wf.env_reference_count} env refs
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-ink-200 dark:border-ink-800">
                <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-3 py-2 dark:border-ink-800">
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                    n8n API workflow list
                  </p>
                  <StatusPill
                    status={data.workflow_list_status === "listed" ? "ok" : "warn"}
                    label={data.workflow_list_status}
                  />
                </div>
                <p className="px-3 pt-3 text-xs text-ink-600 dark:text-ink-300">
                  {data.workflow_list_message}
                </p>
                <div className="mt-3 divide-y divide-ink-200 dark:divide-ink-800">
                  {data.workflows.length === 0 ? (
                    <p className="px-3 pb-3 text-xs text-ink-500 dark:text-ink-400">
                      No active workflows returned by the n8n API.
                    </p>
                  ) : (
                    data.workflows.map((wf) => (
                      <div key={wf.id} className="px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-ink-900 dark:text-ink-100">
                            {wf.name}
                          </p>
                          <StatusPill
                            status={wf.active ? "ok" : "off"}
                            label={wf.active ? "active" : "inactive"}
                          />
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-ink-500 dark:text-ink-400">
                          {wf.id}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="Job Queue" icon={RotateCcw}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-600 dark:text-ink-300">
                Last 20 automation jobs. Payloads and webhook URLs are excluded.
              </p>
              <StatusPill
                status={failedJobs.length > 0 ? "warn" : "ok"}
                label={`${failedJobs.length} failed`}
              />
            </div>
            {data.recentJobs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-300 p-3 text-sm text-ink-500 dark:border-ink-800 dark:text-ink-400">
                No automation jobs recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-ink-100/70 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Webhook</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Attempts</th>
                      <th className="px-3 py-2">Started</th>
                      <th className="px-3 py-2">Completed</th>
                      <th className="px-3 py-2">Error</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentJobs.map((job) => {
                      const retrying = retryBusy === job.id;
                      const retryResult = retryResults[job.id];
                      return (
                        <tr key={job.id} className="border-t border-ink-200 dark:border-ink-800">
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-600 dark:text-ink-400">
                            {shortId(job.id)}
                          </td>
                          <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                            {pretty(job.job_type)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-[11px] text-ink-700 dark:text-ink-300">
                                {job.inferred_webhook_key ?? "-"}
                              </span>
                              <StatusPill
                                status={job.webhook_configured ? "ok" : "off"}
                                label={job.webhook_configured ? "configured" : "unset"}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill status={jobTone(job.status)} label={job.status} />
                          </td>
                          <td className="px-3 py-2 text-[11px] tabular-nums text-ink-600 dark:text-ink-400">
                            {job.attempts}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                            {formatWhen(job.started_at)}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                            {formatWhen(job.completed_at)}
                          </td>
                          <td className="max-w-[180px] px-3 py-2 text-[11px] text-status-warn">
                            {job.last_error
                              ? job.last_error.slice(0, 100) +
                                (job.last_error.length > 100 ? "..." : "")
                              : "-"}
                          </td>
                          <td className="px-3 py-2">
                            {job.status === "failed" && (
                              <div className="flex flex-col items-start gap-1">
                                <button
                                  type="button"
                                  disabled={retrying}
                                  onClick={() => void retryJob(job.id)}
                                  className="flex h-6 items-center gap-1 rounded-md border border-ink-300 px-2 text-[10px] hover:border-accent-gold/50 disabled:opacity-40 dark:border-ink-700"
                                >
                                  {retrying ? (
                                    <Loader2 size={10} className="animate-spin" />
                                  ) : (
                                    <RotateCcw size={10} />
                                  )}
                                  Retry
                                </button>
                                {retryResult && (
                                  <span
                                    className={cn(
                                      "max-w-[220px] text-[10px]",
                                      retryResult.ok ? "text-status-ok" : "text-status-err"
                                    )}
                                  >
                                    {retryResult.message}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionBlock>

          <SectionBlock title="Dispatch Logs" icon={ShieldCheck}>
            {data.dispatchLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-300 p-3 text-sm text-ink-500 dark:border-ink-800 dark:text-ink-400">
                No matching dispatch audit rows found.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {data.dispatchLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-ink-200 bg-white/70 p-3 text-sm dark:border-ink-800 dark:bg-ink-900/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink-900 dark:text-ink-100">
                          {pretty(log.action)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
                          {log.target_type ?? "system"} · {formatWhen(log.created_at)}
                        </p>
                      </div>
                      <CheckCircle2 size={14} className="text-status-info" />
                    </div>
                    {Object.keys(log.metadata).length > 0 && (
                      <p className="mt-2 break-words font-mono text-[10px] text-ink-600 dark:text-ink-300">
                        {JSON.stringify(log.metadata)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionBlock>
        </>
      )}
    </div>
  );
}
