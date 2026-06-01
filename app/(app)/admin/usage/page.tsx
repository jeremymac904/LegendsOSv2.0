import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { Profile, UsageEvent } from "@/types/database";

export const dynamic = "force-dynamic";

// Mirrors the safeArrayQuery pattern in app/(app)/admin/page.tsx: degrade a
// failed/missing-table query to an empty array + a "setup needed" flag instead
// of throwing a 500 that would drop the authed shell.
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

export default async function AdminUsagePage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");
  const supabase = getSupabaseServerClient();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let usageDataUnavailable = false;
  let usage: UsageEvent[] = [];
  let members: Pick<Profile, "id" | "full_name" | "email" | "role">[] = [];

  try {
    const [eventsResult, profilesResult] = await Promise.all([
      safeArrayQuery<UsageEvent>(
        supabase
          .from("usage_events")
          .select("*")
          .gte("created_at", since7d)
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeArrayQuery<Pick<Profile, "id" | "full_name" | "email" | "role">>(
        supabase.from("profiles").select("id,full_name,email,role")
      ),
    ]);
    usage = eventsResult.data;
    members = profilesResult.data;
    usageDataUnavailable = eventsResult.setupNeeded || profilesResult.setupNeeded;
  } catch {
    usage = [];
    members = [];
    usageDataUnavailable = true;
  }

  const byUser = new Map<string, number>();
  for (const e of usage) {
    if (e.user_id) byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + 1);
  }

  const byModule: Record<string, number> = {};
  for (const e of usage) {
    byModule[e.module] = (byModule[e.module] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin · Usage"
        title="Team activity (7 days)"
        description="Counts pulled live from usage_events. Drill into any module to see per-user breakdowns."
        action={
          usageDataUnavailable ? (
            <StatusPill status="warn" label="usage data unavailable" />
          ) : undefined
        }
      />

      {usageDataUnavailable && (
        <section className="card-padded border-status-warn/30 bg-status-warn/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                Usage data unavailable
              </h2>
              <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
                The usage_events or profiles tables could not be read, so this
                page is rendering with safe empty data instead of crashing.
              </p>
            </div>
            <StatusPill status="warn" label="setup needed" />
          </div>
        </section>
      )}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(["atlas", "images", "social", "email", "knowledge"] as const).map(
          (m) => (
            <StatCard
              key={m}
              label={m}
              value={byModule[m] ?? 0}
              hint="last 7d events"
            />
          )
        )}
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Per-user activity</h2>
            <p>Counts events from all modules in the last 7 days.</p>
          </div>
        </div>
        {members.length === 0 ? (
          <EmptyState
            title="No team members yet"
            description="Invite users via Supabase Auth — profiles auto-populate on sign-up."
          />
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Events (7d)</th>
                </tr>
              </thead>
              <tbody>
                {members
                  .sort(
                    (a, b) => (byUser.get(b.id) ?? 0) - (byUser.get(a.id) ?? 0)
                  )
                  .map((m) => (
                    <tr key={m.id} className="border-t border-ink-800">
                      <td className="px-3 py-2 text-ink-100">
                        {m.full_name ?? m.email}
                      </td>
                      <td className="px-3 py-2 text-ink-300">{m.role}</td>
                      <td className="px-3 py-2 text-ink-100">
                        {byUser.get(m.id) ?? 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Recent events</h2>
            <p>Last 25 usage records.</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
              <tr>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {usage.slice(0, 25).map((e) => (
                <tr key={e.id} className="border-t border-ink-800">
                  <td className="px-3 py-2 text-ink-100">{e.module}</td>
                  <td className="px-3 py-2 text-ink-300">{e.event_type}</td>
                  <td className="px-3 py-2 text-ink-300">{e.provider ?? "—"}</td>
                  <td className="px-3 py-2 text-ink-300">
                    {formatRelative(e.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
