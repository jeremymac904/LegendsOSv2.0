import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Target } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import {
  ACADEMY_TRACKS,
  findModule,
  statusLabel,
} from "@/lib/legends/curriculum";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return ACADEMY_TRACKS.flatMap((track) =>
    track.modules.map((entry) => ({
      track: track.slug,
      module: entry.id,
    }))
  );
}

interface AcademyModulePageProps {
  params: { track: string; module: string };
}

export default async function AcademyModulePage({
  params,
}: AcademyModulePageProps) {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;

  const result = findModule(params.track, params.module);
  if (!result) notFound();

  const { track, moduleEntry } = result;
  const levelLabel =
    moduleEntry.level === "track-only" ? "Mastery" : `Level ${moduleEntry.level}`;
  const statusChipClass =
    moduleEntry.status === "available"
      ? "chip-active"
      : moduleEntry.status === "coming-soon"
        ? "chip-off"
        : "chip";

  return (
    <div className="space-y-6">
      <Link
        href={`/training/academy/${track.slug}`}
        className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ink-500 transition-colors hover:text-accent-champagne dark:text-ink-400"
      >
        <ArrowLeft size={12} />
        Back to {track.displayName}
      </Link>

      <SectionHeader
        eyebrow={`${track.displayName} · ${levelLabel}`}
        title={moduleEntry.title}
        description={moduleEntry.summary}
        action={
          <span className={statusChipClass}>{statusLabel(moduleEntry.status)}</span>
        }
      />

      <section className="glass-card-padded">
        <div className="flex flex-wrap items-center gap-4 text-[12px] text-ink-600 dark:text-ink-300">
          <span className="inline-flex items-center gap-2">
            <Clock size={13} />
            {moduleEntry.durationMinutes} minute read or watch
          </span>
          <span className="inline-flex items-center gap-2">
            <Target size={13} />
            {moduleEntry.learningOutcomes.length} learning outcome
            {moduleEntry.learningOutcomes.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      <section className="glass-card-padded">
        <p className="label">Learning outcomes</p>
        <ul className="mt-3 space-y-2 text-sm text-ink-700 dark:text-ink-200">
          {moduleEntry.learningOutcomes.map((outcome) => (
            <li key={outcome} className="flex gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-champagne" />
              <span>{outcome}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass-card-padded">
        <p className="label">What ships when this module is built</p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-ink-700 dark:text-ink-200">
          <li>A Legends-voice walkthrough (text + short video link).</li>
          <li>One practice prompt that links into the Roleplay Lab.</li>
          <li>An owner-reviewed compliance footer where relevant.</li>
          <li>A short post-module reflection prompt the LO completes in Atlas.</li>
        </ul>
        {moduleEntry.internalNotes && (
          <p className="mt-4 rounded-xl border border-accent-champagne/15 bg-ink-950/30 px-3 py-2 text-[12px] leading-relaxed text-ink-600 dark:bg-ink-950/30 dark:text-ink-300">
            <span className="label mr-2">Internal note</span>
            {moduleEntry.internalNotes}
          </p>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        This is a Phase 1 module scaffold. Body content lands when Jeremy
        approves the next sprint. No claims about rates, fees, approval, or
        underwriting outcomes appear in any Legends Academy material.
      </p>
    </div>
  );
}
