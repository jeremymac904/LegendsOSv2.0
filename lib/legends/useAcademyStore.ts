"use client";

import { useCallback, useEffect, useState } from "react";

import {
  feedSeedPosts,
  scorecardMetrics,
  todayDays,
  type SeedPost,
} from "./academyContent";
import {
  loadAcademyState,
  saveScorecardRemote,
  saveTodayRemote,
} from "./academyApi";

// Local-first store for the Academy behavioral modules. Everything persists to
// localStorage (no backend yet), hydrating after mount to avoid SSR mismatch.
// The key cross-module behavior: saving a Today day rolls its numeric fields
// into the weekly Scorecard automatically.

const K_TODAY = "legendsos:academy:today";
const K_SCORE = "legendsos:academy:scorecard";
const K_FEED = "legendsos:academy:feed";

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / disabled — ignore */
  }
}

// Mon..Fri are scorecard columns 0..4; weekend has no column.
const DAY_COL: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
};

// ── Scorecard shapes ─────────────────────────────────────────────────────────
export type ScoreCells = Record<string, number[]>; // metricKey -> [mon..fri]
export interface ScoreReflection {
  win: string;
  obstacle: string;
  focus: string;
  goal: string;
}
interface ScoreState {
  cells: ScoreCells;
  reflection: ScoreReflection;
}
function emptyScore(): ScoreState {
  const cells: ScoreCells = {};
  for (const m of scorecardMetrics) cells[m.key] = [0, 0, 0, 0, 0];
  return { cells, reflection: { win: "", obstacle: "", focus: "", goal: "" } };
}

// ── Today ────────────────────────────────────────────────────────────────────
export type TodayEntry = { fields: Record<string, string>; savedAt: string };
type TodayState = Record<string, TodayEntry>;

export function useAcademyToday() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<TodayState>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const remote = await loadAcademyState();
      if (!alive) return;
      if (remote) {
        setState(remote.today);
        writeLS(K_TODAY, remote.today);
        // Mirror server scorecard locally so the Scorecard page is fresh too.
        writeLS(K_SCORE, {
          cells: remote.scorecard.cells,
          reflection: { ...emptyScore().reflection, ...remote.scorecard.reflection },
        });
      } else {
        setState(readLS<TodayState>(K_TODAY, {}));
      }
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const getDay = useCallback(
    (dayKey: string): TodayEntry | undefined => state[dayKey],
    [state],
  );

  const saveDay = useCallback((dayKey: string, fields: Record<string, string>) => {
    const next: TodayState = {
      ...readLS<TodayState>(K_TODAY, {}),
      [dayKey]: { fields, savedAt: new Date().toISOString() },
    };
    writeLS(K_TODAY, next);
    setState(next);

    // Roll numeric fields tagged with a metric into the weekly scorecard.
    const score = readLS<ScoreState>(K_SCORE, emptyScore());
    const col = DAY_COL[dayKey];
    const day = todayDays.find((d) => d.key === dayKey);
    if (col !== undefined && day) {
      for (const field of day.fields) {
        if (!field.metric || field.kind !== "number") continue;
        const val = Number(fields[field.key]);
        if (!Number.isFinite(val)) continue;
        if (!score.cells[field.metric]) score.cells[field.metric] = [0, 0, 0, 0, 0];
        score.cells[field.metric][col] = val;
      }
      writeLS(K_SCORE, score);
    }

    // Persist to Supabase (best-effort; localStorage already holds the truth).
    void saveTodayRemote(dayKey, fields, {
      cells: score.cells,
      reflection: score.reflection as unknown as Record<string, string>,
    });
  }, []);

  return { hydrated, getDay, saveDay };
}

// ── Scorecard ────────────────────────────────────────────────────────────────
export function useAcademyScorecard() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<ScoreState>(emptyScore());

  useEffect(() => {
    let alive = true;
    (async () => {
      const remote = await loadAcademyState();
      if (!alive) return;
      if (remote) {
        const base = emptyScore();
        const merged: ScoreState = {
          cells: { ...base.cells, ...remote.scorecard.cells },
          reflection: { ...base.reflection, ...remote.scorecard.reflection },
        };
        setState(merged);
        writeLS(K_SCORE, merged);
      } else {
        setState(readLS<ScoreState>(K_SCORE, emptyScore()));
      }
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setCell = useCallback((metricKey: string, dayIdx: number, value: number) => {
    setState((prev) => {
      const cells = { ...prev.cells };
      const row = [...(cells[metricKey] ?? [0, 0, 0, 0, 0])];
      row[dayIdx] = Number.isFinite(value) ? value : 0;
      cells[metricKey] = row;
      const next = { ...prev, cells };
      writeLS(K_SCORE, next);
      void saveScorecardRemote(next.cells, next.reflection as unknown as Record<string, string>);
      return next;
    });
  }, []);

  const setReflection = useCallback((key: keyof ScoreReflection, value: string) => {
    setState((prev) => {
      const next = { ...prev, reflection: { ...prev.reflection, [key]: value } };
      writeLS(K_SCORE, next);
      void saveScorecardRemote(next.cells, next.reflection as unknown as Record<string, string>);
      return next;
    });
  }, []);

  return { hydrated, cells: state.cells, reflection: state.reflection, setCell, setReflection };
}

// ── Feed ─────────────────────────────────────────────────────────────────────
export interface FeedComment {
  author: string;
  body: string;
}
export interface FeedPost {
  id: string;
  author: string;
  role: string;
  category: SeedPost["category"];
  title: string;
  body: string;
  pinned?: boolean;
  videoEmbedUrl?: string;
  comments: FeedComment[];
  likes: number;
  liked?: boolean;
  createdAt?: string;
}
interface FeedState {
  userPosts: FeedPost[];
  liked: Record<string, boolean>;
  extraComments: Record<string, FeedComment[]>;
  extraLikes: Record<string, number>;
}
function emptyFeed(): FeedState {
  return { userPosts: [], liked: {}, extraComments: {}, extraLikes: {} };
}

export function useAcademyFeed() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<FeedState>(emptyFeed());

  useEffect(() => {
    setState(readLS<FeedState>(K_FEED, emptyFeed()));
    setHydrated(true);
  }, []);

  const persist = (next: FeedState) => {
    writeLS(K_FEED, next);
    setState(next);
  };

  const posts: FeedPost[] = (() => {
    const seeds: FeedPost[] = feedSeedPosts.map((p) => ({
      ...p,
      likes: p.likes + (state.extraLikes[p.id] ?? 0),
      liked: Boolean(state.liked[p.id]),
      comments: [...p.comments, ...(state.extraComments[p.id] ?? [])],
    }));
    const user = state.userPosts.map((p) => ({
      ...p,
      liked: Boolean(state.liked[p.id]),
    }));
    // user posts first (newest), then pinned seeds, then the rest
    const pinned = seeds.filter((p) => p.pinned);
    const rest = seeds.filter((p) => !p.pinned);
    return [...pinned, ...user, ...rest];
  })();

  const toggleLike = useCallback((id: string, isSeed: boolean) => {
    setState((prev) => {
      const liked = { ...prev.liked, [id]: !prev.liked[id] };
      const delta = liked[id] ? 1 : -1;
      const next: FeedState = isSeed
        ? { ...prev, liked, extraLikes: { ...prev.extraLikes, [id]: (prev.extraLikes[id] ?? 0) + delta } }
        : {
            ...prev,
            liked,
            userPosts: prev.userPosts.map((p) =>
              p.id === id ? { ...p, likes: Math.max(0, p.likes + delta) } : p,
            ),
          };
      writeLS(K_FEED, next);
      return next;
    });
  }, []);

  const addComment = useCallback((id: string, body: string, isSeed: boolean) => {
    const comment: FeedComment = { author: "You", body };
    setState((prev) => {
      const next: FeedState = isSeed
        ? { ...prev, extraComments: { ...prev.extraComments, [id]: [...(prev.extraComments[id] ?? []), comment] } }
        : {
            ...prev,
            userPosts: prev.userPosts.map((p) =>
              p.id === id ? { ...p, comments: [...p.comments, comment] } : p,
            ),
          };
      writeLS(K_FEED, next);
      return next;
    });
  }, []);

  const addPost = useCallback(
    (post: Omit<FeedPost, "id" | "likes" | "comments" | "createdAt">) => {
      const full: FeedPost = {
        ...post,
        id: `user-${Date.now()}-${Math.round(performance.now())}`,
        likes: 0,
        comments: [],
        createdAt: new Date().toISOString(),
      };
      persist({ ...state, userPosts: [full, ...state.userPosts] });
    },
    [state],
  );

  const isSeedId = (id: string) => feedSeedPosts.some((p) => p.id === id);

  return { hydrated, posts, toggleLike, addComment, addPost, isSeedId };
}
