import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

import { AiAdvantageLibrary } from "@/components/training/AiAdvantageLibrary";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getEffectiveProfile } from "@/lib/impersonation";
import { aiAdvantagePublishedVideos } from "@/lib/legends/aiAdvantageVideos";

export const dynamic = "force-dynamic";

// Jeremy's HeyGen AI Advantage intro (avatar walkthrough). Unlisted embed.
const HEYGEN_AI_INTRO =
  "https://app.heygen.com/embeds/bf6b437acb60464fbe08f6efc73b0335";

export default async function AiAdvantagePage() {
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
      <SectionHeader
        eyebrow="Legends Growth OS · AI"
        title="AI Advantage"
        description="Jeremy's AI training for loan officers — content research, AI twins, client communication, marketing automation, and the apps that make the week faster. Watch, then put one thing to work today."
        action={
          <Link href="/training/academy" className="btn-ghost text-sm">
            <ArrowLeft size={14} /> Academy
          </Link>
        }
      />

      <section className="glass-card-padded overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="label flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-champagne" />
              Start here
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              The AI Advantage, in Jeremy&apos;s voice.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              {aiAdvantagePublishedVideos.length} short lessons across seven
              sections — Foundations, AI Twin Setup, Client Communication,
              Marketing &amp; Content, Content Creation, AI Apps &amp;
              Automation, and Platform &amp; Updates. Every clip is internal and
              unlisted. Use the AI tools to draft and research — you stay the
              reviewer and the human in the loop.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">Internal only</span>
              <span className="chip">Unlisted videos</span>
              <span className="chip">Human-in-the-loop</span>
            </div>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-accent-champagne/20 bg-black">
            <iframe
              src={HEYGEN_AI_INTRO}
              title="Jeremy — AI Advantage intro"
              className="h-full w-full"
              allow="encrypted-media; fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="section-title">
          <h2>Lesson library</h2>
          <p>Search or filter by section, then play any lesson inline.</p>
        </div>
        <AiAdvantageLibrary />
      </section>

      <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        AI Advantage is internal Legends training. Videos are unlisted — do not
        share links outside the team. Nothing here states a rate, fee, or
        approval; AI output is always reviewed by a person before it ships.
      </p>
    </div>
  );
}
