"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadAcademyState, saveProgressRemote } from "./academyApi";

// Client-side training progress, persisted to localStorage. One hook powers
// "watched" state + "continue watching" across AI Advantage, Coaching, and the
// Academy. It hydrates from storage AFTER mount (guarded by `hydrated`) so the
// server/client first paint always match — no hydration mismatch. The base
// hook has no backend dependency; the Academy journey wrapper below adds
// soft-fail Supabase sync for week completion + graduation.

export interface TrainingProgressState {
  /** ids the user has marked complete / watched */
  done: string[];
  /** id -> last-touched ISO timestamp (powers "continue watching") */
  touched: Record<string, string>;
}

const EMPTY: TrainingProgressState = { done: [], touched: {} };

export function useTrainingProgress(namespace: string) {
  const key = `legendsos:progress:${namespace}`;
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<TrainingProgressState>(EMPTY);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw) as Partial<TrainingProgressState>;
        setState({
          done: Array.isArray(p.done) ? p.done : [],
          touched:
            p.touched && typeof p.touched === "object" ? p.touched : {},
        });
      }
    } catch {
      /* corrupt or unavailable storage — start fresh */
    }
    setHydrated(true);
  }, [key]);

  const update = useCallback(
    (fn: (prev: TrainingProgressState) => TrainingProgressState) => {
      setState((prev) => {
        const next = fn(prev);
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore quota / private-mode failures */
        }
        return next;
      });
    },
    [key],
  );

  const isDone = useCallback((id: string) => state.done.includes(id), [state.done]);

  const markDone = useCallback(
    (id: string, done = true) =>
      update((prev) => {
        const set = new Set(prev.done);
        if (done) set.add(id);
        else set.delete(id);
        return {
          done: [...set],
          touched: { ...prev.touched, [id]: new Date().toISOString() },
        };
      }),
    [update],
  );

  const toggleDone = useCallback(
    (id: string) =>
      update((prev) => {
        const set = new Set(prev.done);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        return {
          done: [...set],
          touched: { ...prev.touched, [id]: new Date().toISOString() },
        };
      }),
    [update],
  );

  /** Record interaction without marking complete (e.g. opened the player). */
  const touch = useCallback(
    (id: string) =>
      update((prev) => ({
        done: prev.done,
        touched: { ...prev.touched, [id]: new Date().toISOString() },
      })),
    [update],
  );

  const reset = useCallback(() => update(() => EMPTY), [update]);

  return {
    hydrated,
    done: state.done,
    touched: state.touched,
    isDone,
    markDone,
    toggleDone,
    touch,
    reset,
  };
}

// ── Academy 12-week journey ──────────────────────────────────────────────────
// Journey-specific wrapper over the "academy" namespace. Two id families share
// one localStorage bucket:
//   • week completion  → "academy-w3"
//   • week assignments → "academy-w3-a1" (per-action checklist booleans)
// Assignments stay device-local; week completion + graduation additionally
// sync to Supabase (academy_progress) through the soft-fail academyApi client,
// so the roadmap follows the loan officer across devices.

export const academyWeekId = (week: number) => `academy-w${week}`;
export const academyAssignmentId = (week: number, index: number) =>
  `academy-w${week}-a${index}`;

const WEEK_ID_RE = /^academy-w(\d+)$/;

interface RemoteJourneyProgress {
  weeksDone: number[];
  graduated: boolean;
}

export function useAcademyJourneyProgress(totalWeeks: number) {
  const base = useTrainingProgress("academy");
  const [remote, setRemote] = useState<RemoteJourneyProgress | null>(null);
  const [remoteChecked, setRemoteChecked] = useState(false);
  const mergedOnce = useRef(false);

  // Fetch cloud progress once (soft-fail: null offline/unauthenticated).
  useEffect(() => {
    let alive = true;
    void (async () => {
      const state = await loadAcademyState();
      if (!alive) return;
      setRemote(state?.progress ?? null);
      setRemoteChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const weeksDone = useMemo(() => {
    const out: number[] = [];
    for (const id of base.done) {
      const m = WEEK_ID_RE.exec(id);
      if (m) out.push(Number(m[1]));
    }
    return out.sort((a, b) => a - b);
  }, [base.done]);

  // Ref mirror so callbacks never close over a stale weeksDone array.
  const weeksDoneRef = useRef(weeksDone);
  useEffect(() => {
    weeksDoneRef.current = weeksDone;
  }, [weeksDone]);

  const { hydrated, isDone, markDone } = base;

  // Merge cloud → local once both sides are ready, then push the union back up
  // if this device knew about weeks the cloud didn't. Neither side loses work.
  useEffect(() => {
    if (!hydrated || !remoteChecked || mergedOnce.current) return;
    mergedOnce.current = true;
    if (!remote) return;
    const union = new Set(weeksDoneRef.current);
    for (const w of remote.weeksDone) {
      union.add(w);
      if (!isDone(academyWeekId(w))) markDone(academyWeekId(w), true);
    }
    if (union.size > remote.weeksDone.length) {
      const next = [...union].sort((a, b) => a - b);
      void saveProgressRemote(next, totalWeeks > 0 && next.length >= totalWeeks);
    }
  }, [hydrated, remoteChecked, remote, isDone, markDone, totalWeeks]);

  const isWeekDone = useCallback(
    (week: number) => isDone(academyWeekId(week)),
    [isDone],
  );

  /** Mark a week complete/incomplete locally AND sync weeksDone/graduated to Supabase. */
  const setWeekDone = useCallback(
    (week: number, done: boolean) => {
      markDone(academyWeekId(week), done);
      const set = new Set(weeksDoneRef.current);
      if (done) set.add(week);
      else set.delete(week);
      const next = [...set].sort((a, b) => a - b);
      void saveProgressRemote(next, totalWeeks > 0 && next.length >= totalWeeks);
    },
    [markDone, totalWeeks],
  );

  const toggleWeekDone = useCallback(
    (week: number) => setWeekDone(week, !isDone(academyWeekId(week))),
    [setWeekDone, isDone],
  );

  const isAssignmentDone = useCallback(
    (week: number, index: number) => isDone(academyAssignmentId(week, index)),
    [isDone],
  );

  const toggleAssignment = useCallback(
    (week: number, index: number) => base.toggleDone(academyAssignmentId(week, index)),
    [base],
  );

  const doneCount = weeksDone.length;
  const graduated = totalWeeks > 0 && doneCount >= totalWeeks;

  return {
    /** localStorage hydration guard — render zero-progress until true. */
    hydrated,
    /** sorted week numbers marked complete */
    weeksDone,
    doneCount,
    graduated,
    isWeekDone,
    setWeekDone,
    toggleWeekDone,
    isAssignmentDone,
    toggleAssignment,
  };
}
