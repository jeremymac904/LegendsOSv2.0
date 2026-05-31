import { redirect } from "next/navigation";
import { Puzzle } from "lucide-react";

import { SkillManager } from "@/components/agents/SkillManager";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { AGENT_REGISTRY, agentsForProfile } from "@/lib/agents/registry";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

export default async function MySkillsPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) redirect("/login");

  const agentTypes = agentsForProfile(profile).map((t) => ({
    value: t,
    label: `${AGENT_REGISTRY[t].name} · ${AGENT_REGISTRY[t].role}`,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings · AI"
        title="My Skills"
        description="Reusable workflows your agents can follow. Create them here or say 'save this as a skill' in any agent chat. The owner can promote a great skill to the whole team."
        action={<span className="chip"><Puzzle size={14} /> reusable workflows</span>}
      />
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Your skills</h2>
            <p>Each skill is scoped to one agent and applied automatically when relevant.</p>
          </div>
          <StatusPill status="info" label="personal" />
        </div>
        <SkillManager agentTypes={agentTypes} />
      </section>
    </div>
  );
}
