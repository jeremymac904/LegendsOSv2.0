import { redirect } from "next/navigation";

import { AgentChat } from "@/components/agents/AgentChat";
import { ProcessorCockpit } from "@/components/processing/ProcessorCockpit";
import { SampleModeBanner } from "@/components/loanbrain/SampleModeBanner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listLoansForProfile, sampleBoardRows } from "@/lib/loanbrain/store";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isProcessor } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Ashley's processor cockpit. Visible to processors + owner/admin.
export default async function ProcessingPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isAdminOrOwner(profile) && !isProcessor(profile)) redirect("/dashboard");

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

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Processing · FLO"
        title="Processor cockpit"
        description="Your assigned files, what's missing, conditions, and one-click draft tools. Everything is a draft — nothing sends itself."
      />
      {usingSample && (
        <SampleModeBanner note="Demo data, no live assigned loans visible yet. Setup required for live data · no borrower data · drafts only." />
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          <ProcessorCockpit rows={rows} />
        </div>
        <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-7rem)]">
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
