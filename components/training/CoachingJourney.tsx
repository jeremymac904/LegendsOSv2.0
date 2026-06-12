"use client";

import { useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  Circle,
  Clock3,
  GraduationCap,
  PlayCircle,
  Sparkles,
} from "lucide-react";

import { masteryWeeks, type CoachingWeek } from "@/lib/legends/coachingProgram";
import { getWeekVideo, graduationVideo } from "@/lib/legends/coachingVideos";
import { useTrainingProgress } from "@/lib/legends/useTrainingProgress";
import { HeyGenModal } from "./HeyGenVideo";

// Legends Mortgage Academy — one unified 12-week path (no LO Mastery / Alliance
// tracks, no per-coach toggle). Jeremy McDonald is the sole presenter; per-week
// Jeremy videos arrive via the HeyGen import, so until then each week shows an
// honest "coming soon" rather than a non-Jeremy stand-in.
const weeks: CoachingWeek[] = masteryWeeks;
const weekId = (week: number) => `academy-w${week}`;

function actionItems(week: CoachingWeek): string[] {
  return [
    `Watch the Week ${week.week} Academy video.`,
    `Apply “${week.theme}” to your live pipeline this week.`,
    "Log it in your scorecard and bring one win + one blocker to the call.",
  ];
}

export function CoachingJourney({ firstName }: { firstName: string }) {
  const progress = useTrainingProgress("academy");

  const doneCount = progress.hydrated
    ? weeks.filter((w) => progress.isDone(weekId(w.week))).length
    : 0;
  const pct = Math.round((doneCount / weeks.length) * 100);
  const graduated = doneCount === weeks.length && weeks.length > 0;

  const [selectedWeek, setSelectedWeek] = useState(1);
  const selected = weeks.find((w) => w.week === selectedWeek) ?? weeks[0];
  const selectedDone = progress.hydrated && progress.isDone(weekId(selected.week));
  const [gradOpen, setGradOpen] = useState(false);

  const phases = useMemo(() => {
    const out: { phase: string; weeks: CoachingWeek[] }[] = [];
    for (const w of weeks) {
      const last = out[out.length - 1];
      if (last && last.phase === w.phase) last.weeks.push(w);
      else out.push({ phase: w.phase, weeks: [w] });
    }
    return out;
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome + progress */}
      <section className="glass-card-padded">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="label flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-champagne" /> Welcome back
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              {firstName ? `${firstName}, ` : ""}your Legends Mortgage Academy
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              One 12-week path with Jeremy — structure, follow-up rhythm,
              scripts, trackers, and weekly accountability that turns activity
              into closed loans.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-200/70 dark:bg-ink-800/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-gold to-accent-orange transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-accent-champagne">
            {doneCount}/{weeks.length} weeks · {pct}%
          </span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Roadmap */}
        <section className="space-y-5">
          <div className="section-title">
            <h2>Legends Mortgage Academy roadmap</h2>
            <p>Week 1 to Week 12. Tap a week to open it.</p>
          </div>

          {phases.map((group) => (
            <div key={group.phase} className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-champagne/80">
                {group.phase}
              </p>
              <div className="space-y-2">
                {group.weeks.map((w) => {
                  const done = progress.hydrated && progress.isDone(weekId(w.week));
                  const isSel = selected.week === w.week;
                  return (
                    <button
                      key={w.week}
                      type="button"
                      onClick={() => setSelectedWeek(w.week)}
                      className={
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition " +
                        (isSel
                          ? "border-accent-gold/50 bg-accent-gold/10"
                          : "border-ink-200 bg-ink-50 hover:border-accent-champagne/30 dark:border-accent-champagne/12 dark:bg-ink-950/30")
                      }
                    >
                      <span
                        className={
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold " +
                          (done
                            ? "bg-accent-gold text-ink-950"
                            : "border border-accent-champagne/30 text-ink-500 dark:text-ink-300")
                        }
                      >
                        {done ? <CheckCircle2 size={16} /> : w.week}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                          Week {w.week}
                        </span>
                        <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                          {w.theme}
                        </span>
                      </span>
                      {isSel && (
                        <PlayCircle size={16} className="shrink-0 text-accent-champagne" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Selected week detail + certification */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="glass-card-padded">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-champagne">
              Week {selected.week} · {selected.phase}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-ink-900 dark:text-ink-100">
              {selected.theme}
            </h3>

            {/* Jeremy's per-week coaching video (HeyGen). */}
            {(() => {
              const wv = getWeekVideo(selected.week);
              return wv ? (
                <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-accent-champagne/20 bg-black">
                  <iframe
                    key={wv.heygenVideoId}
                    src={wv.embedUrl}
                    title={`Week ${selected.week} coaching video — Jeremy`}
                    className="h-full w-full"
                    allow="encrypted-media; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="mt-3 flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-accent-champagne/20 bg-ink-950/40 text-center">
                  <Clock3 size={20} className="text-accent-champagne/70" />
                  <p className="text-[11px] text-ink-500">Coming soon</p>
                </div>
              );
            })()}

            <p className="mt-4 label">This week&apos;s action items</p>
            <ul className="mt-2 space-y-2">
              {actionItems(selected).map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-700 dark:text-ink-200"
                >
                  <Circle size={9} className="mt-1.5 shrink-0 text-accent-gold" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => progress.toggleDone(weekId(selected.week))}
              className={"mt-4 w-full " + (selectedDone ? "btn-ghost" : "btn-primary")}
            >
              <CheckCircle2 size={15} />
              {selectedDone ? "Week complete — undo" : "Mark Week complete"}
            </button>
          </div>

          {/* Graduation / completion */}
          <div
            className={
              "rounded-2xl border p-5 text-center transition " +
              (graduated
                ? "border-accent-gold/60 bg-gradient-to-b from-accent-gold/15 to-transparent shadow-glass"
                : "border-accent-champagne/15 bg-ink-950/30")
            }
          >
            <span
              className={
                "mx-auto grid h-12 w-12 place-items-center rounded-full " +
                (graduated && graduationVideo
                  ? "bg-gradient-to-br from-accent-gold to-accent-orange text-ink-950"
                  : "border border-accent-champagne/25 text-accent-champagne")
              }
            >
              {graduated && graduationVideo ? (
                <Award size={24} />
              ) : (
                <GraduationCap size={22} />
              )}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">
              {graduated ? "Legends Mortgage Academy — Completed" : "Graduation path"}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
              {graduated
                ? `Congratulations${firstName ? `, ${firstName}` : ""}! You finished all 12 weeks.`
                : `Complete all 12 weeks to graduate. ${weeks.length - doneCount} to go.`}
            </p>
            {graduated &&
              (graduationVideo ? (
                <button
                  type="button"
                  onClick={() => setGradOpen(true)}
                  className="btn-primary mt-3 w-full text-[12px]"
                >
                  <PlayCircle size={14} /> Watch graduation video
                </button>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent-champagne/25 bg-ink-950/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                  <Clock3 size={12} /> Graduation video — coming soon
                </p>
              ))}
          </div>
        </aside>
      </div>

      {gradOpen && graduationVideo && (
        <HeyGenModal
          embedUrl={graduationVideo.embedUrl}
          title="Graduation"
          subtitle="Legends Mortgage Academy completion"
          onClose={() => setGradOpen(false)}
        />
      )}
    </div>
  );
}
