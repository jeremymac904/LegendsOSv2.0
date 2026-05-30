import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { VibeCodingHub } from "@/components/vibe/VibeCodingHub";

export const dynamic = "force-dynamic";

export default async function VibeCodingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;

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
