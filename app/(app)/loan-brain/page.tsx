import { redirect } from "next/navigation";

import { LoanBrainBrowser } from "@/components/loanbrain/LoanBrainBrowser";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

// Atlas Loan Brain — Jeremy's command center for mortgage file intelligence.
// Owner-only: this is the full mortgage operations cockpit.
export default async function LoanBrainPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
  if (!isOwner(profile)) redirect("/dashboard");

  const status = getDriveConnectionStatus();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Atlas · Loan Brain"
        title="Mortgage memory cockpit"
        description="Search real Loan Memory by borrower, co-borrower, address, loan number, portal context, document metadata, Gmail intake metadata, or pipeline record. If live data is not available, the cockpit shows the exact setup gaps instead of pretending."
      />
      <LoanBrainBrowser status={status} />
    </div>
  );
}
