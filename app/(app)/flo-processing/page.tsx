import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agents/AgentChat";
import { ProcessorCockpit } from "@/components/processing/ProcessorCockpit";
import { SampleModeBanner } from "@/components/loanbrain/SampleModeBanner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DEFAULT_THEME_SNAPSHOT } from "@/lib/themeSnapshot";
import { listLoansForProfile, sampleBoardRows } from "@/lib/loanbrain/store";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isProcessor } from "@/lib/permissions";
import { resolveThemeSnapshot } from "@/lib/themeServer";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

// Ashley's branded FLO workspace. Same secure auth, same assigned loans, now
// with a workspace-specific entry surface and headline.
export default async function FloProcessingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
  if (!isAdminOrOwner(profile) && !isProcessor(profile)) redirect("/dashboard");

  const host = headers().get("x-hostname") ?? headers().get("host");
  const theme =
    (await resolveThemeSnapshot({ profile, host }).catch(() => DEFAULT_THEME_SNAPSHOT)) ??
    DEFAULT_THEME_SNAPSHOT;

  // Active loans become Ashley's processing queue. Prefer real RLS-scoped
  // assignments, then fall back to explicit sample rows when none are visible.
  const { source, loans } = await listLoansForProfile(profile);
  const usingSample = source === "sample" || loans.length === 0;
  const rows = usingSample
    ? sampleBoardRows().filter((r) => r.rootKind === "active_loans")
    : loans
        .filter((loan) => !["lead", "prospect", "past_client", "closed", "funded"].includes(loan.stage))
        .map((loan) => ({
          folderId: loan.id,
          label: loan.borrowerName ?? "Borrower",
          borrowerName: loan.borrowerName ?? "Borrower",
          loanNumber: loan.loan_number,
          loanProgram: loan.loan_program,
          stage: loan.stage,
          stageStatus: loan.stage_status,
          priority: loan.priority,
          missingCount: 0,
          conditionCount: 0,
          driveUrl: loan.drive_url,
          rootKind: "active_loans",
          nextStep: null,
        }));

  const logoSrc = theme.logo.url ?? "/assets/logos/lf-processing-logo.png";
  const workspaceName = theme.workspaceDisplayName ?? "Flo Processing";
  const headline = theme.loginHeadline ?? "Flo Processing Command Center";
  const subheadline =
    theme.loginSubheadline ??
    "A smarter workspace for processing, document review, conditions, and loan flow support.";

  return (
    <div className="space-y-6 xl:flex xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:flex-col xl:gap-6 xl:overflow-hidden xl:space-y-0">
      <SectionHeader
        eyebrow="Flo Processing · Ashley"
        title={headline}
        description={subheadline}
      />
      <div className="overflow-hidden rounded-[28px] border border-accent-champagne/15 bg-[linear-gradient(135deg,rgba(5,6,10,0.74),rgba(5,6,10,0.56)_50%,rgba(201,138,106,0.08)),radial-gradient(55%_45%_at_18%_22%,rgba(43,93,74,0.24),transparent_60%),radial-gradient(45%_35%_at_82%_14%,rgba(201,138,106,0.22),transparent_62%)] p-5 shadow-glass">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-accent-champagne/20 bg-ink-950/50 p-2 shadow-glow">
              <img
                src={logoSrc}
                alt={workspaceName}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="max-w-2xl">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-accent-champagne/80">
                Same secure LegendsOS session
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-100">
                Ashley&apos;s processing command center
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                Dedicated to conditions, missing docs, borrower follow-up, and
                loan flow support without exposing other users&apos; files or
                workflows.
              </p>
            </div>
          </div>
          <div className="grid gap-2 rounded-2xl border border-accent-champagne/15 bg-ink-950/35 p-3 text-xs text-ink-300 lg:min-w-[280px]">
            <div className="flex items-center justify-between gap-3">
              <span className="uppercase tracking-[0.18em] text-[10px] text-accent-champagne/80">
                Workspace
              </span>
              <span className="chip">/flo-processing</span>
            </div>
            <p className="leading-relaxed">
              {theme.workspaceSlug === "flo_processing"
                ? "Branding follows the workspace settings configured for LFprocessing.net."
                : "Default LegendsOS theme is active until a branded workspace is loaded."}
            </p>
          </div>
        </div>
      </div>
      {usingSample && (
        <SampleModeBanner note="Demo data, no live assigned loans visible yet. Setup required for live data · no borrower data · drafts only." />
      )}
      <div className="grid grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_400px] xl:overflow-hidden">
        <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pr-1 xl:scrollbar-thin">
          <ProcessorCockpit rows={rows} />
        </div>
        <div className="h-[34rem] xl:h-full xl:min-h-0">
          <AgentChat
            agentType="processor_flo"
            agentName="FLO"
            agentRole="Processing assistant — conditions, missing docs, CTC"
            seedPrompt="Build a condition plan for my active file, grouped by income, assets, credit, appraisal, title, insurance."
            compact
          />
        </div>
      </div>
    </div>
  );
}
