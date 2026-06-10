import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { VibeCodingHub } from "@/components/vibe/VibeCodingHub";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function VibeCodingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Team · Vibe Coding"
        title="Vibe Coding Hub"
        description="Build realtor landing pages, blog posts, and simple sites safely — with Jeremy's review"
        action={<span className="chip-active">Team-friendly</span>}
      />
      <VibeCodingHub />
    </div>
  );
}
