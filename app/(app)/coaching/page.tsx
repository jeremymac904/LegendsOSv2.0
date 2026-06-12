import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Headphones,
  Megaphone,
  MessageCircle,
  Trophy,
} from "lucide-react";

import { AcademyNav } from "@/components/training/AcademyNav";
import { CoachingJourney } from "@/components/training/CoachingJourney";
import { DailyCoaching } from "@/components/training/DailyCoaching";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getEffectiveProfile } from "@/lib/impersonation";
import { welcomeVideo } from "@/lib/legends/coachingVideos";

export const dynamic = "force-dynamic";

// Every tile links to a real, working route — no dead cards.
const ACADEMY_TOOLS = [
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
    href: "/training/audio",
    label: "Audio & Podcasts",
    description: "Coaching audio you can listen to on the go.",
    icon: Headphones,
  },
  {
    href: "/training",
    label: "Training Library",
    description: "Every Legends training resource in one place.",
    icon: GraduationCap,
  },
  {
    href: "/marketing-materials",
    label: "Marketing Materials",
    description: "Guides, templates, and campaign assets.",
    icon: Megaphone,
  },
  {
    href: "/lf-resources",
    label: "LF Resources",
    description: "Corporate coaching, LO development, and playbooks.",
    icon: Trophy,
  },
];

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

  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Legends Growth OS · Academy"
        title="Legends Mortgage Academy"
        description="Jeremy's 12-week academy for loan officers — a daily coaching feed, a week-by-week roadmap, action items, and a graduation path. Watch, work the items, and finish strong."
        action={<span className="chip-active">Academy · Live</span>}
      />

      <AcademyNav />

      {/* Welcome (Jeremy) */}
      <section className="glass-card-padded overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="label">Welcome · How the Academy works</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              Clear rhythm. Daily execution. Weekly accountability.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              The Academy pairs a simple daily coaching habit with a 12-week
              roadmap, then makes the week visible through action items you can
              actually run. Start with Jeremy&apos;s welcome below, then open
              Week 1.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">Daily coaching</span>
              <span className="chip">12-week roadmap</span>
              <span className="chip">Graduation path</span>
            </div>
          </div>
          {welcomeVideo && (
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-accent-champagne/20 bg-black">
              <iframe
                src={welcomeVideo.embedUrl}
                title="Welcome to Legends Mortgage Academy"
                className="h-full w-full"
                allow="encrypted-media; fullscreen"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </section>

      {/* Jeremy's daily coaching */}
      <DailyCoaching />

      {/* 12-week academy roadmap + progress + graduation */}
      <CoachingJourney firstName={firstName} />

      {/* Academy tools — every tile is a real route */}
      <section className="space-y-3">
        <div className="section-title">
          <h2>Academy tools</h2>
          <p>Scripts, roleplay, audio, and the resource libraries.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACADEMY_TOOLS.map((link) => {
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

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Legends Mortgage Academy is internal Legends training presented by Jeremy
        McDonald. Nothing here states a rate, fee, or approval.
      </p>
    </div>
  );
}
