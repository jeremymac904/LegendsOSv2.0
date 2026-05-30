import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, MessageCircle } from "lucide-react";

import { PriorityPill, StageStatusPill } from "@/components/loanbrain/statusPill";
import { SampleModeBanner } from "@/components/loanbrain/SampleModeBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { listLoansForProfile, sampleBoardRows } from "@/lib/loanbrain/store";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner, isLoanOfficer } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Simple LO view — assigned loans only, calm and uncluttered. No admin tools,
// no connectors, no provider settings.
export default async function MyLoansPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isAdminOrOwner(profile) && !isLoanOfficer(profile)) redirect("/dashboard");

  // Prefer real, RLS-scoped loans. Falls back to safe sample rows for the demo.
  const { source, loans } = await listLoansForProfile(profile);
  const usingSample = source === "sample" || loans.length === 0;
  const rows = usingSample
    ? sampleBoardRows().filter((r) => r.rootKind === "active_loans")
    : loans.map((l) => ({
        folderId: l.id,
        label: l.borrowerName ?? "Borrower",
        borrowerName: l.borrowerName ?? "Borrower",
        loanNumber: l.loan_number,
        loanProgram: l.loan_program,
        stage: l.stage,
        stageStatus: l.stage_status,
        priority: l.priority,
        missingCount: 0,
        conditionCount: 0,
        driveUrl: l.drive_url,
        rootKind: "active_loans",
        nextStep: null,
      }));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="My Loans"
        title="Your loan files"
        description="The loans assigned to you. Ask Atlas for help drafting borrower updates or explaining a program."
        action={
          <Link href="/atlas" className="btn-primary">
            <MessageCircle size={14} /> Ask Atlas
          </Link>
        }
      />

      {usingSample && (
        <SampleModeBanner note="Demo loans until your real files are assigned · no borrower data · nothing here is sent or written to Drive." />
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No loans assigned yet"
          description="When Jeremy assigns you a loan, it shows up here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.folderId} className="card-padded">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-100">
                    {r.borrowerName}
                  </p>
                  <p className="text-xs text-ink-300">
                    {r.loanProgram ?? "Program TBD"}
                    {r.loanNumber ? ` · #${r.loanNumber}` : ""}
                  </p>
                </div>
                <StageStatusPill status={r.stageStatus} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-300">
                <span className="chip capitalize">{r.stage}</span>
                {r.missingCount > 0 && <span className="chip-warn">{r.missingCount} missing docs</span>}
                <PriorityPill priority={r.priority} />
                {r.driveUrl && <span className="chip">Drive folder</span>}
              </div>
              {r.nextStep && (
                <p className="mt-3 border-t border-ink-200/60 pt-2 text-[11px] text-ink-600 dark:border-ink-800/60 dark:text-ink-300">
                  <span className="font-medium text-ink-700 dark:text-ink-200">Next step:</span>{" "}
                  {r.nextStep}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
