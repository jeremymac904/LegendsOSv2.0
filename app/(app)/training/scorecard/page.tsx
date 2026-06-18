import { AcademyNav } from "@/components/training/AcademyNav";
import { AcademyScorecard } from "@/components/training/AcademyScorecard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return <EmptyState title="Profile unavailable" description="Refresh or sign in again." />;
  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? "";
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Legends Mortgage Academy"
        title="Scorecard"
        description="A compact weekly grid for daily metrics, pace, reflection, and coach submission."
      />
      <AcademyNav />
      <AcademyScorecard firstName={firstName} />
    </div>
  );
}
