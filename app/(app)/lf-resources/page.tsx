import Link from "next/link";
import { Building2, ChevronDown, ExternalLink, FolderOpen, LifeBuoy } from "lucide-react";

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
    <div className="space-y-4">
      <SectionHeader
        eyebrow="LF Resources"
        title="Loan Factory resource directory"
        description="A clean operating directory for Loan Factory training, support, departments, systems, setup resources, and important resource folders."
        action={
          <Link
            href="/lf-resources/lf-training-folder"
            className="btn-primary"
          >
            <ExternalLink size={14} />
            Open LF guide
          </Link>
        }
      />

      <section className="card-padded">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <p className="label flex items-center gap-2">
              <Building2 size={13} />
              Loan Factory source map
            </p>
            <h2 className="mt-1.5 text-lg font-semibold text-ink-900 dark:text-ink-100">
              Keep official LF links easy to find.
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              Loan Factory training, LO support, development, coaching,
              department links, system links, important forms, setup references,
              lender escalation resources, feedback, and AI training.
            </p>
            <p className="mt-2 text-xs text-ink-600 dark:text-ink-400">
              Source folder retained:{" "}
              <a
                href={LF_TRAINING_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-gold hover:underline dark:text-accent-champagne dark:hover:text-ink-100"
              >
                Loan Factory Training Folder
              </a>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
            <HeroStat icon={FolderOpen} label="Source" value="Google Drive" />
            <HeroStat icon={LifeBuoy} label="Support" value="LO-ready" />
            <HeroStat icon={ExternalLink} label="Links" value="New tab safe" />
          </div>
        </div>
        <details className="group mt-3 border-t border-ink-200 pt-3 dark:border-ink-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-600 dark:text-ink-400">
            <span>Coverage map ({REQUIRED_AREAS.length} areas)</span>
            <ChevronDown
              size={14}
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {REQUIRED_AREAS.map((area) => (
              <span key={area} className="chip">
                {area}
              </span>
            ))}
          </div>
        </details>
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
