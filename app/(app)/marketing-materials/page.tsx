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
    <div className="space-y-6">
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
        <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="label flex items-center gap-2">
              <Megaphone size={13} />
              Campaign kits
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-100">
              Give every LO a polished starting point.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">
              Find webinar outlines, buyer education handouts, realtor
              co-branded campaigns, social packs, newsletter starters, open
              house materials, presentation structures, and scripts.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <HeroStat icon={FileStack} label="Formats" value="Decks, scripts, guides" />
            <HeroStat icon={Palette} label="Brand" value="Mortgage safe" />
            <HeroStat icon={Presentation} label="Use" value="Customize or copy" />
          </div>
        </div>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Material types</h2>
            <p>Coverage areas for the team library.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {MATERIAL_GROUPS.map((group) => (
            <span key={group} className="chip">
              {group}
            </span>
          ))}
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
