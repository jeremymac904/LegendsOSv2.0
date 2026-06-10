import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Target, MessageSquare, BookOpen, ExternalLink } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { Accordion, type AccordionItemData } from "@/components/ui/Accordion";
import { getEffectiveProfile } from "@/lib/impersonation";
import { EmptyState } from "@/components/ui/EmptyState";
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
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }

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

  // Atlas deep link helper
  const atlasQueryUrl = (query: string) => `/atlas?q=${encodeURIComponent(query)}`;
  const body =
    "body" in moduleEntry && typeof moduleEntry.body === "string"
      ? moduleEntry.body
      : "";
  const lessonItems: AccordionItemData[] = [
    {
      id: "outcomes",
      title: "Learning Outcomes",
      children: (
        <ul className="space-y-2 text-sm text-ink-700 dark:text-ink-200">
          {moduleEntry.learningOutcomes.map((outcome) => (
            <li key={outcome} className="flex gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-champagne" />
              <span>{outcome}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "roadmap",
      title: "What ships when complete",
      children: (
        <ul className="list-inside list-disc space-y-1.5 text-sm text-ink-700 dark:text-ink-200">
          <li>A Legends-voice walkthrough (text + short video link).</li>
          <li>One practice prompt that links into the Roleplay Lab.</li>
          <li>An owner-reviewed compliance footer where relevant.</li>
          <li>A short post-module reflection prompt the LO completes in Atlas.</li>
        </ul>
      ),
    },
  ];

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

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
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

          {body ? (
            <section className="glass-card-padded prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-ink-800 dark:text-ink-100 leading-relaxed">
                {body}
              </div>
            </section>
          ) : (
            <section className="glass-card-padded flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-ink-100 dark:bg-ink-900 flex items-center justify-center text-ink-400">
                <BookOpen size={24} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink-900 dark:text-ink-100">Video & Content Needed</h3>
              <p className="mt-2 max-w-sm text-sm text-ink-600 dark:text-ink-400">
                This module is currently an outline. Recording is pending and will be available in the next Academy update.
              </p>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-500">Lesson Details</h2>
            <Accordion items={lessonItems} allowMultiple={false} className="w-full space-y-2" />
          </section>
        </div>

        <aside className="space-y-4">
          <div className="glass-card-padded">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">Atlas Integration</h3>
            <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-400">Use AI to deepen your understanding of this lesson.</p>
            
            <div className="mt-4 space-y-2">
              <Link 
                href={atlasQueryUrl(`I just finished the lesson: ${moduleEntry.title}. Can you give me a 3-question quiz to test my knowledge?`)}
                className="btn-secondary w-full justify-start text-[12px] py-2"
              >
                <MessageSquare size={14} className="mr-2" />
                Create Quiz
              </Link>
              <Link 
                href={atlasQueryUrl(`Summarize the key takeaways from the Legends Academy lesson: ${moduleEntry.title}`)}
                className="btn-secondary w-full justify-start text-[12px] py-2"
              >
                <BookOpen size={14} className="mr-2" />
                Create Summary
              </Link>
              <Link 
                href={atlasQueryUrl(`Create a set of study notes based on the module: ${moduleEntry.title}`)}
                className="btn-secondary w-full justify-start text-[12px] py-2"
              >
                <ExternalLink size={14} className="mr-2" />
                Create Study Notes
              </Link>
            </div>
          </div>

          {moduleEntry.internalNotes && (
            <div className="glass-card-padded bg-accent-gold/5 border-accent-gold/10">
              <p className="label text-accent-champagne">Internal note</p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                {moduleEntry.internalNotes}
              </p>
            </div>
          )}
        </aside>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Legends Growth Academy is an internal training surface. No claims about rates, fees, approval, or
        underwriting outcomes appear in any Legends Academy material.
      </p>
    </div>
  );
}
