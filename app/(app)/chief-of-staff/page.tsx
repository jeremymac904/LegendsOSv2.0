import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Snowflake,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { RecommendationCard } from "@/components/chief-of-staff/RecommendationCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buildChiefOfStaffBriefing } from "@/lib/chiefOfStaff/recommendations";
import type { BriefingSection, SectionKey } from "@/lib/chiefOfStaff/types";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

// AI Chief of Staff — the daily "what matters today" briefing. Read-only.
// Aggregates signals from data the platform already stores (loans, contacts,
// leads, automations) into prioritized, explainable recommendations. Every
// underlying read is RLS-scoped, so each person sees only their own picture.

const SECTION_ICONS: Record<SectionKey, LucideIcon> = {
  people_to_contact: Users,
  loans_needing_attention: Briefcase,
  agent_relationships_cooling: Snowflake,
  opportunities: Sparkles,
  broken_automations: AlertTriangle,
};

function SectionBlock({ section }: { section: BriefingSection }) {
  const Icon = SECTION_ICONS[section.key];
  const count = section.recommendations.length;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
            <Icon size={15} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
              {section.title}
            </h2>
            <p className="text-[11.5px] text-ink-500 dark:text-ink-400">
              {section.blurb}
            </p>
          </div>
        </div>
        {count > 0 && (
          <span className="chip shrink-0" title={`${count} item(s) need attention`}>
            {count}
          </span>
        )}
      </div>

      {count > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {section.recommendations.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      ) : (
        <div className="card flex items-center gap-3 px-4 py-3">
          <CheckCircle2 size={16} className="shrink-0 text-status-ok" />
          <p className="text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
            {section.source === "unavailable"
              ? `${section.title} isn't connected to a data source yet — nothing to show. ${section.emptyMessage}`
              : section.emptyMessage}
          </p>
        </div>
      )}
    </section>
  );
}

export default async function ChiefOfStaffPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }

  const briefing = await buildChiefOfStaffBriefing();
  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? "there";
  const hasAnything = briefing.totalCount > 0;

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="AI Chief of Staff"
        title="What matters today"
        description={
          hasAnything
            ? `${briefing.totalCount} thing${
                briefing.totalCount === 1 ? "" : "s"
              } need your attention${
                briefing.highPriorityCount > 0
                  ? ` · ${briefing.highPriorityCount} high priority`
                  : ""
              }. Start at the top.`
            : `You're clear, ${firstName}. Nothing is flagged right now — the sections below show what the Chief of Staff is watching.`
        }
      />

      {!hasAnything && (
        <div className="card flex items-center gap-3 px-4 py-3">
          <CheckCircle2 size={18} className="shrink-0 text-status-ok" />
          <p className="text-[13px] leading-relaxed text-ink-700 dark:text-ink-200">
            Inbox zero for your business. As loans, contacts, leads, and
            automations generate signals, the most important ones will surface
            here automatically.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {briefing.sections.map((section) => (
          <SectionBlock key={section.key} section={section} />
        ))}
      </div>

      <p className="flex items-center gap-1.5 pt-1 text-[10.5px] text-ink-400">
        <TrendingUp size={11} />
        v1 uses simple, transparent rules over your existing data. Each card
        shows the exact signal it used. Nothing here sends, publishes, or writes
        anything.
      </p>
    </div>
  );
}
