import Link from "next/link";
import { ArrowRight, BookOpen, Headphones, MessageCircle } from "lucide-react";

import { AcademyTrackCard } from "@/components/training/AcademyTrackCard";
import { LegendsAssistantsCatalog } from "@/components/training/LegendsAssistantsCatalog";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { ACADEMY_TRACKS } from "@/lib/legends/curriculum";

export const dynamic = "force-dynamic";

const SIDE_LINKS: {
  href: string;
  label: string;
  description: string;
  icon: typeof BookOpen;
}[] = [
  {
    href: "/training/scripts",
    label: "Scripts Library",
    description: "Buyer, partner, recapture, and follow-up scripts (preview).",
    icon: BookOpen,
  },
  {
    href: "/training/roleplay",
    label: "Roleplay Lab",
    description: "Practice with Legends personas inside Atlas (catalog).",
    icon: MessageCircle,
  },
  {
    href: "/training/audio",
    label: "Audio Library",
    description: "Short Legends audio briefs and walk-throughs (catalog).",
    icon: Headphones,
  },
];

const RECOMMENDED_CHANNELS = [
  {
    category: "Mortgage",
    channels: [
      { name: "Loan Factory", url: "https://www.youtube.com/@LoanFactory" },
      { name: "Win The Day", url: "https://www.youtube.com/@WinTheDay" },
    ],
  },
  {
    category: "Sales & Marketing",
    channels: [
      { name: "Jeremy Miner", url: "https://www.youtube.com/@JeremyMiner" },
      { name: "Alex Hormozi", url: "https://www.youtube.com/@AlexHormozi" },
      { name: "GaryVee", url: "https://www.youtube.com/@garyvee" },
    ],
  },
  {
    category: "AI & Vibe Coding",
    channels: [
      { name: "The Rundown AI", url: "https://www.youtube.com/@TheRundownAI" },
      { name: "Matthew Berman", url: "https://www.youtube.com/@matthew_berman" },
      { name: "Wes Roth", url: "https://www.youtube.com/@WesRoth" },
    ],
  },
  {
    category: "Mindset & Leadership",
    channels: [
      { name: "Jocko Willink", url: "https://www.youtube.com/@JockoPodcastOfficial" },
      { name: "Impact Theory", url: "https://www.youtube.com/@TomBilyeu" },
    ],
  },
];

export default async function AcademyLandingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Legends Growth OS"
        title="Legends Growth Academy"
        description="Sales, marketing, and AI tracks built for The Legends Mortgage Team. Internal only — every module is in Legends voice, none of it claims a rate, fee, or approval."
        action={<span className="chip-active">Sprint Execution — Live</span>}
      />

      <section className="glass-card-padded overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="label">Why this Academy exists</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              Repeatable execution. Less noise. No claims we can&apos;t back up.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              Five tracks that grow with a Legends LO from first conversation to
              senior execution. Modules are written in Legends voice,
              internal only, and reviewed before they ship to the team. AI
              training wires into LegendsOS Atlas; sales and marketing modules
              wire into the Scripts Library, Roleplay Lab, and Audio Library
              below.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">Internal only</span>
              <span className="chip">Legends voice</span>
              <span className="chip">Owner reviewed</span>
              <span className="chip">No rate, fee, or approval claims</span>
            </div>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-ink-50 p-5 dark:border-accent-champagne/15 dark:bg-ink-950/30">
            <p className="label">Status</p>
            <ul className="mt-3 space-y-2 text-[13px] text-ink-700 dark:text-ink-200">
              <li className="flex items-center gap-2">
                <span className="chip-active">Active</span>
                Five curriculum tracks (Sales, Marketing, AI, Mastery, Vibe)
              </li>
              <li className="flex items-center gap-2">
                <span className="chip-active">Live</span>
                Vibe Coding & Atlas Basics modules available
              </li>
              <li className="flex items-center gap-2">
                <span className="chip-off">Draft</span>
                Outlines for core Sales & Marketing curriculum
              </li>
              <li className="flex items-center gap-2">
                <span className="chip-active">Wired</span>
                Atlas Integration: Quizzes, summaries, and study notes
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>Tracks</h2>
          <p>Pick a track. Modules open in Legends voice.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ACADEMY_TRACKS.map((track) => (
            <AcademyTrackCard key={track.slug} track={track} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="section-title">
              <h2>Supporting libraries</h2>
              <p>Catalog entries and practice labs.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {SIDE_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="glass-card-padded group block transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne dark:bg-ink-950/40">
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

          <LegendsAssistantsCatalog />

          <section className="glass-card-padded">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">Certifications</h3>
                <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-400">Legends Academy certification paths and milestones.</p>
              </div>
              <span className="chip-off">Phase 4 Planning</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-800 opacity-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Sales</p>
                <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">Legends Certified LO</p>
              </div>
              <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-800 opacity-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Marketing</p>
                <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">Legends Growth Marketer</p>
              </div>
              <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-800 opacity-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">AI</p>
                <p className="mt-1 text-sm font-medium text-ink-900 dark:text-ink-100">Legends AI Specialist</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="glass-card-padded">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">Recommended Channels</h3>
            <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-400">External resources vetted for the Legends team.</p>
            
            <div className="mt-4 space-y-4">
              {RECOMMENDED_CHANNELS.map((group) => (
                <div key={group.category} className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{group.category}</p>
                  <ul className="space-y-1">
                    {group.channels.map((channel) => (
                      <li key={channel.name}>
                        <a 
                          href={channel.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[12px] text-ink-700 hover:text-accent-champagne transition-colors flex items-center gap-1.5"
                        >
                          <span className="h-1 w-1 rounded-full bg-accent-gold" />
                          {channel.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Legends Growth Academy is an internal training surface for The Legends
        Mortgage Team. It is not a Loan Factory program. Powered by Loan
        Factory attribution applies only to broader LegendsOS infrastructure.
      </p>
    </div>
  );
}
