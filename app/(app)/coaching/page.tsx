import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Headphones,
  MessageCircle,
  Trophy,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getEffectiveProfile } from "@/lib/impersonation";
import {
  allianceWeeks,
  coachingFeatures,
  coachingPrograms,
  HEYGEN_COACHING_INTRO,
  masteryWeeks,
  podcastCategories,
  type CoachingWeek,
} from "@/lib/legends/coachingProgram";

export const dynamic = "force-dynamic";

const SIDE_LINKS = [
  {
    href: "/training/scripts",
    label: "Scripts Library",
    description: "First-call, follow-up, buyer, and partner scripts.",
    icon: BookOpen,
  },
  {
    href: "/training/roleplay",
    label: "Roleplay Lab",
    description: "Practice objections and consults with Legends personas.",
    icon: MessageCircle,
  },
  {
    href: "/lf-resources",
    label: "LF Resources",
    description: "Corporate coaching, LO development, and playbooks.",
    icon: Trophy,
  },
];

function CurriculumGrid({ weeks }: { weeks: CoachingWeek[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {weeks.map((w) => (
        <div
          key={w.week}
          className="rounded-xl border border-ink-200 bg-ink-50 p-3 dark:border-accent-champagne/15 dark:bg-ink-950/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
              Week {w.week}
            </span>
            <span className="chip-off">{w.phase}</span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-ink-900 dark:text-ink-100">
            {w.theme}
          </p>
        </div>
      ))}
    </div>
  );
}

export default async function CoachingPage() {
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
        eyebrow="Legends Growth OS · Coaching"
        title="Coaching"
        description="The LO Mastery and Loan Factory Alliance coaching programs — weekly rhythm, daily execution, scripts, trackers, and a 12-week curriculum that turns activity into closed loans."
        action={<span className="chip-active">Programs · Live</span>}
      />

      <section className="glass-card-padded overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="label">How coaching works</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              Clear rhythm. Daily execution. Weekly accountability.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              Coaching pairs a weekly plan with simple daily habits, then makes
              the week visible through scorecards and trackers. Start with LO
              Mastery for structure and follow-up; step up to the Alliance for an
              advanced operating system, partner development, and leadership
              rhythm.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">Weekly coaching</span>
              <span className="chip">12-week curriculum</span>
              <span className="chip">Scripts &amp; trackers</span>
            </div>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-accent-champagne/20 bg-black">
            <iframe
              src={HEYGEN_COACHING_INTRO}
              title="Coaching intro"
              className="h-full w-full"
              allow="encrypted-media; fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>Programs</h2>
          <p>Two tiers. Pick the rhythm that matches where you are.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {coachingPrograms.map((program) => (
            <article key={program.key} className="glass-card-padded flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-ink-900 dark:text-ink-100">
                  {program.name}
                </h3>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
                  <Trophy size={16} />
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium uppercase tracking-wider text-accent-champagne">
                {program.rhythm}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
                {program.bestFor}
              </p>
              <ul className="mt-4 grid flex-1 gap-1.5 sm:grid-cols-2">
                {program.includes.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-1.5 text-[12px] text-ink-700 dark:text-ink-200"
                  >
                    <CheckCircle2 size={13} className="text-accent-gold" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>What you get</h2>
          <p>The coaching platform in five moving parts.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coachingFeatures.map((f) => (
            <div key={f.title} className="glass-card-padded">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>LO Mastery — 12-week curriculum</h2>
          <p>Foundation to follow-up. One theme per week.</p>
        </div>
        <CurriculumGrid weeks={masteryWeeks} />
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>Loan Factory Alliance — advanced 12 weeks</h2>
          <p>An operating system for production, partners, and leadership.</p>
        </div>
        <CurriculumGrid weeks={allianceWeeks} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          <div className="section-title">
            <h2>Keep going</h2>
            <p>Scripts, roleplay, and the resource library.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {SIDE_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="glass-card-padded group block transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
                      <Icon size={16} />
                    </span>
                    <ArrowRight
                      size={16}
                      className="text-ink-600 transition-colors group-hover:text-accent-champagne dark:text-ink-400"
                    />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {link.label}
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                    {link.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="glass-card-padded">
          <div className="flex items-center gap-2">
            <Headphones size={15} className="text-accent-champagne" />
            <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              Coaching podcast tracks
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-400">
            Audio coaching across {podcastCategories.length} tracks (hosted
            library — full episode import pending).
          </p>
          <ul className="mt-3 space-y-1.5">
            {podcastCategories.map((cat) => (
              <li
                key={cat}
                className="flex items-center gap-1.5 text-[12px] text-ink-700 dark:text-ink-200"
              >
                <span className="h-1 w-1 rounded-full bg-accent-gold" />
                {cat}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Coaching content is internal Legends training adapted from the Loan
        Factory coaching curriculum. Nothing here states a rate, fee, or
        approval.
      </p>
    </div>
  );
}
