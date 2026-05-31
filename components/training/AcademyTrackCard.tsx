import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

import type { CurriculumTrack } from "@/lib/legends/curriculum";

interface AcademyTrackCardProps {
  track: CurriculumTrack;
}

/**
 * Single track card on the Legends Growth Academy landing.
 * Server-rendered; receives a static curriculum track.
 */
export function AcademyTrackCard({ track }: AcademyTrackCardProps) {
  const moduleCount = track.modules.length;
  const draftCount = track.modules.filter((m) => m.status === "draft").length;

  return (
    <Link
      href={`/training/academy/${track.slug}`}
      className="glass-card-padded group block transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-accent-champagne/25 bg-accent-gold/10 text-accent-champagne dark:bg-ink-950/40">
            <GraduationCap size={16} />
          </span>
          <div>
            <p className="label">Track</p>
            <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">
              {track.displayName}
            </h3>
          </div>
        </div>
        <ArrowRight
          size={16}
          className="text-ink-600 transition-colors group-hover:text-accent-champagne dark:text-ink-400"
        />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
        {track.tagline}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-500 dark:text-ink-300">
        {track.description}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="chip">
          {moduleCount} {moduleCount === 1 ? "module" : "modules"}
        </span>
        {draftCount > 0 && (
          <span className="chip">{draftCount} draft</span>
        )}
        <span className="chip">Internal</span>
      </div>
    </Link>
  );
}
