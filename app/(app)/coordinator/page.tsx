import { redirect } from "next/navigation";

import { CoordinatorBoard } from "@/components/coordinator/CoordinatorBoard";
import { SampleModeBanner } from "@/components/loanbrain/SampleModeBanner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { sampleBoardRows } from "@/lib/loanbrain/store";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isCoordinator } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Geraldine's follow-up board. Visible to coordinators + owner/admin.
export default async function CoordinatorPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isAdminOrOwner(profile) && !isCoordinator(profile)) redirect("/dashboard");

  // Leads + prospects are Geraldine's follow-up queue. Sample data until live.
  const rows = sampleBoardRows().filter(
    (r) => r.rootKind === "leads" || r.rootKind === "prospects"
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Coordinator"
        title="Follow-up board"
        description="Who needs contact, what to collect, and draft messages — with one tap to escalate to Jeremy. Draft-first; nothing sends itself."
      />
      <SampleModeBanner note="Sample Mode — demo follow-ups, no live leads yet · no borrower data · drafts only, nothing sends." />
      <CoordinatorBoard rows={rows} sampleMode />
    </div>
  );
}
