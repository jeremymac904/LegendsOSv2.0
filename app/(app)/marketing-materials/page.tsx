import { FileStack, Megaphone, Palette, Presentation } from "lucide-react";

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
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function MarketingMaterialsPage() {
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
    .eq("resource_type", MARKETING_RESOURCE_TYPE)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const sharedItems = ((data ?? []) as SharedResource[]).map(resourceFromShared);
  const items = [
    ...sharedItems,
    ...DEFAULT_MARKETING_MATERIALS.filter((item) =>
      owner ? true : item.id !== "marketing-project-folder"
    ),
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Marketing Materials"
        title="LO Asset Library"
        description="Guides, slide-deck outlines, scripts, handouts, social captions, and compliance-safe campaign starters loan officers can use inside LegendsOS."
        action={
          <span className="chip-active">
            {owner ? "Owner upload ready" : "Team templates"}
          </span>
        }
      />

      <section className="card-padded">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="label flex items-center gap-2">
              <Megaphone size={13} />
              Ready-to-use materials
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              Start from a guide, deck outline, script, or copy block.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              This library hides raw source folders from loan officers and opens
              usable internal detail pages first. Source links stay secondary
              for owners or when the original file is truly needed.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <HeroStat icon={FileStack} label="Formats" value="Decks, scripts, guides" />
            <HeroStat icon={Palette} label="Brand" value="Mortgage safe" />
            <HeroStat icon={Presentation} label="Use" value="Customize or copy" />
          </div>
        </div>
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
    <div className="rounded-xl border border-ink-200 bg-white/65 p-3 backdrop-blur-sm dark:border-accent-champagne/10 dark:bg-ink-950/30">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
          <Icon size={15} />
        </span>
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
          {label}
        </p>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">{value}</p>
    </div>
  );
}
