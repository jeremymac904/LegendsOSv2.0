import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agents/AgentChat";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { BuilderWorkspace } from "@/components/builder/BuilderWorkspace";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  searchParams,
}: {
  searchParams?: { prompt?: string };
}) {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isOwner(profile)) redirect("/dashboard");

  const seeded =
    typeof searchParams?.prompt === "string" && searchParams.prompt.trim()
      ? searchParams.prompt.slice(0, 4000)
      : "Write a complete Claude Code prompt to build a mortgage landing page for a first-time homebuyer campaign.";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Builder · Owner"
        title="Jeremy's Build Workspace"
        description="A real model-powered Builder agent for websites, landing pages, blog/training content, and Claude Code / Codex / AionUI prompts — plus the planning cockpit below."
        action={<span className="chip-active">Owner only</span>}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-7rem)]">
          <AgentChat
            agentType="builder_agent"
            agentName="Builder"
            agentRole="Build assistant — pages, content, Claude Code / Codex / AionUI prompts"
            seedPrompt={seeded}
          />
        </div>
        <div className="min-w-0 space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">Planning cockpit</p>
          <BuilderWorkspace />
        </div>
      </div>
    </div>
  );
}
