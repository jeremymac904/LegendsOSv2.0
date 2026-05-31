import { redirect } from "next/navigation";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { VibeWorkspace } from "@/components/vibe/VibeWorkspace";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

// Vibe Coding — the team-friendly LO education + workflow surface (all roles).
// Pick a workflow card, fill a few fields, and it composes a ready-to-run
// prompt you can Copy, Send to Atlas, or run through Jeremy AI Review (an AI
// style review, not a human approval). This is NOT a separate AI system.
export default async function VibeCodingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) redirect("/login");

  return (
    <div>
      <SectionHeader
        eyebrow="Vibe Coding"
        title="Compose a prompt, get a style review"
        description="Pick a workflow, fill in a few details, and it builds a clean prompt for you. Copy it, send it to Atlas, or run a Jeremy AI Review to pressure-test brand fit, clarity, and compliance before you ship."
      />
      <VibeWorkspace />
    </div>
  );
}
