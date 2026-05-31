import { redirect } from "next/navigation";

import { RolePreviewPanel } from "@/components/admin/RolePreviewPanel";
import { UserManager } from "@/components/admin/UserManager";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");
  let usersSetupNeeded = false;
  let users: Profile[] = [];
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("role")
      .order("created_at");
    usersSetupNeeded = Boolean(error);
    users = (data ?? []) as Profile[];
  } catch {
    usersSetupNeeded = true;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin · Users"
        title="Team and roles"
        description="Add users via Supabase Auth Admin API, change roles, send password resets, and preview the app as any user. All writes are server-side; the service role key stays out of the browser."
      />
      {usersSetupNeeded && (
        <section className="card-padded border-status-warn/30 bg-status-warn/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                User table setup needed
              </h2>
              <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
                Profiles are unavailable, so the user console is rendering with
                safe empty data instead of crashing.
              </p>
            </div>
            <StatusPill status="warn" label="setup needed" />
          </div>
        </section>
      )}
      <RolePreviewPanel ownerProfileId={profile.id} users={users} />
      <UserManager ownerProfileId={profile.id} users={users} />
    </div>
  );
}
