import { redirect } from "next/navigation";

import { SampleModeBanner } from "@/components/loanbrain/SampleModeBanner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listLoansForProfile, sampleBoardRows } from "@/lib/loanbrain/store";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isLoanOfficer } from "@/lib/permissions";

import { MyLoansView, type MyLoanRow } from "./MyLoansView";

export const dynamic = "force-dynamic";

// Simple LO view — assigned loans only, calm and uncluttered. No admin tools,
// no connectors, no provider settings. The server resolves RLS-scoped loans (or
// the labelled sample set) and hands a serializable list to the client view,
// which renders a compact list + detail panel with a real Ask-Atlas handoff.
export default async function MyLoansPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isAdminOrOwner(profile) && !isLoanOfficer(profile)) redirect("/dashboard");

  // Prefer real, RLS-scoped loans. Falls back to safe sample rows for the demo.
  const { source, loans } = await listLoansForProfile(profile);
  const usingSample = source === "sample" || loans.length === 0;
  const rows: MyLoanRow[] = usingSample
    ? sampleBoardRows()
        .filter((r) => r.rootKind === "active_loans")
        .map((r) => ({
          folderId: r.folderId,
          borrowerName: r.borrowerName,
          loanNumber: r.loanNumber,
          loanProgram: r.loanProgram,
          stage: r.stage,
          stageStatus: r.stageStatus,
          priority: r.priority,
          missingCount: r.missingCount,
          conditionCount: r.conditionCount,
          driveUrl: r.driveUrl,
          nextStep: r.nextStep ?? null,
        }))
    : loans.map((l) => ({
        folderId: l.id,
        borrowerName: l.borrowerName ?? "Borrower",
        loanNumber: l.loan_number,
        loanProgram: l.loan_program,
        stage: l.stage,
        stageStatus: l.stage_status,
        priority: l.priority,
        missingCount: 0,
        conditionCount: 0,
        driveUrl: l.drive_url,
        nextStep: null,
      }));

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="My Loans"
        title="Your loan files"
        description="The loans assigned to you. Select one to see details and ask Atlas for help drafting a borrower update or explaining a program."
      />

      {usingSample && (
        <SampleModeBanner note="Demo loans until your real files are assigned · no borrower data · nothing here is sent or written to Drive." />
      )}

      <MyLoansView rows={rows} />
    </div>
  );
}
