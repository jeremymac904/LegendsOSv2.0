import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agents/AgentChat";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isProcessor } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

// FLO — Ashley's processing assistant. Real model-powered agent.
export default async function FloPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
  if (!isAdminOrOwner(profile) && !isProcessor(profile)) redirect("/dashboard");

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden">
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
