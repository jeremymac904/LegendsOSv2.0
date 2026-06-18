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
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Legends Mortgage Academy"
        title="Resources"
        description="Scripts, playbooks, training, podcasts, and downloads that open inside LegendsOS first."
      />
      <AcademyNav />
      <AcademyResources firstName={firstName} />
    </div>
  );
}
