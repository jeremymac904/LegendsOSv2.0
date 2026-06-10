import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, ChevronDown, ExternalLink, MessageCircle } from "lucide-react";

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
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
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
        <div className="card divide-y divide-ink-200/60 dark:divide-ink-800/60">
          {rows.map((r) => (
            <details
              key={r.folderId}
              className="group px-4 py-2.5 [&_summary]:list-none"
            >
              {/* Compact clickable row — click toggles the detail disclosure */}
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-champagne/40">
                <ChevronDown
                  size={14}
                  className="shrink-0 text-ink-400 transition-transform group-open:rotate-180"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {r.borrowerName}
                  </p>
                  <p className="truncate text-xs text-ink-500 dark:text-ink-300">
                    {r.loanProgram ?? "Program TBD"}
                    {r.loanNumber ? ` · #${r.loanNumber}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="chip capitalize">{r.stage}</span>
                  {r.missingCount > 0 && (
                    <span className="chip-warn">{r.missingCount} missing</span>
                  )}
                  <PriorityPill priority={r.priority} />
                  <StageStatusPill status={r.stageStatus} />
                </div>
              </summary>

              {/* Detail panel — real Drive anchor + Atlas context link */}
              <div className="mt-2.5 ml-7 space-y-2.5 border-t border-ink-200/60 pt-2.5 dark:border-ink-800/60">
                {r.nextStep && (
                  <p className="text-[11px] text-ink-600 dark:text-ink-300">
                    <span className="font-medium text-ink-700 dark:text-ink-200">
                      Next:
                    </span>{" "}
                    {r.nextStep}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-600 dark:text-ink-300">
                  {r.loanNumber && <span>Loan #{r.loanNumber}</span>}
                  {r.conditionCount > 0 && (
                    <span>{r.conditionCount} open conditions</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.driveUrl ? (
                    <a
                      href={r.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-xs"
                    >
                      <ExternalLink size={13} /> Open Drive folder
                    </a>
                  ) : (
                    <span className="chip-off" title="No Drive folder linked for this loan yet">
                      Drive not linked
                    </span>
                  )}
                  <Link
                    href={`/atlas?prompt=${encodeURIComponent(
                      `Help me draft a status update for borrower ${r.borrowerName}${
                        r.loanNumber ? ` on loan #${r.loanNumber}` : ""
                      }.`
                    )}`}
                    className="btn-ghost text-xs"
                  >
                    <MessageCircle size={13} /> Ask Atlas about this loan
                  </Link>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
