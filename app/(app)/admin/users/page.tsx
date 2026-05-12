import { redirect } from "next/navigation";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("role")
    .order("created_at");
  const users = (data ?? []) as Profile[];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin · Users"
        title="Team and roles"
        description="RLS-enforced. Role updates flow through the database, never the UI alone."
      />
      <section className="card-padded">
        <div className="overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
              <tr>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Last seen</th>
                <th className="px-3 py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-300">
                    No profiles yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t border-ink-800">
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink-100">
                        {u.full_name ?? u.email}
                      </p>
                      <p className="text-xs text-ink-300">{u.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="chip-info">{u.role}</span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        status={u.is_active ? "ok" : "off"}
                        label={u.is_active ? "active" : "inactive"}
                      />
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {formatRelative(u.last_seen_at)}
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {formatRelative(u.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-ink-300">
          To promote a user, run{" "}
          <code>select public.promote_owner('email@example.com')</code> from
          the Supabase SQL editor. Self-promotion is blocked by RLS.
        </p>
      </section>
    </div>
  );
}
