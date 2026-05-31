import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agents/AgentChat";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { canSee } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Marketing Assistant — real model-powered marketing agent. Drafts route to
// Social/Email Studio for review; never a live publish.
export default async function MarketingAssistantPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!canSee(profile, { roles: ["marketing", "loan_officer"] })) redirect("/dashboard");

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col space-y-4">
      <SectionHeader
        eyebrow="Studios · Marketing"
        title="Marketing Assistant"
        description="Real AI for social posts, email drafts, image prompts, YouTube repurposing, GBP/Meta posts, and content calendars — with built-in mortgage compliance. Drafts only; nothing publishes itself."
      />
      <div className="min-h-0 flex-1">
        <AgentChat
          agentType="marketing_agent"
          agentName="Marketing Assistant"
          agentRole="Marketing content assistant"
          seedPrompt="Draft a compliant Facebook post about first-time homebuyer tips, with a hook and a clear call to action."
        />
      </div>
    </div>
  );
}
