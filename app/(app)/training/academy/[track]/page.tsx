import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ModuleListItem } from "@/components/training/ModuleListItem";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { ACADEMY_TRACKS, findTrack } from "@/lib/legends/curriculum";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return ACADEMY_TRACKS.map((track) => ({ track: track.slug }));
}

interface AcademyTrackPageProps {
  params: { track: string };
}

export default async function AcademyTrackPage({
  params,
}: AcademyTrackPageProps) {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }

  const track = findTrack(params.track);
  if (!track) notFound();

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
        eyebrow={`Legends Academy · ${track.displayName}`}
        title={track.tagline}
        description={track.description}
        action={<span className="chip">{track.modules.length} modules</span>}
      />

      <section className="glass-card-padded">
        <p className="label">Audience</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
          {track.audience}
        </p>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>Modules</h2>
          <p>All modules are in Legends voice. Drafts are review-only previews.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {track.modules.map((module) => (
            <ModuleListItem
              key={module.id}
              module={module}
              trackSlug={track.slug}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
