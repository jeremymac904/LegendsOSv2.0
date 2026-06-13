import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";

import { EliteLibrary } from "@/components/training/EliteLibrary";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getEffectiveProfile } from "@/lib/impersonation";
import { eliteLevels, eliteLessonCount } from "@/lib/legends/eliteContent";

export const dynamic = "force-dynamic";

export default async function EliteSalesMarketingPage() {
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
        eyebrow="Legends Mortgage Academy"
        title="Elite Sales & Marketing"
        description="Jeremy's six-level sales and marketing curriculum — 101 Foundation through 601 Elite Execution. Each level is a week of real work: lessons, a do-this-today list, a weekly assignment, and the tracker metrics your coach reviews."
        action={
          <Link href="/training/resources?tab=elite" className="btn-ghost text-sm">
            <ArrowLeft size={14} /> Resources
          </Link>
        }
      />

      <section className="glass-card-padded">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-champagne/25 bg-ink-950/40 text-accent-champagne">
              <GraduationCap size={18} />
            </span>
            <div className="min-w-0 max-w-2xl">
              <p className="label">How the levels work</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
                Start at 101 and move up one level at a time. Every level ends
                with a weekly assignment and tracker metrics — bring both to the
                weekly group coaching call. Compliance watch-outs are part of
                the curriculum, not an afterthought: nothing you publish or send
                states a rate, payment, or guarantee.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="chip">{eliteLevels.length} levels</span>
            <span className="chip">{eliteLessonCount} lessons</span>
            <span className="chip">Group coaching reviewed</span>
          </div>
        </div>
      </section>

      <EliteLibrary />

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Elite Sales & Marketing is internal Legends Mortgage Academy training.
        Marketing setup walk-throughs that support 401 and 501 live in
        Resources → Marketing.
      </p>
    </div>
  );
}
