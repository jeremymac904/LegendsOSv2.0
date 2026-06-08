import { BookOpen, PlayCircle, Sparkles } from "lucide-react";

import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { ResourceLibrary } from "@/components/resources/ResourceLibrary";
import { LocalTrainingAssetBrowser } from "@/components/training/LocalTrainingAssetBrowser";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
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

export const dynamic = "force-dynamic";

const TRAINING_NUGGETS = [
  "Keep videos focused on one workflow or one decision.",
  "Add a clear next action so loan officers know what to do after watching.",
  "Use YouTube links for embeds; Drive videos open safely in a new tab.",
  "Turn repeat questions into short Training cards instead of long docs.",
];

export default async function TrainingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
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
    <div className="flex h-[calc(100vh-140px)] min-h-[650px] flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader
          eyebrow="Training"
          title="Training Command Center"
          description="Build repeatable execution with targeted coaching."
        />
        <div className="flex items-center gap-2">
           <span className="chip-ok text-[10px]">{owner ? "OWNER MANAGED" : "TEAM LIBRARY"}</span>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[300px_1fr]">
        {/* Sidebar: Info & Stats */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin">
           <div className="card-padded py-3 space-y-3">
              <p className="label text-[10px] uppercase tracking-wider">Learning Paths</p>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100 leading-tight">Build repeatable execution.</h2>
              <div className="grid grid-cols-1 gap-2">
                 <HeroStat icon={PlayCircle} label="Embeds" value="YouTube Ready" />
                 <HeroStat icon={Sparkles} label="Nuggets" value="Quick Lessons" />
                 <HeroStat
                   icon={BookOpen}
                   label="Indexed"
                   value={`${trainingAssetIndex.counts.indexedAssets} assets`}
                 />
              </div>
           </div>

           <div className="card-padded py-3">
              <p className="label text-[10px] uppercase tracking-wider mb-2">Training Nuggets</p>
              <div className="space-y-1.5">
                 {TRAINING_NUGGETS.map(n => <p key={n} className="text-[11px] text-ink-400 leading-snug">· {n}</p>)}
              </div>
           </div>

           <LegendsOSHelpCoaches coaches={["setup"]} />
        </div>

        {/* Main: Library */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white/40 dark:border-ink-800 dark:bg-ink-950/20">
           <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
              <LocalTrainingAssetBrowser
                assets={trainingAssets}
                counts={trainingAssetIndex.counts}
                driveLinks={trainingAssetIndex.driveLinks}
                description="Search local videos, transcripts, summaries, coaching docs, community packs, and source-map files without moving source assets."
                maxVisible={72}
                showLocalReferences={owner}
              />
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
      </div>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PlayCircle;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50 p-3 backdrop-blur-sm dark:border-accent-champagne/10 dark:bg-ink-950/30">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
          <Icon size={15} />
        </span>
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400">
          {label}
        </p>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">{value}</p>
    </div>
  );
}
