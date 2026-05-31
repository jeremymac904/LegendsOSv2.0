import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agents/AgentChat";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isProcessor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// FLO — Ashley's processing assistant. Real model-powered agent.
export default async function FloPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isAdminOrOwner(profile) && !isProcessor(profile)) redirect("/dashboard");

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-4">
      <SectionHeader
        eyebrow="Processing · FLO"
        title="FLO — Processing assistant"
        description="Real AI for conditions, missing documents, title/insurance/appraisal issues, borrower follow-up, CTC planning, and file cleanup. Drafts only — nothing sends itself."
      />
      <div className="min-h-0 flex-1">
        <AgentChat
          agentType="processor_flo"
          agentName="FLO"
          agentRole="Processing assistant"
          seedPrompt="Group this file's outstanding conditions by income, assets, credit, appraisal, title, and insurance — and tell me the next action for each."
        />
      </div>
    </div>
  );
}
