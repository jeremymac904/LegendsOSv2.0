import { redirect } from "next/navigation";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { N8nPanel } from "@/components/admin/N8nPanel";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// n8n Automation Control Panel — owner only.
//
// This is an operations panel for the owner to inspect n8n config, test
// webhook URLs, view recent automation jobs, retry failures, and trigger
// workflows by ID. Team members never see this; they trigger approved
// workflows through LegendsOS module pages only.

export default async function N8nAdminPage() {
  let ownerGated = false;
  try {
    const { profile } = await getEffectiveProfile();
    if (!profile || !isOwner(profile)) redirect("/dashboard");
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
        description="Owner-only control panel for the n8n workflow engine. Inspect connection state (presence only — no secrets), view active workflows, test webhook URLs, review recent automation jobs, retry failures, and manually trigger workflows by ID. Team members never interact here; they trigger approved automations through their module pages."
        action={<StatusPill status="warn" label="owner only" />}
      />
      <N8nPanel />
    </div>
  );
}
