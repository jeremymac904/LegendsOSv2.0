import { redirect } from "next/navigation";

import { UserManager } from "@/components/admin/UserManager";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
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
        description="Add users via Supabase Auth Admin API, change roles, send password resets, and preview the app as any user. All writes are server-side; the service role key stays out of the browser."
      />
      <UserManager ownerProfileId={profile.id} users={users} />
    </div>
  );
}
