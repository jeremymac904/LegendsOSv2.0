import { redirect } from "next/navigation";

import { ProcessorCockpit } from "@/components/processing/ProcessorCockpit";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { sampleBoardRows } from "@/lib/loanbrain/store";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isProcessor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Ashley's processor cockpit. Visible to processors + owner/admin.
export default async function ProcessingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isAdminOrOwner(profile) && !isProcessor(profile)) redirect("/dashboard");

  // Active loans become Ashley's processing queue. Sample data until live.
  const rows = sampleBoardRows().filter((r) => r.rootKind === "active_loans");

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Processing · FLO"
        title="Processor cockpit"
        description="Your assigned files, what's missing, conditions, and one-click draft tools. Everything is a draft — nothing sends itself."
      />
      <ProcessorCockpit rows={rows} />
    </div>
  );
}
