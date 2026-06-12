import Link from "next/link";
import { ArrowRight, GraduationCap, Megaphone, Sparkles } from "lucide-react";

import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { ResourceLibrary } from "@/components/resources/ResourceLibrary";
import { AcademyNav } from "@/components/training/AcademyNav";
import { LocalTrainingAssetBrowser } from "@/components/training/LocalTrainingAssetBrowser";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { aiAdvantagePublishedVideos } from "@/lib/legends/aiAdvantageVideos";
import { trainingAssetIndex, trainingAssets } from "@/lib/legends/trainingAssets";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_TRAINING_ITEMS,
  TRAINING_CATEGORIES,
  TRAINING_RESOURCE_TYPE,
  resourceFromShared,
} from "@/lib/teamResources";
import type { SharedResource } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

// One unified training system: AI Advantage + Legends Mortgage Academy + Elite
// Sales & Marketing, each shown visually and linking to real content.
const PROGRAMS = [
  {
    title: "AI Advantage",
    blurb: `${aiAdvantagePublishedVideos.length} lessons — Jeremy's AI training for loan officers.`,
    href: "/training/ai-advantage",
    thumb: `https://i.ytimg.com/vi/${aiAdvantagePublishedVideos[0]?.youtubeVideoId}/hqdefault.jpg`,
    icon: Sparkles,
  },
  {
    title: "Legends Mortgage Academy",
    blurb: "12-week roadmap, daily coaching, scorecard, and graduation — with Jeremy.",
    href: "/coaching",
    icon: GraduationCap,
  },
  {
    title: "Elite Sales & Marketing",
    blurb: "Sales 101–601 and the marketing playbooks, guides, and templates.",
    href: "/marketing-materials",
    icon: Megaphone,
  },
];

export default async function TrainingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
  const supabase = getSupabaseServerClient();
  const owner = isOwner(profile);

  const { data } = await supabase
    .from("shared_resources")
    .select("*")
    .eq("resource_type", TRAINING_RESOURCE_TYPE)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const sharedItems = ((data ?? []) as SharedResource[]).map(resourceFromShared);
  const items = [...sharedItems, ...DEFAULT_TRAINING_ITEMS];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Legends Growth OS · Training"
        title="Training"
        description="One training system — AI Advantage, the Legends Mortgage Academy, and Elite Sales & Marketing in one place."
        action={
          <span className="chip-ok text-[10px]">
            {owner ? "OWNER MANAGED" : "TEAM LIBRARY"}
          </span>
        }
      />

      <AcademyNav />

      {/* Programs — visual entry to every course */}
      <section className="space-y-3">
        <div className="section-title">
          <h2>Programs</h2>
          <p>Three programs, one system. Pick where you want to grow.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.href}
                href={p.href}
                className="group glass-card-padded block overflow-hidden p-0 transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="flex aspect-video w-full items-end bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 bg-cover bg-center p-3"
                  style={
                    p.thumb ? { backgroundImage: `url(${p.thumb})` } : undefined
                  }
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent-champagne/40 bg-ink-950/70 text-accent-champagne">
                    <Icon size={16} />
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                      {p.title}
                    </h3>
                    <ArrowRight
                      size={15}
                      className="text-ink-500 transition-colors group-hover:text-accent-champagne"
                    />
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                    {p.blurb}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Full library */}
      <section className="space-y-3">
        <div className="section-title">
          <h2>Full training library</h2>
          <p>
            {trainingAssetIndex.counts.indexedAssets} indexed assets — videos,
            transcripts, summaries, coaching docs, and source maps.
          </p>
        </div>
        <div className="rounded-2xl border border-ink-200 bg-white/40 p-4 dark:border-ink-800 dark:bg-ink-950/20">
          <LocalTrainingAssetBrowser
            assets={trainingAssets}
            counts={trainingAssetIndex.counts}
            driveLinks={trainingAssetIndex.driveLinks}
            description="Search local videos, transcripts, summaries, coaching docs, community packs, and source-map files without moving source assets."
            maxVisible={48}
            showLocalReferences={owner}
          />
          <div className="mt-4">
            <ResourceLibrary
              mode="training"
              resourceType={TRAINING_RESOURCE_TYPE}
              items={items}
              categories={TRAINING_CATEGORIES}
              owner={owner}
              organizationId={profile.organization_id}
              userId={profile.id}
              emptyTitle="No training content yet"
              emptyDescription="Jeremy has not published training items yet."
            />
          </div>
        </div>
      </section>

      {owner && <LegendsOSHelpCoaches coaches={["setup"]} />}
    </div>
  );
}
