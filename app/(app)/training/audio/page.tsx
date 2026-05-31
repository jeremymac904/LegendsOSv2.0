import Link from "next/link";
import { ArrowLeft, Headphones } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

const PLANNED_TOPICS = [
  "Five-minute Legends sales reset (between calls)",
  "First-call language patterns (audio walk-through)",
  "Past-client touchpoint pacing",
  "Partner conversation reset",
  "How to recover a stalled file in one call",
  "Closing-week communication discipline",
];

export default async function AudioLibraryPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <Link
        href="/training/academy"
        className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ink-500 transition-colors hover:text-accent-champagne dark:text-ink-400"
      >
        <ArrowLeft size={12} />
        Back to Academy
      </Link>

      <SectionHeader
        eyebrow="Legends Growth Academy"
        title="Audio Library"
        description="Short Legends audio briefs and walk-throughs — pair with a commute, lunch, or between-call reset. Catalog only in this sprint."
        action={<span className="chip-off">Catalog only</span>}
      />

      <section className="glass-card-padded">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-ink-50 text-ink-700 dark:border-accent-champagne/25 dark:bg-accent-gold/10 dark:text-accent-champagne">
            <Headphones size={16} />
          </span>
          <div>
            <p className="label">What lands here</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
              Three-to-eight-minute internal audio. Topics that are easier to
              hear than to read. Each entry includes a transcript, a Legends
              voice tag, and a one-line action prompt for the listener. Large
              audio files stay in Google Drive; LegendsOS holds references.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>Topics planned for first ship</h2>
          <p>Each entry is internal-only and owner-reviewed.</p>
        </div>
        <div className="glass-card-padded">
          <ul className="grid gap-2 md:grid-cols-2">
            {PLANNED_TOPICS.map((topic) => (
              <li
                key={topic}
                className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-champagne" />
                {topic}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
