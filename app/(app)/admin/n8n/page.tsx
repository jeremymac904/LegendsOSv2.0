import { redirect } from "next/navigation";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { N8nPanel } from "@/components/admin/N8nPanel";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// n8n Automation Control Panel — owner/admin only.
//
// This is an operations panel for the owner to inspect n8n config, test
// webhook presence, view workflow registry, review recent automation jobs, and
// retry failures through the existing queue gates. Team members use /automation
// for their allowed automations and own run history.

export default async function N8nAdminPage() {
  let ownerGated = false;
  try {
    const { profile } = await getEffectiveProfile();
    if (!profile || !isAdminOrOwner(profile)) redirect("/dashboard");
    ownerGated = true;
  } catch (e) {
    // If getEffectiveProfile throws (Supabase misconfigured etc.), redirect
    // rather than 500 so the app stays usable.
    if (
      e instanceof Error &&
      (e.message.includes("NEXT_REDIRECT") ||
        (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
    ) {
      throw e;
    }
    redirect("/dashboard");
  }

  if (!ownerGated) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin"
        title="n8n Automation Control"
        description="Owner/admin control panel for the n8n workflow engine. Inspect connection state (presence only — no secrets), workflow registry, webhook status, recent jobs, dispatch logs, credential presence, and safe failed-job retry."
        action={<StatusPill status="warn" label="owner/admin" />}
      />
      <N8nPanel />
    </div>
  );
}
