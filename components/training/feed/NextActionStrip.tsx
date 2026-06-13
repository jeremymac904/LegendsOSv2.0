"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, ListChecks } from "lucide-react";

import { currentDayKey, todayDays } from "@/lib/legends/academyContent";

// Slim "what do I do next" strip for the Academy feed. The feed is where the
// team reads — Today and the Scorecard are where the work gets logged, so both
// are always one click away. Friday flips the emphasis to submitting the week.

export function NextActionStrip() {
  const dayKey = currentDayKey();
  const day = todayDays.find((d) => d.key === dayKey);
  const isFriday = dayKey === "friday";

  return (
    <div className="glass-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="label">Next up</span>
      <Link
        href="/training/today"
        className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-700 transition hover:text-accent-champagne dark:text-ink-200"
      >
        <CalendarCheck size={14} className="text-accent-champagne" />
        {day ? `Log ${day.day} — ${day.theme}` : "Log today's work"}
        <ArrowRight
          size={13}
          className="transition group-hover:translate-x-0.5"
        />
      </Link>
      <span
        aria-hidden
        className="hidden h-4 w-px bg-accent-champagne/20 sm:block"
      />
      <Link
        href="/training/scorecard"
        className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-700 transition hover:text-accent-champagne dark:text-ink-200"
      >
        <ListChecks size={14} className="text-accent-gold" />
        {isFriday ? "Submit your weekly scorecard" : "Update your scorecard"}
        <ArrowRight
          size={13}
          className="transition group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  );
}
