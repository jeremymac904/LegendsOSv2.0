import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

const PLANNED_CATEGORIES = [
  {
    title: "Buyer conversation",
    examples: [
      "First-call opener (no rate, no payment)",
      "Pre-approval invitation",
      "Affordability framing without quoting",
      "Buyer recapture re-entry",
    ],
  },
  {
    title: "Realtor partner",
    examples: [
      "Co-marketing introduction",
      "Listing prep value add",
      "Open house buyer education",
      "Quarterly partner check-in",
    ],
  },
  {
    title: "Past client",
    examples: [
      "Annual review touchpoint",
      "Referral request, low pressure",
      "Life-event check-in",
      "Refi readiness conversation (educational)",
    ],
  },
  {
    title: "Follow-up",
    examples: [
      "Same-day next-step recap",
      "Three-day buyer follow-up",
      "Seven-day partner follow-up",
      "Stalled file re-engage",
    ],
  },
];

export default async function ScriptsLibraryPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) return null;

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
        title="Scripts Library"
        description="Buyer, partner, recapture, and follow-up scripts in Legends voice. Catalog only in this sprint — scripts ship in a follow-up build."
        action={<span className="chip-off">Catalog only</span>}
      />

      <section className="glass-card-padded">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-ink-50 text-ink-700 dark:border-accent-champagne/25 dark:bg-accent-gold/10 dark:text-accent-champagne">
            <BookOpen size={16} />
          </span>
          <div>
            <p className="label">Why a Scripts Library</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
              Legends scripts are short, repeatable, and never quote a rate,
              payment, fee, or approval. They are tone-references, not
              read-aloud lines. The library lives next to the Academy because
              scripts pair with practice in the Roleplay Lab.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>Planned categories</h2>
          <p>What ships when this library lands.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PLANNED_CATEGORIES.map((category) => (
            <div key={category.title} className="glass-card-padded">
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">
                {category.title}
              </h3>
              <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-ink-700 dark:text-ink-200">
                {category.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Every Legends script is owner-reviewed before it ships. No script
        claims an outcome, quotes a number, or implies approval.
      </p>
    </div>
  );
}
