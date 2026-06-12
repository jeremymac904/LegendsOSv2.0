import { AcademyFeed } from "@/components/training/AcademyFeed";
import { AcademyNav } from "@/components/training/AcademyNav";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { profile } = await getEffectiveProfile();
  if (!profile)
    return (
      <EmptyState
        title="Profile unavailable"
        description="Refresh or sign in again."
      />
    );
  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? "";
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Legends Mortgage Academy"
        title="Academy Feed"
        description="The team coaching feed — share wins, ask questions, and trade scripts, alongside daily and weekly coaching posts from Jeremy."
      />
      <AcademyNav />
      <AcademyFeed firstName={firstName} />
    </div>
  );
}
