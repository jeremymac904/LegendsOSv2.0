import { redirect } from "next/navigation";
import { Puzzle } from "lucide-react";

import { SkillManager } from "@/components/agents/SkillManager";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { AGENT_REGISTRY } from "@/lib/agents/registry";
import { AGENT_TYPES } from "@/lib/agents/types";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSkillsPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const agentTypes = AGENT_TYPES.map((t) => ({
    value: t,
    label: `${AGENT_REGISTRY[t].name} · ${AGENT_REGISTRY[t].role}`,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Owner · Admin"
        title="Agent Skills"
        description="Every team member's agent skills, by agent. Promote a strong skill to make it team-shared, or deactivate an unsafe one. Promotion and deactivation are audited."
        action={<StatusPill status="ok" label="owner" />}
      />
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Team skills</h2>
            <p>RLS shows you every user&apos;s skills. Use the share icon to promote, power icon to deactivate.</p>
          </div>
          <StatusPill status="info" label="audited" />
        </div>
        <SkillManager agentTypes={agentTypes} admin />
      </section>
    </div>
  );
}
