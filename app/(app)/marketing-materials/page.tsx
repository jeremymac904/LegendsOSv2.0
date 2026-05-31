import { ChevronDown, FileStack, Megaphone, Palette, Presentation } from "lucide-react";

import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { ResourceLibrary } from "@/components/resources/ResourceLibrary";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_MARKETING_MATERIALS,
  MARKETING_CATEGORIES,
  MARKETING_RESOURCE_TYPE,
  resourceFromShared,
} from "@/lib/teamResources";
import type { SharedResource } from "@/types/database";

export const dynamic = "force-dynamic";

const MATERIAL_GROUPS = [
  "Webinar templates",
  "First time homebuyer guides",
  "Real estate agent guides",
  "YouTube and podcast topic templates",
  "First time homebuyer seminar materials",
  "Real estate AI seminar materials",
  "Buyer education handouts",
  "Realtor co-branded campaign templates",
  "Email newsletter templates",
  "Social campaign packs",
  "Open house materials",
  "Listing marketing support",
  "Presentation outlines",
  "Script templates",
];

export default async function MarketingMaterialsPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const owner = isOwner(profile);

  const { data } = await supabase
    .from("shared_resources")
    .select("*")
    .eq("resource_type", MARKETING_RESOURCE_TYPE)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const sharedItems = ((data ?? []) as SharedResource[]).map(resourceFromShared);
  const items = [...sharedItems, ...DEFAULT_MARKETING_MATERIALS];

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Marketing Materials"
        title="Mortgage campaign asset library"
        description="Templates, scripts, guides, seminar outlines, and campaign packs loan officers can customize without starting from scratch."
        action={
          <span className="chip-active">
            {owner ? "Owner upload ready" : "Team templates"}
          </span>
        }
      />

      <section className="card-padded">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <p className="label flex items-center gap-2">
              <Megaphone size={13} />
              Campaign kits
            </p>
            <h2 className="mt-1.5 text-lg font-semibold text-ink-900 dark:text-ink-100">
              Give every LO a polished starting point.
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              Webinar outlines, buyer education handouts, realtor co-branded
              campaigns, social packs, newsletter starters, open house
              materials, presentation structures, and scripts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
            <HeroStat icon={FileStack} label="Formats" value="Decks, scripts, guides" />
            <HeroStat icon={Palette} label="Brand" value="Mortgage safe" />
            <HeroStat icon={Presentation} label="Use" value="Customize or copy" />
          </div>
        </div>
        <details className="group mt-3 border-t border-ink-200 pt-3 dark:border-ink-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-600 dark:text-ink-400">
            <span>Material types covered ({MATERIAL_GROUPS.length})</span>
            <ChevronDown
              size={14}
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {MATERIAL_GROUPS.map((group) => (
              <span key={group} className="chip">
                {group}
              </span>
            ))}
          </div>
        </details>
      </section>

      <LegendsOSHelpCoaches
        coaches={["marketing"]}
        intro="Use the Marketing Image Coach to plan visuals, prepare reference photos, tighten Image Studio prompts, and keep mortgage marketing assets safe."
      />

      <ResourceLibrary
        mode="marketing"
        resourceType={MARKETING_RESOURCE_TYPE}
        items={items}
        categories={MARKETING_CATEGORIES}
        owner={owner}
        organizationId={profile.organization_id}
        userId={profile.id}
        emptyTitle="No marketing materials yet"
        emptyDescription={
          owner
            ? "Add templates, scripts, decks, or campaign assets for the team to customize."
            : "Jeremy has not published marketing materials yet. Check back after the first template batch is shared."
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
  icon: typeof FileStack;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 dark:border-accent-champagne/10 dark:bg-ink-950/30 dark:backdrop-blur-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-gold/30 bg-accent-gold/10 text-accent-gold dark:border-accent-champagne/20 dark:text-accent-champagne">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400">
          {label}
        </p>
        <p className="text-xs font-semibold text-ink-900 dark:text-ink-100">{value}</p>
      </div>
    </div>
  );
}
