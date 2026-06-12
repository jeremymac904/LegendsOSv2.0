"use client";

import { useCallback, useEffect, useState } from "react";

// Client-side training progress, persisted to localStorage. One hook powers
// "watched" state + "continue watching" across AI Advantage, Coaching, and the
// Academy. It hydrates from storage AFTER mount (guarded by `hydrated`) so the
// server/client first paint always match — no hydration mismatch. There is no
// backend dependency; progress is per-device by design for this phase.

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
