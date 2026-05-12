import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ChartLine,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type {
  AuditLog,
  AutomationJob,
  Profile,
  ProviderCredentialPublic,
  UsageEvent,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminCenterPage() {
  const profile = await getCurrentProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");
  const supabase = getSupabaseServerClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: members },
    { data: usage },
    { data: jobs },
    { data: audits },
    { data: providers },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("role", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("usage_events")
      .select("module,event_type,created_at,user_id")
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("automation_jobs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("provider_credentials_public").select("*"),
  ]);

  const membersList = (members ?? []) as Profile[];
  const usageList = (usage ?? []) as Pick<
    UsageEvent,
    "module" | "event_type" | "created_at" | "user_id"
  >[];
  const jobList = (jobs ?? []) as AutomationJob[];
  const auditList = (audits ?? []) as AuditLog[];
  const providerList = (providers ?? []) as ProviderCredentialPublic[];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin Center"
        title="Owner-only overview"
        description="Users, usage, automation jobs, audit trail, and provider status. Everything you can see here is gated by RLS."
        action={<StatusPill status="ok" label="owner" />}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Team members"
          value={membersList.length}
          hint="Active profiles in org"
          icon={Users}
        />
        <StatCard
          label="Events (24h)"
          value={usageList.length}
          hint="Across every module"
          icon={Activity}
        />
        <StatCard
          label="Jobs queued"
          value={jobList.filter((j) => j.status === "queued").length}
          hint="Waiting for dispatch"
          icon={Server}
        />
        <StatCard
          label="Audit entries"
          value={auditList.length}
          hint="Last 15 actions"
          icon={ShieldCheck}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Recent automation jobs</h2>
              <p>n8n queue status, last 10.</p>
            </div>
            <Link href="/admin/usage" className="btn-ghost text-xs">
              <ChartLine size={14} />
              All usage
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
                <tr>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Attempts</th>
                  <th className="px-3 py-2">Last update</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {jobList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-ink-300">
                      No jobs yet.
                    </td>
                  </tr>
                ) : (
                  jobList.map((j) => (
                    <tr key={j.id} className="border-t border-ink-800">
                      <td className="px-3 py-2 text-ink-100">{j.job_type}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={j.status as never} />
                      </td>
                      <td className="px-3 py-2 text-ink-300">{j.attempts}</td>
                      <td className="px-3 py-2 text-ink-300">
                        {formatRelative(j.updated_at)}
                      </td>
                      <td className="px-3 py-2 text-ink-300">
                        {j.last_error ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Providers</h2>
              <p>Credential status snapshot.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {providerList.length === 0 ? (
              <li className="text-xs text-ink-300">
                No provider rows yet — run bootstrap migration.
              </li>
            ) : (
              providerList.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="capitalize text-ink-100">{p.provider}</p>
                    <p className="text-[11px] text-ink-300">{p.env_var_name}</p>
                  </div>
                  <StatusPill status={p.status} />
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Audit log</h2>
            <p>Last 15 security-relevant actions.</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
              <tr>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {auditList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-ink-300">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                auditList.map((a) => (
                  <tr key={a.id} className="border-t border-ink-800">
                    <td className="px-3 py-2 text-ink-100">{a.action}</td>
                    <td className="px-3 py-2 text-ink-300">
                      {a.target_type ?? "—"} {a.target_id ? `· ${a.target_id.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {a.actor_user_id?.slice(0, 8) ?? "system"}
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {formatRelative(a.created_at)}
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
