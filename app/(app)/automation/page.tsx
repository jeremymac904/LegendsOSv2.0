import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { buildAutomationRegistry, type AutomationReadiness } from "@/lib/automation/registry";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative, truncate } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import type { AuditLog, AutomationJob } from "@/types/database";

export const dynamic = "force-dynamic";

interface LoanApprovalRow {
  id: string;
  loan_id: string;
  action_type: string;
  status: string;
  created_at: string;
}

interface EmailIntakeAlertRow {
  id: string;
  alert_type: string;
  severity: string;
  decision: string;
  created_at: string;
}

interface BrowserCaptureRow {
  id: string;
  routed_assistant: string | null;
  status: string;
  captured_at: string;
}

interface BrowserAuditRow {
  id: string;
  action: string;
  provider: string | null;
  created_at: string;
}

export default async function AutomationControlCenterPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const registry = buildAutomationRegistry();
  let setupNeeded = false;
  let jobs: AutomationJob[] = [];
  let auditLogs: AuditLog[] = [];
  let loanApprovals: LoanApprovalRow[] = [];
  let intakeAlerts: EmailIntakeAlertRow[] = [];
  let browserCaptures: BrowserCaptureRow[] = [];
  let browserAudit: BrowserAuditRow[] = [];

  try {
    const supabase = getSupabaseServerClient();
    const results = await Promise.all([
      safeArrayQuery<AutomationJob>(
        supabase
          .from("automation_jobs")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(25)
      ),
      safeArrayQuery<AuditLog>(
        supabase
          .from("audit_logs")
          .select("*")
          .in("action", [
            "social_publish_requested",
            "email_send_requested",
            "email_test_requested",
            "provider_enabled",
            "provider_disabled",
            "browser_companion_capture",
          ])
          .order("created_at", { ascending: false })
          .limit(25)
      ),
      safeArrayQuery<LoanApprovalRow>(
        supabase
          .from("loan_approvals")
          .select("id,loan_id,action_type,status,created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeArrayQuery<EmailIntakeAlertRow>(
        supabase
          .from("email_intake_alerts")
          .select("id,alert_type,severity,decision,created_at")
          .eq("decision", "pending")
          .order("created_at", { ascending: false })
          .limit(10)
      ),
      safeArrayQuery<BrowserCaptureRow>(
        supabase
          .from("browser_companion_captures")
          .select("id,routed_assistant,status,captured_at")
          .order("captured_at", { ascending: false })
          .limit(10)
      ),
      safeArrayQuery<BrowserAuditRow>(
        supabase
          .from("integration_audit_log")
          .select("id,action,provider,created_at")
          .eq("provider", "browser_companion")
          .order("created_at", { ascending: false })
          .limit(10)
      ),
    ]);

    setupNeeded = results.some((result) => result.setupNeeded);
    [jobs, auditLogs, loanApprovals, intakeAlerts, browserCaptures, browserAudit] =
      results.map((result) => result.data) as [
        AutomationJob[],
        AuditLog[],
        LoanApprovalRow[],
        EmailIntakeAlertRow[],
        BrowserCaptureRow[],
        BrowserAuditRow[],
      ];
  } catch {
    setupNeeded = true;
  }

  const failedJobs = jobs.filter((job) => job.status === "failed");
  const queuedJobs = jobs.filter((job) => job.status === "queued" || job.status === "sent");
  const approvalCount = loanApprovals.length + intakeAlerts.length + queuedJobs.length;
  const liveWriteCount = registry.summary.live_writes_enabled;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Owner automation"
        title="Automation Control Center"
        description="Production readiness view for webhooks, integrations, n8n contracts, scheduled jobs, Browser Companion paths, execution history, failures, approvals, and audit coverage. This page is read-only and does not activate external workflows."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="btn-ghost text-xs">
              Admin Center
            </Link>
            <Link href="/settings" className="btn-ghost text-xs">
              Settings
            </Link>
          </div>
        }
      />

      {setupNeeded && (
        <div className="rounded-2xl border border-status-warn/30 bg-status-warn/10 p-4 text-sm text-ink-200">
          Some automation tables are not provisioned or are hidden by RLS. The
          registry still renders from code/env inspection; history counts may be
          partial until migrations are applied.
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Registry paths"
          value={registry.summary.total}
          hint={`${registry.summary.ready} ready/configured, ${registry.summary.partial} partial`}
          icon={Workflow}
        />
        <StatCard
          label="Queued/in-flight"
          value={queuedJobs.length}
          hint="automation_jobs queued + sent"
          icon={Clock3}
        />
        <StatCard
          label="Failures"
          value={failedJobs.length}
          hint="Recent jobs needing retry/review"
          icon={AlertTriangle}
        />
        <StatCard
          label="Approval items"
          value={approvalCount}
          hint="Pending approvals + queued actions"
          icon={ShieldCheck}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="Webhook status" status={registry.status.webhook} detail="Inbound shared-secret routes" />
        <StatusCard label="n8n status" status={registry.status.n8n} detail={`${registry.readiness.n8n_webhook_count} webhook envs, ${registry.readiness.n8n_workflow_files} workflow files`} />
        <StatusCard label="Zapier status" status={registry.status.zapier} detail="MCP stub until configured" />
        <StatusCard label="Google status" status={registry.status.google} detail="OAuth start only; writes disabled" />
        <StatusCard label="Meta status" status={registry.status.meta} detail="Stubbed; no direct Meta calls" />
        <StatusCard label="Email status" status={registry.status.email} detail={registry.readiness.live_email_send_enabled ? "Live send flag enabled" : "Queued by default"} />
        <StatusCard label="Drive status" status={registry.status.drive} detail="Needs Review only; borrower-folder writes blocked" />
        <StatusCard label="Browser Companion" status={registry.status.browser_companion} detail={`${browserCaptures.length} recent captures, ${browserAudit.length} audit rows`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="card-padded">
          <div className="section-title">
            <div>
              <h2>Automation registry</h2>
              <p>Every live or planned automation path, its current behavior, and its activation gate.</p>
            </div>
            <StatusPill
              status={liveWriteCount === 0 ? "ok" : "warn"}
              label={liveWriteCount === 0 ? "live writes off" : `${liveWriteCount} live writes on`}
            />
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-ink-200/70 dark:border-ink-800">
            <div className="grid grid-cols-[1.1fr_0.7fr_1.4fr_1.2fr] gap-3 bg-ink-100/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:bg-ink-900/70 dark:text-ink-400">
              <span>Path</span>
              <span>Status</span>
              <span>Current behavior</span>
              <span>Gate</span>
            </div>
            <div className="divide-y divide-ink-200/70 dark:divide-ink-800">
              {registry.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm md:grid-cols-[1.1fr_0.7fr_1.4fr_1.2fr]"
                >
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-ink-100">{entry.label}</p>
                    <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                      {entry.category.replace("_", " ")} · {entry.owner}
                    </p>
                    {(entry.route || entry.contract) && (
                      <p className="mt-1 font-mono text-[11px] text-ink-500 dark:text-ink-400">
                        {entry.route ?? entry.contract}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <StatusPill status={pillStatus(entry.status)} label={entry.status} />
                    <StatusPill
                      status={entry.liveWritesEnabled ? "warn" : "off"}
                      label={entry.liveWritesEnabled ? "live" : "safe"}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                    {entry.currentBehavior}
                  </p>
                  <div>
                    <p className="text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                      {entry.activationGate}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
                      Prepared: {entry.preparedFor.slice(0, 3).join(", ")}
                      {entry.preparedFor.length > 3 ? "..." : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ReadinessPanel registry={registry} />
          <ApprovalPanel loanApprovals={loanApprovals} intakeAlerts={intakeAlerts} queuedJobs={queuedJobs} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <HistoryPanel jobs={jobs} />
        <FailurePanel failedJobs={failedJobs} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AuditPanel logs={auditLogs} />
        <BrowserPanel captures={browserCaptures} audit={browserAudit} />
      </section>
    </div>
  );
}

function StatusCard({
  label,
  status,
  detail,
}: {
  label: string;
  status: AutomationReadiness;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white/80 p-4 dark:border-ink-800 dark:bg-ink-950/70">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">{label}</p>
        <StatusPill status={pillStatus(status)} label={status} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-600 dark:text-ink-300">{detail}</p>
    </div>
  );
}

function ReadinessPanel({ registry }: { registry: ReturnType<typeof buildAutomationRegistry> }) {
  const checks = [
    ["n8n API configured", registry.readiness.n8n_api_configured],
    ["n8n callback HMAC configured", registry.readiness.n8n_callback_signature_configured],
    ["Zapier MCP configured", registry.readiness.zapier_mcp_configured],
    ["Google OAuth configured", registry.readiness.google_oauth_configured],
    ["Google writes disabled", !registry.readiness.google_writes_enabled],
    ["Meta configured", registry.readiness.meta_configured],
    ["Meta writes disabled unless flag on", !registry.readiness.meta_writes_enabled],
    ["Scheduled jobs inactive", !registry.readiness.scheduled_jobs_activated],
    ["n8n workflow files inactive", registry.readiness.n8n_workflow_files_active === 0],
  ];
  return (
    <div className="card-padded">
      <div className="section-title">
        <div>
          <h2>Production readiness</h2>
          <p>Readiness checks are presence-only and never expose secrets.</p>
        </div>
        <PlugZap size={16} className="text-accent-gold" />
      </div>
      <div className="mt-4 space-y-2">
        {checks.map(([label, passed]) => (
          <div key={String(label)} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-700 dark:text-ink-300">{label}</span>
            {passed ? (
              <CheckCircle2 size={15} className="text-status-ok" />
            ) : (
              <AlertTriangle size={15} className="text-status-warn" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalPanel({
  loanApprovals,
  intakeAlerts,
  queuedJobs,
}: {
  loanApprovals: LoanApprovalRow[];
  intakeAlerts: EmailIntakeAlertRow[];
  queuedJobs: AutomationJob[];
}) {
  return (
    <div className="card-padded">
      <div className="section-title">
        <div>
          <h2>Approvals</h2>
          <p>Human gates before consequential automation.</p>
        </div>
        <ShieldCheck size={16} className="text-accent-gold" />
      </div>
      <div className="mt-4 space-y-3">
        <QueueLine label="Queued automation jobs" value={queuedJobs.length} href="/admin" />
        <QueueLine label="Loan approval rows" value={loanApprovals.length} href="/loan-brain" />
        <QueueLine label="Email intake alerts" value={intakeAlerts.length} href="/email-intake/review" />
      </div>
    </div>
  );
}

function QueueLine({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-sm hover:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/40">
      <span className="text-ink-700 dark:text-ink-300">{label}</span>
      <span className="font-semibold tabular-nums text-ink-900 dark:text-ink-100">{value}</span>
    </Link>
  );
}

function HistoryPanel({ jobs }: { jobs: AutomationJob[] }) {
  return (
    <div className="card-padded">
      <div className="section-title">
        <div>
          <h2>Execution history</h2>
          <p>Recent automation_jobs rows across social, email, and n8n dispatch.</p>
        </div>
        <History size={16} className="text-accent-gold" />
      </div>
      <div className="mt-4 space-y-2">
        {jobs.length === 0 ? (
          <EmptyLine>No automation jobs recorded yet.</EmptyLine>
        ) : (
          jobs.slice(0, 10).map((job) => (
            <div key={job.id} className="rounded-xl border border-ink-200 bg-white/70 p-3 text-sm dark:border-ink-800 dark:bg-ink-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink-900 dark:text-ink-100">{job.job_type}</p>
                <StatusPill status={job.status === "failed" ? "err" : job.status === "succeeded" ? "ok" : "info"} label={job.status} />
              </div>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                {job.module ?? "automation"} · attempts {job.attempts} · {formatRelative(job.updated_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FailurePanel({ failedJobs }: { failedJobs: AutomationJob[] }) {
  return (
    <div className="card-padded">
      <div className="section-title">
        <div>
          <h2>Failure handling</h2>
          <p>Failed jobs stay visible for manual review and future retry handling.</p>
        </div>
        <RotateCcw size={16} className="text-accent-gold" />
      </div>
      <div className="mt-4 space-y-2">
        {failedJobs.length === 0 ? (
          <EmptyLine>No recent failed automation jobs.</EmptyLine>
        ) : (
          failedJobs.slice(0, 8).map((job) => (
            <div key={job.id} className="rounded-xl border border-status-err/20 bg-status-err/10 p-3 text-sm">
              <p className="font-semibold text-ink-900 dark:text-ink-100">{job.job_type}</p>
              <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
                {truncate(job.last_error ?? "No error detail recorded.", 160)}
              </p>
              <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
                attempts {job.attempts} · {formatRelative(job.updated_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="card-padded">
      <div className="section-title">
        <div>
          <h2>Audit logs</h2>
          <p>Recent audit coverage for automation-triggering actions.</p>
        </div>
        <ShieldCheck size={16} className="text-accent-gold" />
      </div>
      <div className="mt-4 space-y-2">
        {logs.length === 0 ? (
          <EmptyLine>No matching automation audit rows found.</EmptyLine>
        ) : (
          logs.slice(0, 10).map((log) => (
            <div key={log.id} className="rounded-xl border border-ink-200 bg-white/70 p-3 text-sm dark:border-ink-800 dark:bg-ink-900/40">
              <p className="font-semibold text-ink-900 dark:text-ink-100">{log.action}</p>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                {log.target_type ?? "system"} · {formatRelative(log.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BrowserPanel({
  captures,
  audit,
}: {
  captures: BrowserCaptureRow[];
  audit: BrowserAuditRow[];
}) {
  return (
    <div className="card-padded">
      <div className="section-title">
        <div>
          <h2>Browser Companion paths</h2>
          <p>Capture/context/session/audit endpoints remain token-free and read-only.</p>
        </div>
        <Workflow size={16} className="text-accent-gold" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-900/40">
          <p className="text-xs text-ink-500 dark:text-ink-400">Recent captures</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{captures.length}</p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-900/40">
          <p className="text-xs text-ink-500 dark:text-ink-400">Integration audit</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{audit.length}</p>
        </div>
      </div>
      <Link href="/browser-companion" className="btn-ghost mt-4 text-xs">
        Open Browser Companion
      </Link>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-ink-300 p-3 text-sm text-ink-500 dark:border-ink-800 dark:text-ink-400">
      {children}
    </p>
  );
}

function pillStatus(status: AutomationReadiness): "ok" | "warn" | "err" | "off" | "info" {
  if (status === "ready" || status === "configured") return "ok";
  if (status === "partial") return "warn";
  if (status === "blocked") return "err";
  if (status === "off") return "off";
  return "info";
}

async function safeArrayQuery<T>(
  query: PromiseLike<{ data: unknown; error: unknown }>
): Promise<{ data: T[]; setupNeeded: boolean }> {
  try {
    const { data, error } = await query;
    return {
      data: Array.isArray(data) ? (data as T[]) : [],
      setupNeeded: Boolean(error),
    };
  } catch {
    return { data: [], setupNeeded: true };
  }
}
