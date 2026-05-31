import { redirect } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Database,
  Eye,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import {
  SECURITY_FINDINGS,
  SECURITY_RECOMMENDATIONS,
  getRoleAccessChecks,
  getSecurityStatusCards,
  getSecurityValidationChecks,
  securitySurfaceIcon,
  type SecuritySeverity,
  type ValidationStatus,
} from "@/lib/security/registry";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

interface TableHealth {
  table: string;
  label: string;
  status: "present" | "missing_or_blocked";
  detail: string;
}

const SECURITY_TABLES = [
  { table: "profiles", label: "Profiles / roles" },
  { table: "audit_logs", label: "Core audit logs" },
  { table: "loans", label: "Loan Brain loans" },
  { table: "borrowers", label: "Borrower records" },
  { table: "loan_memory", label: "Assistant memory" },
  { table: "loan_memory_events", label: "Memory events" },
  { table: "agent_memories", label: "Private agent memories" },
  { table: "agent_skills", label: "Assistant skills" },
  { table: "agent_tool_calls", label: "Agent tool calls" },
  { table: "browser_companion_captures", label: "Browser captures" },
  { table: "integration_audit_log", label: "Integration audit" },
  { table: "user_integration_connections", label: "OAuth statuses" },
  { table: "publish_attempts", label: "Publish attempts" },
] as const;

function toneForValidation(status: ValidationStatus): "ok" | "warn" | "err" {
  if (status === "pass") return "ok";
  if (status === "watch") return "warn";
  return "err";
}

function toneForSeverity(severity: SecuritySeverity): "ok" | "warn" | "err" | "info" {
  if (severity === "critical" || severity === "high") return "err";
  if (severity === "medium") return "warn";
  return "info";
}

async function safeTableHealth(): Promise<TableHealth[]> {
  try {
    const supabase = getSupabaseServerClient();
    const results = await Promise.all(
      SECURITY_TABLES.map(async (item) => {
        try {
          const { error } = await (supabase.from(item.table) as any)
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) {
            return {
              ...item,
              status: "missing_or_blocked" as const,
              detail: error.code ?? "query blocked",
            };
          }
          return {
            ...item,
            status: "present" as const,
            detail: "RLS-visible to owner or table exists",
          };
        } catch {
          return {
            ...item,
            status: "missing_or_blocked" as const,
            detail: "query unavailable",
          };
        }
      })
    );
    return results;
  } catch {
    return SECURITY_TABLES.map((item) => ({
      ...item,
      status: "missing_or_blocked",
      detail: "Supabase unavailable",
    }));
  }
}

async function safeProfiles(): Promise<Pick<Profile, "role">[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("profiles").select("role");
    if (error) return [];
    return (data ?? []) as Pick<Profile, "role">[];
  } catch {
    return [];
  }
}

export default async function SecurityDashboardPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const [tableHealth, profiles] = await Promise.all([
    safeTableHealth(),
    safeProfiles(),
  ]);

  const statusCards = getSecurityStatusCards();
  const validations = getSecurityValidationChecks();
  const roleChecks = getRoleAccessChecks(profiles);
  const presentTables = tableHealth.filter((row) => row.status === "present").length;
  const passingValidations = validations.filter((row) => row.status === "pass").length;
  const fixedFindings = SECURITY_FINDINGS.filter(
    (row) => row.status === "fixed" || row.status === "mitigated"
  ).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Security"
        title="Borrower data protection dashboard"
        description="Owner-only security registry for Browser Companion, Loan Brain, Assistant Memory, skills, Gmail, Drive, social publishing, webhooks, admin access, and impersonation."
        action={<StatusPill status="ok" label="owner gated" />}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="Security findings"
          value={`${fixedFindings}/${SECURITY_FINDINGS.length}`}
          hint="Fixed or mitigated findings in the registry"
          icon={ShieldCheck}
          tone={fixedFindings === SECURITY_FINDINGS.length ? "ok" : "warn"}
        />
        <StatCard
          label="Validation checks"
          value={`${passingValidations}/${validations.length}`}
          hint="Pass count; watch items remain visible"
          icon={CheckCircle2}
          tone={passingValidations === validations.length ? "ok" : "warn"}
        />
        <StatCard
          label="Security tables"
          value={`${presentTables}/${tableHealth.length}`}
          hint="Presence/RLS-visible checks, no borrower data selected"
          icon={Database}
          tone={presentTables === tableHealth.length ? "ok" : "warn"}
        />
      </div>

      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Live Security Status</h2>
            <p>
              Presence-only checks. This page never displays env values,
              OAuth tokens, webhook secrets, borrower names, or message bodies.
            </p>
          </div>
          <StatusPill status="info" label="no secrets shown" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {statusCards.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-ink-200 bg-white/60 p-4 dark:border-ink-800 dark:bg-ink-900/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                    <Icon size={17} />
                  </div>
                  <StatusPill status={item.tone} label={item.status} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Role Access Verification</h2>
            <p>Owner, LO, processor, and coordinator expectations.</p>
          </div>
          <StatusPill status="ok" label="RLS scoped" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {roleChecks.map((row) => (
            <div
              key={row.role}
              className="rounded-xl border border-ink-200 bg-white/60 p-4 dark:border-ink-800 dark:bg-ink-900/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck size={16} className="text-accent-gold" />
                  <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {row.label}
                  </h3>
                </div>
                <StatusPill
                  status={toneForValidation(row.status)}
                  label={`${row.status} · ${row.liveUsers} users`}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                <span className="font-semibold">Allowed:</span> {row.expectedAccess}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                <span className="font-semibold">Denied:</span> {row.deniedAccess}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Validation Checks</h2>
            <p>Concrete checks for memory, loans, Browser Companion, webhooks, and audit logs.</p>
          </div>
          <StatusPill status="info" label="registry backed" />
        </div>
        <div className="space-y-2">
          {validations.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-900/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                    {row.area} · {row.id}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {row.check}
                  </h3>
                </div>
                <StatusPill status={toneForValidation(row.status)} label={row.status} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                {row.evidence}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Security Findings Registry</h2>
            <p>Real risk items only. Theoretical enterprise controls are intentionally omitted.</p>
          </div>
          <StatusPill status="warn" label="watch open items" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {SECURITY_FINDINGS.map((row) => {
            const Icon = securitySurfaceIcon(row.surface);
            return (
              <div
                key={row.id}
                className="rounded-xl border border-ink-200 bg-white/60 p-4 dark:border-ink-800 dark:bg-ink-900/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-accent-gold" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                      {row.id} · {row.surface}
                    </p>
                  </div>
                  <StatusPill
                    status={row.status === "open" ? "err" : toneForSeverity(row.severity)}
                    label={`${row.severity} · ${row.status}`}
                  />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">
                  {row.finding}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                  <span className="font-semibold">Evidence:</span> {row.evidence}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                  <span className="font-semibold">Fix:</span> {row.fix}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <section className="card-padded space-y-4">
          <div className="section-title">
            <div>
              <h2>Security Recommendations Registry</h2>
              <p>Operational follow-ups before borrower data goes fully live.</p>
            </div>
            <ShieldAlert size={18} className="text-status-warn" />
          </div>
          <div className="space-y-2">
            {SECURITY_RECOMMENDATIONS.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-900/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {row.title}
                  </h3>
                  <StatusPill
                    status={row.priority === "now" ? "warn" : "info"}
                    label={`${row.priority} · ${row.owner}`}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                  {row.recommendation}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card-padded space-y-4">
          <div className="section-title">
            <div>
              <h2>Audit Coverage</h2>
              <p>Table presence checks select IDs/counts only.</p>
            </div>
            <Eye size={18} className="text-accent-gold" />
          </div>
          <div className="space-y-2">
            {tableHealth.map((row) => (
              <div
                key={row.table}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-900/40"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                    {row.label}
                  </p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400">
                    {row.table} · {row.detail}
                  </p>
                </div>
                <StatusPill
                  status={row.status === "present" ? "ok" : "warn"}
                  label={row.status === "present" ? "present" : "check setup"}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card-padded border-status-warn/30 bg-status-warn/10">
        <div className="flex items-start gap-3">
          <Activity size={18} className="mt-0.5 text-status-warn" />
          <div>
            <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              Remaining readiness gate
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
              Before live borrower data, run role-based integration tests
              against a seeded Supabase project. This dashboard verifies code
              coverage and table reachability, but it does not impersonate real
              Supabase users or prove deployed policy state across every role.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
