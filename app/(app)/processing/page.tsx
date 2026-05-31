import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agents/AgentChat";
import { ProcessorCockpit } from "@/components/processing/ProcessorCockpit";
import { SampleModeBanner } from "@/components/loanbrain/SampleModeBanner";
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
      <SampleModeBanner note="Demo data, no live loans yet — these 2 files are samples. Setup required for live data · no borrower data · drafts only." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          <ProcessorCockpit rows={rows} />
        </div>
        <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-7rem)]">
          <AgentChat
            agentType="processor_flo"
            agentName="FLO"
            agentRole="Processing assistant — conditions, missing docs, CTC"
            seedPrompt="Build a condition plan for my active file, grouped by income, assets, credit, appraisal, title, insurance."
            compact
          />
        </div>
      </div>
    </div>
  );
}
