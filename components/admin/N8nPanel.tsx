"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";

// Mirror of the server-side N8nWebhookKey union. Kept here so the client
// component does not import the server-only lib/automation/n8n module.
type N8nWebhookKey =
  | "social_publish"
  | "gbp_post"
  | "facebook_post"
  | "instagram_post"
  | "youtube_post"
  | "email_send"
  | "daily_usage"
  | "provider_health"
  | "content_reminder"
  | "failed_publish_recovery";

// ---------------------------------------------------------------------------
// Types (mirrors the route contract)
// ---------------------------------------------------------------------------

interface N8nConfigState {
  configured: boolean;
  base_url_present: boolean;
  webhooks: Record<string, boolean>;
  api_key_present: boolean;
  hmac_secret_present: boolean;
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  tags?: string[];
}

interface AutomationJobRow {
  id: string;
  job_type: string | null;
  webhook_key: string | null;
  status: string | null;
  created_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  last_error: string | null;
}

interface N8nStatusResponse {
  ok: boolean;
  configured: boolean;
  config: N8nConfigState;
  workflows: N8nWorkflow[];
  recentJobs: AutomationJobRow[];
}

// The known webhook keys shown as testable buttons. Source of truth is the
// N8nWebhookKey union in lib/automation/n8n.ts — replicate here so the client
// panel doesn't import a server-only module.
const WEBHOOK_KEYS: N8nWebhookKey[] = [
  "social_publish",
  "email_send",
  "content_reminder",
  "daily_usage",
  "provider_health",
  "failed_publish_recovery",
  "gbp_post",
  "facebook_post",
  "instagram_post",
  "youtube_post",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function shortId(id: string): string {
  return id.slice(0, 8);
}

function jobStatusPill(status: string | null): { tone: "ok" | "warn" | "err" | "info" | "off"; label: string } {
  switch (status) {
    case "sent":
      return { tone: "ok", label: "sent" };
    case "queued":
      return { tone: "info", label: "queued" };
    case "failed":
      return { tone: "err", label: "failed" };
    case "blocked":
      return { tone: "warn", label: "blocked" };
    default:
      return { tone: "off", label: status ?? "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PresenceDot({ present, label }: { present: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 font-mono text-[10px] text-ink-700 dark:text-ink-300">
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          present ? "bg-status-ok" : "bg-status-warn"
        )}
      />
      {label}
      <span
        className={cn(
          "font-sans text-[9px]",
          present ? "text-status-ok" : "text-status-warn"
        )}
      >
        {present ? "present" : "missing"}
      </span>
    </li>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white/60 p-4 dark:border-ink-800 dark:bg-ink-900/40">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
        {title}
      </p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function N8nPanel() {
  const [data, setData] = useState<N8nStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Webhook test state: key → result
  const [webhookResults, setWebhookResults] = useState<
    Record<string, { ok: boolean; status_code?: number; message?: string } | null>
  >({});
  const [webhookBusy, setWebhookBusy] = useState<string | null>(null);

  // Retry job state
  const [retryResults, setRetryResults] = useState<
    Record<string, { ok: boolean; message: string } | null>
  >({});
  const [retryBusy, setRetryBusy] = useState<string | null>(null);

  // Trigger workflow form
  const [triggerName, setTriggerName] = useState("");
  const [triggerPayload, setTriggerPayload] = useState("");
  const [triggerResult, setTriggerResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [triggerBusy, setTriggerBusy] = useState(false);

  // Workflow table expand
  const [workflowsExpanded, setWorkflowsExpanded] = useState(false);

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
      const json = (await res.json()) as N8nStatusResponse;
      setData(json);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Test webhook -------------------------------------------------------
  async function testWebhook(key: string) {
    setWebhookBusy(key);
    setWebhookResults((r) => ({ ...r, [key]: null }));
    try {
      const res = await fetch("/api/admin/n8n", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "test_webhook", webhook_key: key }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        status_code?: number;
        message?: string;
        status?: string;
      };
      setWebhookResults((r) => ({
        ...r,
        [key]: {
          ok: json.ok,
          status_code: json.status_code,
          message:
            json.message ??
            (json.status === "not_configured"
              ? "Not configured"
              : json.ok
              ? `HTTP ${json.status_code}`
              : `HTTP ${json.status_code ?? "error"}`),
        },
      }));
    } catch {
      setWebhookResults((r) => ({
        ...r,
        [key]: { ok: false, message: "Network error" },
      }));
    } finally {
      setWebhookBusy(null);
    }
  }

  // ---- Retry job ----------------------------------------------------------
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
      };
      setRetryResults((r) => ({
        ...r,
        [jobId]: {
          ok: json.ok,
          message: json.ok
            ? `Retried → new job ${json.new_job_id ? shortId(json.new_job_id) : ""}  (${json.status})`
            : json.reason ?? "Retry failed",
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

  // ---- Trigger workflow ---------------------------------------------------
  async function triggerWorkflow(e: React.FormEvent) {
    e.preventDefault();
    if (!triggerName.trim()) return;
    setTriggerBusy(true);
    setTriggerResult(null);
    let payload: Record<string, unknown> = {};
    if (triggerPayload.trim()) {
      try {
        payload = JSON.parse(triggerPayload) as Record<string, unknown>;
      } catch {
        setTriggerResult({ ok: false, message: "Payload must be valid JSON." });
        setTriggerBusy(false);
        return;
      }
    }
    try {
      const res = await fetch("/api/admin/n8n", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "trigger_workflow",
          workflow_name: triggerName.trim(),
          payload,
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string; status?: string };
      setTriggerResult({
        ok: json.ok,
        message: json.message ?? (json.ok ? "Triggered." : "Failed."),
      });
    } catch {
      setTriggerResult({ ok: false, message: "Network error." });
    } finally {
      setTriggerBusy(false);
    }
  }

  // ---- Derived display state ----------------------------------------------
  const configured = data?.configured ?? false;
  const config = data?.config;
  const workflows = data?.workflows ?? [];
  const recentJobs = data?.recentJobs ?? [];
  const configuredWebhookKeys = WEBHOOK_KEYS.filter(
    (k) => config?.webhooks?.[k] === true
  );
  const displayedWorkflows = workflowsExpanded
    ? workflows
    : workflows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Loading / error */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading n8n status…
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

      {!loading && !fetchError && (
        <>
          {/* 1) Connection status header */}
          <section className="card-padded space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                  <Zap size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                    n8n connection
                  </p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    API key + base URL determines overall status
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill
                  status={configured ? "ok" : "warn"}
                  label={configured ? "configured" : "not configured"}
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

            {/* Config block */}
            {config && (
              <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3 dark:border-ink-800 dark:bg-ink-950/30">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                  Environment variables (presence only — values never shown)
                </p>
                <ul className="space-y-1">
                  <PresenceDot
                    present={config.base_url_present}
                    label="N8N_BASE_URL / N8N_WEBHOOK_BASE_URL"
                  />
                  <PresenceDot
                    present={config.api_key_present}
                    label="N8N_API_KEY"
                  />
                  <PresenceDot
                    present={config.hmac_secret_present}
                    label="N8N_WEBHOOK_SECRET (HMAC callback)"
                  />
                </ul>

                <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                  Webhook keys
                </p>
                <ul className="space-y-1">
                  {Object.entries(config.webhooks).map(([key, present]) => (
                    <li
                      key={key}
                      className="flex items-center gap-2 font-mono text-[10px] text-ink-700 dark:text-ink-300"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          present ? "bg-status-ok" : "bg-ink-400"
                        )}
                      />
                      {key}
                      <span
                        className={cn(
                          "font-sans text-[9px]",
                          present
                            ? "text-status-ok"
                            : "text-ink-500 dark:text-ink-400"
                        )}
                      >
                        {present ? "set" : "unset"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 2) Workflow registry */}
          <section className="card-padded space-y-4">
            <div className="section-title">
              <div>
                <h2 className="flex items-center gap-2">
                  <Workflow size={15} className="text-accent-gold" />
                  Workflow registry
                </h2>
                <p>
                  Active workflows fetched from n8n via API key.{" "}
                  {workflows.length === 0 && !configured
                    ? "n8n is not configured — no workflows available."
                    : `${workflows.length} workflow${workflows.length === 1 ? "" : "s"} found.`}
                </p>
              </div>
            </div>

            {workflows.length === 0 ? (
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                {configured
                  ? "No active workflows returned. Workflows marked inactive in n8n are excluded."
                  : "Configure N8N_BASE_URL and N8N_API_KEY to list workflows."}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-ink-100/70 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
                      <tr>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedWorkflows.map((wf) => (
                        <tr
                          key={wf.id}
                          className="border-t border-ink-200 dark:border-ink-800"
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-600 dark:text-ink-400">
                            {wf.id}
                          </td>
                          <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                            {wf.name}
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill
                              status={wf.active ? "ok" : "off"}
                              label={wf.active ? "active" : "inactive"}
                            />
                          </td>
                          <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                            {(wf.tags ?? []).join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {workflows.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setWorkflowsExpanded((v) => !v)}
                    className="btn-ghost h-7 px-3 text-xs"
                  >
                    {workflowsExpanded ? (
                      <>
                        <ChevronUp size={12} className="mr-1" /> Show fewer
                      </>
                    ) : (
                      <>
                        <ChevronDown size={12} className="mr-1" /> Show all{" "}
                        {workflows.length}
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </section>

          {/* 3) Test webhooks */}
          <section className="card-padded space-y-4">
            <div className="section-title">
              <div>
                <h2 className="flex items-center gap-2">
                  <Webhook size={15} className="text-accent-gold" />
                  Test webhooks
                </h2>
                <p>
                  Send a safe test payload to each configured webhook URL. Only
                  configured webhooks are shown.
                </p>
              </div>
            </div>

            {configuredWebhookKeys.length === 0 ? (
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                No webhook URLs are configured. Set N8N_WEBHOOK_* environment
                variables to enable testing.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {configuredWebhookKeys.map((key) => {
                  const result = webhookResults[key];
                  const busy = webhookBusy === key;
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-1 rounded-lg border border-ink-200 bg-ink-50/60 p-2.5 dark:border-ink-800 dark:bg-ink-950/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-ink-900 dark:text-ink-100">
                          {key}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void testWebhook(key)}
                          className="btn-secondary h-6 px-2 text-[10px] disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            "Test"
                          )}
                        </button>
                      </div>
                      {result !== null && result !== undefined && (
                        <div className="flex items-center gap-1.5">
                          {result.ok ? (
                            <CheckCircle2
                              size={11}
                              className="text-status-ok"
                            />
                          ) : (
                            <AlertTriangle
                              size={11}
                              className="text-status-warn"
                            />
                          )}
                          <span
                            className={cn(
                              "text-[10px]",
                              result.ok
                                ? "text-status-ok"
                                : "text-status-warn"
                            )}
                          >
                            {result.message ??
                              (result.status_code
                                ? `HTTP ${result.status_code}`
                                : result.ok
                                ? "ok"
                                : "failed")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4) Trigger workflow by name */}
          <section className="card-padded space-y-4">
            <div className="section-title">
              <div>
                <h2 className="flex items-center gap-2">
                  <Send size={15} className="text-accent-gold" />
                  Trigger workflow by ID
                </h2>
                <p>
                  Manually trigger an n8n workflow by its numeric or string ID.
                  Optionally pass a JSON payload.
                </p>
              </div>
            </div>

            <form onSubmit={(e) => void triggerWorkflow(e)} className="space-y-3">
              <div>
                <label
                  htmlFor="n8n-workflow-name"
                  className="block text-[11px] font-medium text-ink-700 dark:text-ink-300"
                >
                  Workflow ID
                </label>
                <input
                  id="n8n-workflow-name"
                  type="text"
                  value={triggerName}
                  onChange={(e) => setTriggerName(e.target.value)}
                  placeholder="e.g. 42 or workflow-uuid"
                  className="mt-1 w-full rounded-lg border border-ink-300 bg-white/80 px-3 py-1.5 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-gold/50 dark:border-ink-700 dark:bg-ink-900/60 dark:text-ink-100"
                />
              </div>
              <div>
                <label
                  htmlFor="n8n-workflow-payload"
                  className="block text-[11px] font-medium text-ink-700 dark:text-ink-300"
                >
                  Payload (optional JSON)
                </label>
                <textarea
                  id="n8n-workflow-payload"
                  rows={3}
                  value={triggerPayload}
                  onChange={(e) => setTriggerPayload(e.target.value)}
                  placeholder={'{"key": "value"}'}
                  className="mt-1 w-full rounded-lg border border-ink-300 bg-white/80 px-3 py-1.5 font-mono text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-gold/50 dark:border-ink-700 dark:bg-ink-900/60 dark:text-ink-100"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={triggerBusy || !triggerName.trim() || !configured}
                  className="btn-primary h-8 px-4 text-xs disabled:opacity-40"
                  title={
                    !configured
                      ? "n8n is not configured"
                      : !triggerName.trim()
                      ? "Enter a workflow ID"
                      : undefined
                  }
                >
                  {triggerBusy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    "Trigger"
                  )}
                </button>
                {triggerResult && (
                  <span
                    className={cn(
                      "text-[11px]",
                      triggerResult.ok
                        ? "text-status-ok"
                        : "text-status-err"
                    )}
                  >
                    {triggerResult.message}
                  </span>
                )}
              </div>
            </form>
          </section>

          {/* 5) Recent automation jobs */}
          <section className="card-padded space-y-4">
            <div className="section-title">
              <div>
                <h2>Recent automation jobs</h2>
                <p>
                  Last 20 automation_jobs rows. Payload bodies are excluded
                  (may contain PII). Failed jobs can be retried.
                </p>
              </div>
            </div>

            {recentJobs.length === 0 ? (
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                No automation jobs recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-ink-100/70 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Webhook key</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Dispatched</th>
                      <th className="px-3 py-2">Completed</th>
                      <th className="px-3 py-2">Error</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job) => {
                      const pill = jobStatusPill(job.status);
                      const isFailed = job.status === "failed";
                      const retrying = retryBusy === job.id;
                      const retryResult = retryResults[job.id];
                      return (
                        <tr
                          key={job.id}
                          className="border-t border-ink-200 dark:border-ink-800"
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-600 dark:text-ink-400">
                            {shortId(job.id)}
                          </td>
                          <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                            {job.job_type ?? "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-ink-700 dark:text-ink-300">
                            {job.webhook_key ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <StatusPill
                              status={pill.tone}
                              label={pill.label}
                            />
                          </td>
                          <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                            {formatWhen(job.created_at)}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                            {formatWhen(job.dispatched_at)}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-ink-600 dark:text-ink-400">
                            {formatWhen(job.completed_at)}
                          </td>
                          <td className="max-w-[160px] px-3 py-2 text-[11px] text-status-warn">
                            {job.last_error
                              ? job.last_error.slice(0, 80) +
                                (job.last_error.length > 80 ? "…" : "")
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {isFailed && (
                              <div className="flex flex-col items-start gap-1">
                                <button
                                  type="button"
                                  disabled={retrying}
                                  onClick={() => void retryJob(job.id)}
                                  className="flex items-center gap-1 btn-ghost h-6 px-2 text-[10px] disabled:opacity-40"
                                >
                                  {retrying ? (
                                    <Loader2
                                      size={10}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <RotateCcw size={10} />
                                  )}
                                  Retry
                                </button>
                                {retryResult && (
                                  <span
                                    className={cn(
                                      "text-[10px]",
                                      retryResult.ok
                                        ? "text-status-ok"
                                        : "text-status-err"
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
          </section>
        </>
      )}
    </div>
  );
}
