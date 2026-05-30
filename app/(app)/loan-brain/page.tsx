import { redirect } from "next/navigation";

import { LoanBrainBrowser } from "@/components/loanbrain/LoanBrainBrowser";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Atlas Loan Brain — Jeremy's command center for the read-only Drive browser.
// Owner-only: this is the full mortgage operations cockpit.
export default async function LoanBrainPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;
  if (!isOwner(profile)) redirect("/dashboard");

  const status = getDriveConnectionStatus();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Atlas · Loan Brain"
        title="Borrower file browser"
        description="Read-only view of the Jeremy Applicants Pipeline. Browse a borrower folder, then generate a loan summary, processor handoff, missing-item list, condition plan, overlay note, pipeline update, or Ashley email — all as drafts."
      />
      <LoanBrainBrowser status={status} />
    </div>
  );
}
