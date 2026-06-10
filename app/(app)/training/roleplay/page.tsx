import Link from "next/link";
import { ArrowLeft, MessageCircle, Shield } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const PLANNED_PERSONAS = [
  "First-Time Buyer (anxious, plain-language)",
  "Move-Up Buyer (timeline-sensitive)",
  "FHA Buyer (down payment concern)",
  "VA Buyer (clarity on benefits)",
  "Jumbo Buyer (private-banking comparison)",
  "DSCR Investor (cash-flow framing)",
  "Refi Candidate (educational only)",
  "Recapture Target (past client)",
  "Realtor Partner (co-marketing)",
  "Lender AE (escalation framing)",
];

export default async function RoleplayLabPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/training/academy"
        className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ink-500 transition-colors hover:text-accent-champagne dark:text-ink-400"
      >
        <ArrowLeft size={12} />
        Back to Academy
      </Link>

      <SectionHeader
        eyebrow="Legends Growth Academy"
        title="Roleplay Lab"
        description="Practice tough conversations against Legends personas inside Atlas. Catalog only in this sprint — wires into Atlas when the provider gate is flipped."
        action={<span className="chip-off">Catalog only</span>}
      />

      <section className="glass-card-padded">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-accent-champagne/25 bg-ink-950/40 text-accent-champagne dark:bg-ink-950/40">
            <MessageCircle size={16} />
          </span>
          <div>
            <p className="label">How Roleplay Lab will work</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
              Pick a persona. Open Atlas. Practice the conversation with the AI
              playing the persona. Score yourself against three behavior
              markers. Save what worked, retire what didn&apos;t. Borrower PII
              never enters a roleplay thread — practice scenarios are
              synthetic.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>Personas planned for first ship</h2>
          <p>Internal only. Owner-reviewed before they go live.</p>
        </div>
        <div className="glass-card-padded">
          <ul className="grid gap-2 md:grid-cols-2">
            {PLANNED_PERSONAS.map((persona) => (
              <li
                key={persona}
                className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-champagne" />
                {persona}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="glass-card-padded">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-accent-champagne/25 bg-ink-950/40 text-accent-champagne dark:bg-ink-950/40">
            <Shield size={16} />
          </span>
          <div>
            <p className="label">Hard rules</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-ink-700 dark:text-ink-200">
              <li>No real borrower data inside a roleplay thread.</li>
              <li>No rate, fee, APR, or approval claims from the persona.</li>
              <li>Practice transcripts are owner-reviewable; not training data.</li>
              <li>Outcomes are coaching feedback, not pipeline activity.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
