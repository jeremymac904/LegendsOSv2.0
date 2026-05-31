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
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="label flex items-center gap-2">
              <GraduationCap size={13} />
              Learning paths
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              Build repeatable loan officer execution.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
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

        <details className="group mt-5 border-t border-ink-200 pt-4 dark:border-ink-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <span className="label">Training nuggets — standards for useful items</span>
            <span className="text-[11px] text-ink-600 transition-transform group-open:rotate-180 dark:text-ink-400">
              ▾
            </span>
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {TRAINING_NUGGETS.map((nugget) => (
              <div
                key={nugget}
                className="glass-panel p-3 text-sm text-ink-700 dark:text-ink-200"
              >
                {nugget}
              </div>
            ))}
          </div>
        </details>
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
    <div className="glass-panel p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 bg-ink-50 text-ink-700 dark:border-accent-champagne/20 dark:bg-accent-gold/10 dark:text-accent-champagne">
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
