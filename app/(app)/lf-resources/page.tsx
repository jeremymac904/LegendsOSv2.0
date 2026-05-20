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
  if (!profile) return null;
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
    <div className="space-y-6">
      <SectionHeader
        eyebrow="LF Resources"
        title="Loan Factory resource directory"
        description="A clean operating directory for Loan Factory training, support, departments, systems, setup resources, and important resource folders."
        action={
          <a
            href={LF_TRAINING_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            <ExternalLink size={14} />
            Training folder
          </a>
        }
      />

      <section className="card-padded">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="label flex items-center gap-2">
              <Building2 size={13} />
              Loan Factory source map
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-100">
              Keep official LF links easy to find.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">
              Use this page for Loan Factory training, LO support, development,
              coaching, department links, system links, important forms, setup
              references, lender escalation resources, feedback, and AI
              training.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <HeroStat icon={FolderOpen} label="Source" value="Google Drive" />
            <HeroStat icon={LifeBuoy} label="Support" value="LO-ready" />
            <HeroStat icon={ExternalLink} label="Links" value="New tab safe" />
          </div>
        </div>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Coverage map</h2>
            <p>Every required Loan Factory area has a place to land.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {REQUIRED_AREAS.map((area) => (
            <span key={area} className="chip">
              {area}
            </span>
          ))}
        </div>
      </section>

      <LegendsOSHelpCoaches
        coaches={["setup"]}
        intro="Use the Setup Coach when an LF resource depends on LegendsOS, n8n, Google Workspace, approved social accounts, MCP, or AI provider setup."
      />

      <ResourceLibrary
        mode="lf"
        resourceType={LF_RESOURCE_TYPE}
        items={items}
        categories={LF_RESOURCE_CATEGORIES}
        owner={owner}
        organizationId={profile.organization_id}
        userId={profile.id}
        emptyTitle="No LF resources yet"
        emptyDescription={
          owner
            ? "Add official Loan Factory folders, docs, forms, and department links as team-shared resources."
            : "Jeremy has not published additional LF resources yet. Use the top-level training folder for now."
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
  icon: typeof FolderOpen;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
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
