import { AcademyNav } from "@/components/training/AcademyNav";
import { AcademyToday } from "@/components/training/AcademyToday";
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
    <div className="flex h-[calc(100dvh-7rem)] min-h-[650px] flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="label">Legends Mortgage Academy</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-50">
            Today
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
            Daily execution dashboard: coaching, scorecard, accountability, and next actions.
          </p>
        </div>
        <div className="shrink-0">
          <AcademyNav />
        </div>
      </div>
      <AcademyToday firstName={firstName} />
    </div>
  );
}
