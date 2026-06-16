import Link from "next/link";
import { ArrowRight, Lightbulb, Radar } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Confidence, Recommendation } from "@/lib/chiefOfStaff/types";

// Confidence → chip tone. High is a warm gold accent (act now), Medium neutral,
// Low muted. This is the only place confidence styling is decided.
const CONFIDENCE_CHIP: Record<Confidence, string> = {
  High: "chip-warn",
  Medium: "chip-info",
  Low: "chip-off",
};

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <article className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-100">
          {rec.title}
        </p>
        <span
          className={cn(CONFIDENCE_CHIP[rec.confidence], "shrink-0")}
          title={`${rec.confidence} confidence`}
        >
          {rec.confidence}
        </span>
      </div>

      <p className="text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
        {rec.whyItMatters}
      </p>

      <div className="flex items-start gap-2 rounded-lg border border-accent-gold/20 bg-accent-gold/5 px-3 py-2">
        <Lightbulb size={14} className="mt-0.5 shrink-0 text-accent-gold" />
        <p className="text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
          <span className="font-medium text-ink-800 dark:text-ink-100">
            Next:
          </span>{" "}
          {rec.suggestedAction}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <span
          className="inline-flex items-center gap-1.5 text-[10.5px] text-ink-500 dark:text-ink-400"
          title="The exact signal that surfaced this recommendation"
        >
          <Radar size={11} className="shrink-0" />
          {rec.sourceSignal}
        </span>
        {rec.href && (
          <Link href={rec.href} className="btn-ghost text-[11px]">
            {rec.hrefLabel ?? "Open"}
            <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </article>
  );
}
