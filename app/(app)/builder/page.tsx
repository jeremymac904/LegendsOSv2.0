import { redirect } from "next/navigation";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { BuilderWorkspace } from "@/components/builder/BuilderWorkspace";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isOwner(profile)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Builder · Owner"
        title="Jeremy's Build Workspace"
        description="A private cockpit for building LegendsOS and personal products — track projects, capture sessions, draft implementation plans, hand work off to Claude Code and Codex, run release QA, and incubate new ideas."
        action={<span className="chip-active">Owner only</span>}
      />
      <BuilderWorkspace />
    </div>
  );
}
