import { AcademyNav } from "@/components/training/AcademyNav";
import { TeamActivityDashboard } from "@/components/training/TeamActivityDashboard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function TeamActivityPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="Refresh the page or sign in again."
      />
    );
  }
  if (!isOwner(profile)) {
    return (
      <EmptyState
        title="Owner only"
        description="Team activity and coaching visibility are limited to the owner. Loan officers see their own Feed, Today, and Scorecard."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Legends Mortgage Academy"
        title="Team activity"
        description="Who's active, who's behind, and who needs a coaching follow-up — across wins, daily activity, scorecards, and Academy progress."
      />
      <AcademyNav />
      <TeamActivityDashboard />
    </div>
  );
}
