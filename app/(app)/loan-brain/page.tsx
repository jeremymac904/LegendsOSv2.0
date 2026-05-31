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

  const description = status.connected
    ? "Read-only view of the Jeremy Applicants Pipeline. Browse a borrower folder, then generate a loan summary, processor handoff, missing-item list, condition plan, overlay note, pipeline update, or Ashley email — all as drafts for review."
    : "Sample/demo mode — no live Drive connection yet. Borrowers and files below are demo data. You can preview the workflow and generate watermarked sample drafts (not for sending); live read-only Drive browsing turns on once the connection is wired up.";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Atlas · Loan Brain"
        title={status.connected ? "Borrower file browser" : "Borrower file browser (sample mode)"}
        description={description}
      />
      <LoanBrainBrowser status={status} />
    </div>
  );
}
