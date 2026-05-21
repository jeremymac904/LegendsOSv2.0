import { BookOpen, GraduationCap, PlayCircle, Sparkles } from "lucide-react";

import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { ResourceLibrary } from "@/components/resources/ResourceLibrary";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
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
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Training"
        title="Team training command center"
        description="Mortgage coaching, AI training, n8n walkthroughs, LegendsOS basics, Google Workspace setup, and Loan Factory workflow resources."
        action={
          <span className="chip-active">
            {owner ? "Owner managed" : "Team library"}
          </span>
        }
      />

      <section className="card-padded overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="label flex items-center gap-2">
              <GraduationCap size={13} />
              Learning paths
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-100">
              Build repeatable loan officer execution.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">
              Organize videos, quick tutorials, technology walkthroughs,
              mortgage coaching, sales coaching, AI training, n8n training,
              LegendsOS training, and Loan Factory workflow training in one
              place.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["AI Tools", "Loan Factory Systems", "Atlas Training", "Mortgage Coaching"].map(
                (label) => (
                  <span key={label} className="chip">
                    {label}
                  </span>
                )
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <HeroStat icon={PlayCircle} label="Embeds" value="YouTube ready" />
            <HeroStat icon={BookOpen} label="Sources" value="Drive + team" />
            <HeroStat icon={Sparkles} label="Nuggets" value="Quick lessons" />
          </div>
        </div>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Training nuggets</h2>
            <p>Short standards for making every training item useful.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {TRAINING_NUGGETS.map((nugget) => (
            <div
              key={nugget}
              className="rounded-xl border border-accent-champagne/10 bg-ink-950/30 p-3 text-sm text-ink-200 backdrop-blur-sm"
            >
              {nugget}
            </div>
          ))}
        </div>
      </section>

      <LegendsOSHelpCoaches
        coaches={["setup"]}
        intro="Use the Setup Coach when turning training questions into repeatable LegendsOS, n8n, Google Workspace, MCP, and provider setup guidance."
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
        emptyDescription={
          owner
            ? "Add a video, Drive link, or quick tutorial to make it visible to the team."
            : "Jeremy has not published training items yet. Check back after the first training batch is shared."
        }
      />
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
    <div className="rounded-xl border border-accent-champagne/10 bg-ink-950/30 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
          <Icon size={15} />
        </span>
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
          {label}
        </p>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink-100">{value}</p>
    </div>
  );
}
