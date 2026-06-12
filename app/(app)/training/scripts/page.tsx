import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

import { ScriptCard, type ScriptItem } from "@/components/training/ScriptCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getEffectiveProfile } from "@/lib/impersonation";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const REAL_SCRIPTS: ScriptItem[] = [
  {
    category: "Buyer Conversation",
    title: "First-call opener",
    body: "Hi {{first_name}}, I'm calling from The Legends Mortgage Team. I saw you were looking at home options. Most people call a lender to ask for a rate, but at Legends, we start with your goals and timeline first. Before we talk numbers, what are you hoping to accomplish with this move?",
  },
  {
    category: "Buyer Conversation",
    title: "Handling the 'What's your rate?' question",
    body: "That's a great question, and I'd love to give you an accurate answer. However, quoting a rate without knowing your full scenario—like your goals, timeline, and how long you plan to keep the home—is just guesswork. My job at Legends is to give you a strategy, not just a number. Can we spend 5 minutes mapping out your scenario so I can give you a real answer later?",
  },
  {
    category: "Realtor Partner",
    title: "Co-marketing introduction",
    body: "Hi {{agent_name}}, I've been following your listings and love the way you present properties. At Legends, we focus on buyer education and co-marketing to help agents like you build deeper trust with clients. I'm putting together a buyer workshop on affordability and preparation—would you be open to co-hosting or just reviewing the material to see if it fits your brand?",
  },
  {
    category: "Past Client",
    title: "Annual review touchpoint",
    body: "Hi {{first_name}}, it's been a year since we closed on your home! At Legends, we don't just close loans; we manage your mortgage as part of your overall financial picture. I'd love to do a quick 10-minute review of your current equity and see if your goals for the property have changed. Do you have a few minutes this week?",
  },
];

export default async function ScriptsLibraryPage() {
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
        title="Scripts Library"
        description="Buyer, partner, recapture, and follow-up scripts in Legends voice. Every script is a tone-reference, never a read-aloud line."
        action={<span className="chip-active">Scripts Available</span>}
      />

      <section className="glass-card-padded">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-accent-champagne/25 bg-ink-950/40 text-accent-champagne dark:bg-ink-950/40">
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
          <h2>Available Scripts</h2>
          <p>Internal only. Use these as a starting point for your own voice.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {REAL_SCRIPTS.map((script) => (
            <ScriptCard key={script.title} script={script} />
          ))}
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Every Legends script is owner-reviewed. No script
        claims an outcome, quotes a number, or implies approval.
      </p>
    </div>
  );
}
