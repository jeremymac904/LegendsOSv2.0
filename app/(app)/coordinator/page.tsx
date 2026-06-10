import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agents/AgentChat";
import { CoordinatorBoard } from "@/components/coordinator/CoordinatorBoard";
import { SampleModeBanner } from "@/components/loanbrain/SampleModeBanner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listLoansForProfile, sampleBoardRows } from "@/lib/loanbrain/store";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isCoordinator } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

// Geraldine's follow-up board. Visible to coordinators + owner/admin.
export default async function CoordinatorPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
  if (!isAdminOrOwner(profile) && !isCoordinator(profile)) redirect("/dashboard");

  // Leads + prospects are Geraldine's follow-up queue. Prefer real RLS-scoped
  // assignments, then fall back to explicit sample rows when none are visible.
  const { source, loans } = await listLoansForProfile(profile);
  const usingSample = source === "sample" || loans.length === 0;
  const rows = usingSample
    ? sampleBoardRows().filter((r) => r.rootKind === "leads" || r.rootKind === "prospects")
    : loans
        .filter((loan) => ["lead", "prospect"].includes(loan.stage))
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
          rootKind: loan.stage === "lead" ? "leads" : "prospects",
          nextStep: null,
        }));

  return (
    <div className="space-y-6 xl:flex xl:h-[calc(100dvh-7rem)] xl:min-h-0 xl:flex-col xl:gap-6 xl:overflow-hidden xl:space-y-0">
      <SectionHeader
        eyebrow="Coordinator"
        title="Follow-up board"
        description="Who needs contact, what to collect, and draft messages — with one tap to escalate to Jeremy. Draft-first; nothing sends itself."
      />
      {usingSample && (
        <SampleModeBanner note="Sample Mode — no live assigned leads/prospects visible yet · no borrower data · drafts only, nothing sends." />
      )}
      <div className="grid grid-cols-1 gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_400px] xl:overflow-hidden">
        <div className="min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pr-1 xl:scrollbar-thin">
          <CoordinatorBoard rows={rows} sampleMode={usingSample} />
        </div>
        <div className="h-[34rem] xl:h-full xl:min-h-0">
          <AgentChat
            agentType="coordinator_agent"
            agentName="Coordinator Assistant"
            agentRole="Follow-up engine — document chasing, realtor updates, handoffs"
            seedPrompt="Draft today's borrower follow-up plan: who to contact, what to collect, and the message for each."
            compact
          />
        </div>
      </div>
    </div>
  );
}
