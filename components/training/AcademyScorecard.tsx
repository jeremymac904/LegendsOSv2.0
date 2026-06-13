"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Info,
  MessageSquareText,
  Send,
  Target,
  TrendingUp,
} from "lucide-react";

import { loadAcademyState, submitScorecardRemote } from "@/lib/legends/academyApi";
import { scorecardDays, scorecardMetrics } from "@/lib/legends/academyContent";
import { useAcademyScorecard, type ScoreReflection } from "@/lib/legends/useAcademyStore";

// Legends Mortgage Academy — Weekly Scorecard. An editable Mon..Fri grid that
// rolls daily activity into totals, goal pace, and a weekly reflection. Numeric
// fields logged in Today auto-populate this grid via the shared store.

const REFLECTION_FIELDS: {
  key: keyof ScoreReflection;
  label: string;
  placeholder: string;
  kind: "long" | "text";
}[] = [
  {
    key: "win",
    label: "Biggest win",
    placeholder: "What moved the needle this week?",
    kind: "long",
  },
  {
    key: "obstacle",
    label: "Biggest obstacle",
    placeholder: "What slowed you down or got in the way?",
    kind: "long",
  },
  {
    key: "focus",
    label: "Next week focus",
    placeholder: "The one thing you'll do differently next week.",
    kind: "long",
  },
];

function rowTotal(row: number[] | undefined): number {
  return (row ?? []).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
}

function formatStamp(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso);
  return Number.isFinite(t.getTime()) ? t.toLocaleString() : "";
}

// Coach-review state for this week's scorecard, mirrored from the server.
interface ReviewState {
  submitted: boolean;
  submittedAt: string | null;
  reviewed: boolean;
  coachNote: string | null;
}

export function AcademyScorecard({ firstName }: { firstName: string }) {
  const { hydrated, cells, reflection, setCell, setReflection } = useAcademyScorecard();

  const [review, setReview] = useState<ReviewState>({
    submitted: false,
    submittedAt: null,
    reviewed: false,
    coachNote: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  // Pull submitted/reviewed/coach-note state from the server. Soft-fails to
  // the defaults above when offline or unauthenticated.
  useEffect(() => {
    let alive = true;
    (async () => {
      const remote = await loadAcademyState();
      if (!alive || !remote) return;
      setReview({
        submitted: Boolean(remote.scorecard.submitted),
        submittedAt: remote.scorecard.submittedAt ?? null,
        reviewed: Boolean(remote.scorecard.reviewed),
        coachNote: remote.scorecard.coachNote ?? null,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(false);
    const ok = await submitScorecardRemote(
      cells,
      reflection as unknown as Record<string, string>,
    );
    if (ok) {
      setReview((prev) => ({
        ...prev,
        submitted: true,
        submittedAt: new Date().toISOString(),
      }));
    } else {
      setSubmitError(true);
    }
    setSubmitting(false);
  }

  const rows = useMemo(
    () =>
      scorecardMetrics.map((metric) => {
        const row = cells[metric.key] ?? [0, 0, 0, 0, 0];
        const total = rowTotal(row);
        const pace = metric.goal > 0 ? Math.round((total / metric.goal) * 100) : 0;
        return { ...metric, row, total, pace, hit: total >= metric.goal };
      }),
    [cells],
  );

  const overall = useMemo(() => {
    if (rows.length === 0) return 0;
    const capped = rows.reduce((sum, r) => sum + Math.min(r.pace, 100), 0);
    return Math.round(capped / rows.length);
  }, [rows]);

  const conversations = rows.find((r) => r.key === "real_conversations") ?? rows[0];

  if (!hydrated) {
    return (
      <div className="glass-card-padded">
        <p className="text-sm text-ink-500 dark:text-ink-400">Loading scorecard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <section className="glass-card-padded">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="label flex items-center gap-1.5">
                <TrendingUp size={12} className="text-accent-champagne" /> This week&apos;s pace
              </p>
              {review.submitted && (
                <span className="chip-ok">
                  <CheckCircle2 size={10} /> Submitted
                </span>
              )}
            </div>
            <h2 className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              {firstName ? `${firstName}, ` : ""}you&apos;re at {overall}% of goal
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              Overall completion is the average of every metric&apos;s pace, capped
              at goal. Keep the conversations moving and the rest follows.
            </p>
          </div>
          {conversations && (
            <div className="shrink-0 rounded-2xl border border-accent-champagne/20 bg-ink-50 px-5 py-4 text-center dark:bg-ink-950/40">
              <p className="label">Real conversations</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-accent-champagne">
                {conversations.total}
                <span className="text-base font-medium text-ink-500 dark:text-ink-400">
                  {" "}
                  / {conversations.goal}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                vs weekly goal
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-200/70 dark:bg-ink-800/70">
            <div
              className={
                "h-full rounded-full transition-all duration-500 " +
                (overall >= 100
                  ? "bg-gradient-to-r from-status-ok to-accent-gold"
                  : "bg-gradient-to-r from-accent-gold to-accent-orange")
              }
              style={{ width: `${Math.min(overall, 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-accent-champagne">
            {overall}% complete
          </span>
        </div>
      </section>

      {/* Weekly grid */}
      <section className="glass-card-padded">
        <div className="section-title">
          <h2>Weekly scorecard</h2>
          <p>Log it daily. Watch the pace build.</p>
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-600 dark:text-ink-400">
          <Info size={13} className="mt-0.5 shrink-0 text-accent-champagne" />
          Daily numbers you log in Today roll in here automatically.
        </p>

        <div className="-mx-1 mt-4 overflow-x-auto px-1 scrollbar-thin">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-accent-champagne/20">
                <th className="py-2.5 pr-3 text-left">
                  <span className="label">Metric</span>
                </th>
                {scorecardDays.map((day) => (
                  <th key={day} className="px-2 py-2.5 text-center">
                    <span className="label">{day}</span>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center">
                  <span className="label">Total</span>
                </th>
                <th className="px-2 py-2.5 text-center">
                  <span className="label">Goal</span>
                </th>
                <th className="px-2 py-2.5 text-left">
                  <span className="label">Pace</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((metric) => (
                <tr
                  key={metric.key}
                  className="border-b border-ink-200/70 last:border-b-0 dark:border-accent-champagne/10"
                >
                  <td className="py-2.5 pr-3 font-medium text-ink-900 dark:text-ink-100">
                    {metric.metric}
                  </td>
                  {scorecardDays.map((day, dayIdx) => (
                    <td key={`${metric.key}-${day}`} className="px-2 py-2.5 text-center">
                      <input
                        aria-label={`${metric.metric} ${day}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={metric.row[dayIdx] ?? 0}
                        onChange={(e) =>
                          setCell(metric.key, dayIdx, Number(e.target.value))
                        }
                        className="h-9 w-14 rounded-lg border border-ink-700/80 bg-ink-950/50 px-2 text-center text-sm font-semibold tabular-nums text-ink-100 backdrop-blur-sm focus:border-accent-champagne/60 focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-center font-bold tabular-nums text-ink-900 dark:text-ink-100">
                    {metric.total}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-ink-600 dark:text-ink-400">
                    {metric.goal}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-200/70 dark:bg-ink-800/70">
                        <div
                          className={
                            "h-full rounded-full transition-all duration-300 " +
                            (metric.hit ? "bg-status-ok" : "bg-accent-gold")
                          }
                          style={{ width: `${Math.min(metric.pace, 100)}%` }}
                        />
                      </div>
                      <span
                        className={
                          "text-[11px] font-bold tabular-nums " +
                          (metric.hit ? "text-status-ok" : "text-accent-champagne")
                        }
                      >
                        {metric.pace}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Weekly reflection */}
      <section className="glass-card-padded">
        <div className="section-title">
          <h2>Weekly reflection</h2>
          <p>Close the loop before next week.</p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {REFLECTION_FIELDS.map((field) => (
            <label key={field.key} className="block space-y-2">
              <span className="field-label block">{field.label}</span>
              <textarea
                value={reflection[field.key]}
                onChange={(e) => setReflection(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="textarea min-h-28"
              />
            </label>
          ))}
        </div>

        <label className="mt-4 block space-y-2">
          <span className="field-label flex items-center gap-1.5">
            <Target size={12} className="text-accent-champagne" /> This week&apos;s goal
          </span>
          <input
            type="text"
            value={reflection.goal}
            onChange={(e) => setReflection("goal", e.target.value)}
            placeholder="The headline goal you're holding yourself to this week."
            className="input"
          />
        </label>
      </section>

      {/* Submit to coach */}
      <section className="glass-card-padded">
        <div className="section-title">
          <h2>Submit to coach</h2>
          <p>Your coach reviews submitted scorecards before the weekly group coaching call.</p>
        </div>

        {/* Coach review note — appears once the coach has reviewed the week. */}
        {(review.coachNote || review.reviewed) && (
          <div className="mt-4 rounded-2xl border border-accent-champagne/25 bg-ink-50 p-4 dark:bg-ink-950/30">
            <p className="label flex items-center gap-1.5">
              <MessageSquareText size={12} className="text-accent-champagne" />
              Coach review
            </p>
            {review.coachNote ? (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-700 dark:text-ink-200">
                {review.coachNote}
              </p>
            ) : (
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                Your coach has reviewed this week&apos;s scorecard. Notes will show
                here when added.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {review.submitted ? (
              <p className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-status-ok">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                <span>
                  Submitted — your coach reviews this before the weekly group
                  coaching call.
                  {review.submittedAt && formatStamp(review.submittedAt) && (
                    <span className="text-ink-500 dark:text-ink-400">
                      {" "}
                      ({formatStamp(review.submittedAt)})
                    </span>
                  )}
                </span>
              </p>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                Finish your week, then submit. You can re-submit any time before
                the call if your numbers change.
              </p>
            )}
            {submitError && (
              <p className="mt-1 text-[11px] text-status-err">
                Couldn&apos;t reach the server — your scorecard is still saved on
                this device. Try again in a moment.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary shrink-0 disabled:opacity-50"
          >
            <Send size={15} />
            {submitting
              ? "Submitting…"
              : review.submitted
                ? "Re-submit to coach"
                : "Submit to coach"}
          </button>
        </div>
      </section>
    </div>
  );
}
