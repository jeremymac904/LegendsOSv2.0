import Link from "next/link";
import { Building2, ExternalLink, FolderOpen, LifeBuoy } from "lucide-react";

import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { ResourceLibrary } from "@/components/resources/ResourceLibrary";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_LF_RESOURCES,
  LF_RESOURCE_CATEGORIES,
  LF_RESOURCE_TYPE,
  LF_TRAINING_FOLDER_URL,
  resourceFromShared,
} from "@/lib/teamResources";
import type { SharedResource } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const REQUIRED_AREAS = [
  "Loan Factory Training",
  "Loan Officer Support",
  "LO Development",
  "Corporate Coaching",
  "Training Academy",
  "Marketing Department",
  "Loan Factory System Links",
  "Important Forms",
  "n8n and LegendsOS Setup",
  "Google Workspace Setup",
  "Lender Escalation Resources",
  "Post Onboarding Check In",
  "Department Feedback",
  "AI Training Resources",
];

export default async function LFResourcesPage() {
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
    .eq("resource_type", LF_RESOURCE_TYPE)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const sharedItems = ((data ?? []) as SharedResource[]).map(resourceFromShared);
  const items = [...sharedItems, ...DEFAULT_LF_RESOURCES];

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[650px] flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader
          eyebrow="LF Resources"
          title="Loan Factory Directory"
          description="Official training, support, and system links."
        />
        <div className="flex items-center gap-2">
           <a href={LF_TRAINING_FOLDER_URL} target="_blank" rel="noopener noreferrer" className="btn py-1 text-xs"><ExternalLink size={14} /> Source Folder</a>
           <Link href="/lf-resources/lf-training-folder" className="btn-primary py-1 text-xs">Open Guide</Link>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[280px_1fr]">
        {/* Sidebar: Stats & About */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 scrollbar-thin">
           <div className="card-padded py-3 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Overview</h3>
              <p className="text-xs text-ink-300 leading-relaxed">A clean operating directory for Loan Factory training, support, and systems.</p>
              <div className="grid grid-cols-1 gap-2">
                 <HeroStat icon={FolderOpen} label="Source" value="Google Drive" />
                 <HeroStat icon={LifeBuoy} label="Support" value="LO-ready" />
              </div>
           </div>

           <div className="card-padded py-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-3">Coverage</h3>
              <div className="flex flex-wrap gap-1">
                 {REQUIRED_AREAS.map(area => <span key={area} className="text-[9px] chip-off px-1.5 py-0">{area}</span>)}
              </div>
           </div>

           <LegendsOSHelpCoaches coaches={["setup"]} />
        </div>

        {/* Main: Library */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white/40 dark:border-ink-800 dark:bg-ink-950/20">
           <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              <ResourceLibrary
                mode="lf"
                resourceType={LF_RESOURCE_TYPE}
                items={items}
                categories={LF_RESOURCE_CATEGORIES}
                owner={owner}
                organizationId={profile.organization_id}
                userId={profile.id}
                emptyTitle="No LF resources yet"
                emptyDescription="Jeremy has not published additional resources yet."
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
  icon: typeof FolderOpen;
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
