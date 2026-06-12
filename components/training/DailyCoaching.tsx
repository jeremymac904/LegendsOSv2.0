"use client";

import { useState } from "react";
import { Check, Clock3, Sparkles } from "lucide-react";

import {
  dayLabel,
  jeremyDailyVideos,
  type CoachingFeedVideo,
} from "@/lib/legends/coachingVideos";
import { useTrainingProgress } from "@/lib/legends/useTrainingProgress";
import { HeyGenModal, HeyGenPoster } from "./HeyGenVideo";

// Jeremy's Daily Coaching — one short Jeremy McDonald video per day. Days whose
// Jeremy video hasn't been imported yet show an honest "coming soon" tile rather
// than a non-Jeremy stand-in.
const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "weekend",
] as const;

export function DailyCoaching() {
  const [active, setActive] = useState<CoachingFeedVideo | null>(null);
  const progress = useTrainingProgress("coaching-daily");
  const bySlot = new Map(jeremyDailyVideos.map((v) => [v.slot, v]));

  function play(v: CoachingFeedVideo) {
    progress.markDone(v.heygenVideoId, true);
    setActive(v);
  }

  return (
    <section className="space-y-3">
      <div className="section-title">
        <h2 className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-accent-champagne" /> Jeremy&apos;s
          daily coaching
        </h2>
        <p>A short coaching video from Jeremy for every day of the week.</p>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin [scroll-snap-type:x_proximity]">
        {DAYS.map((slot) => {
          const v = bySlot.get(slot);
          if (!v) {
            return (
              <div
                key={slot}
                className="flex aspect-video w-[200px] shrink-0 flex-col justify-end rounded-xl border border-dashed border-accent-champagne/15 bg-ink-950/30 p-3 [scroll-snap-align:start] sm:w-[220px]"
              >
                <Clock3 size={16} className="text-ink-500" />
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
                  {dayLabel(slot)}
                </p>
                <p className="text-sm font-medium text-ink-400">Coming soon</p>
              </div>
            );
          }
          const watched = progress.hydrated && progress.isDone(v.heygenVideoId);
          return (
            <div
              key={slot}
              className="relative w-[200px] shrink-0 [scroll-snap-align:start] sm:w-[220px]"
            >
              <HeyGenPoster
                eyebrow={dayLabel(slot)}
                title="Coaching with Jeremy"
                meta={watched ? "Watched" : "Tap to play"}
                onPlay={() => play(v)}
              />
              {watched && (
                <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent-gold px-2 py-0.5 text-[10px] font-semibold text-ink-950">
                  <Check size={11} /> Watched
                </span>
              )}
            </div>
          );
        })}
      </div>

      {active && (
        <HeyGenModal
          embedUrl={active.embedUrl}
          title={`${dayLabel(active.slot)} coaching`}
          subtitle="With Jeremy"
          onClose={() => setActive(null)}
        />
      )}
    </section>
  );
}
