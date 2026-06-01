import { redirect } from "next/navigation";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConnectionCenter } from "@/components/admin/ConnectionCenter";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Owner-facing OAuth Connection Center.
//
// HONESTY: this page never renders a fake "connected" state. Every status the
// child component shows is derived from the real /api/integrations/* routes, and
// the recent-activity feed below is read defensively from integration_audit_log
// (NON-secret rows only). If any read fails — missing table, missing service
// key, RLS — we degrade to empty data and still render rather than 500.

// Shape of an integration_audit_log row we surface in the activity feed. We only
// read NON-secret columns; the table by design holds no tokens or secrets.
export interface IntegrationActivityRow {
  id: string;
  action: string;
  provider: string | null;
  actor_id: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
}

// Defensive read of the most recent integration audit rows. Never throws: a
// missing table / missing service key / RLS error all degrade to [].
async function safeRecentActivity(): Promise<IntegrationActivityRow[]> {
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("integration_audit_log")
      .select("id,action,provider,actor_id,created_at,metadata")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error || !Array.isArray(data)) return [];
    return data as IntegrationActivityRow[];
  } catch {
    return [];
  }
}

export default async function ConnectionCenterPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const recentActivity = await safeRecentActivity();
  const ownerEmail = profile.email ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Connections"
        title="OAuth Connection Center"
        description="Owner-only control room for every external integration LegendsOS can use — Google (Gmail, Drive, Calendar), Meta, YouTube, Google Business Profile, n8n, and Zapier. Status is honest: nothing reads as connected unless the data says so, and no secret value is ever shown."
        action={<StatusPill status="ok" label="owner gated" />}
      />

      <ConnectionCenter recentActivity={recentActivity} ownerEmail={ownerEmail} />
    </div>
  );
}
