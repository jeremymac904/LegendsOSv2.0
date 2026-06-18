import { AcademyNav } from "@/components/training/AcademyNav";
import { AcademyToday } from "@/components/training/AcademyToday";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again."
      />
    );
  }

  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Legends Mortgage Academy"
        title="Today"
        description="Daily coaching video, time block, tasks, scorecard rollup, and resources in one focused workspace."
        action={<span className="chip-active">Academy · Today</span>}
      />
      <AcademyNav />
      <AcademyToday firstName={firstName} />
    </div>
  );
}
