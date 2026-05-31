import { redirect } from "next/navigation";
import { Brain } from "lucide-react";

import { MemoryManager } from "@/components/agents/MemoryManager";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { AGENT_REGISTRY, agentsForProfile } from "@/lib/agents/registry";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

export default async function AssistantMemoryPage() {
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
        title="Assistant Memory"
        description="What your agents remember about you — preferences, tone, rules, and saved workflows. Private to you; the owner can audit but other teammates cannot see it."
        action={<span className="chip"><Brain size={14} /> {profile.email}</span>}
      />
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Your private memory</h2>
            <p>Scoped per agent — your Atlas memory is separate from your FLO memory.</p>
          </div>
          <StatusPill status="info" label="private" />
        </div>
        <MemoryManager agentTypes={agentTypes} />
      </section>
    </div>
  );
}
