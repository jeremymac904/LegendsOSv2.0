import { AcademyNav } from "@/components/training/AcademyNav";
import { AcademyResources } from "@/components/training/AcademyResources";
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
        title="Resources"
        description="Scripts, tools, training, podcast, the weekly calendar, and downloads — every Legends resource in one place."
      />
      <AcademyNav />
      <AcademyResources firstName={firstName} />
    </div>
  );
}
