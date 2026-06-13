"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { feedSeedPosts, scorecardMetrics, todayDays } from "./academyContent";
import {
  commentRemote,
  createPostRemote,
  deletePostRemote,
  likeRemote,
  loadAcademyState,
  loadFeedRemote,
  pinRemote,
  saveScorecardRemote,
  saveTodayRemote,
  type RemoteFeedPost,
} from "./academyApi";

// Cloud-primary store for the Academy behavioral modules. Hooks hydrate from
// Supabase after mount (avoiding SSR mismatch) and fall back to localStorage
// when offline or unauthenticated. The key cross-module behavior: saving a
// Today day rolls its numeric fields into the weekly Scorecard automatically.

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
// Cloud-primary: hydrate from /api/academy/feed (seeded coach posts + member
// posts), optimistic local updates with background sync, and a localStorage
// seed fallback when the API is unreachable.

export interface FeedComment {
  id?: string;
  author: string;
  body: string;
  createdAt?: string;
}
export interface FeedPost {
  id: string;
  /** "member" for LO posts; "coach" | "daily" | "weekly" for seeded coach rows. */
  kind: string;
  refKey?: string | null;
  author: string;
  role: string;
  category: string;
  title: string;
  body: string;
  pinned?: boolean;
  /** Legacy name kept for existing UI; `embedUrl` mirrors it. */
  videoEmbedUrl?: string;
  embedUrl?: string;
  attachmentUrl?: string;
  comments: FeedComment[];
  /** Legacy name kept for existing UI; `likeCount` mirrors it. */
  likes: number;
  likeCount: number;
  /** Legacy name kept for existing UI; `likedByMe` mirrors it. */
  liked?: boolean;
  likedByMe: boolean;
  createdAt?: string;
  /** True when the current user authored the post (cloud mode only). */
  mine?: boolean;
}
export interface NewFeedPostInput {
  author?: string;
  role?: string;
  category: string;
  title: string;
  body: string;
  pinned?: boolean;
  videoEmbedUrl?: string;
  attachmentUrl?: string;
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

function fromRemotePost(p: RemoteFeedPost): FeedPost {
  return {
    id: p.id,
    kind: p.kind || "member",
    refKey: p.refKey ?? null,
    author: p.author,
    role: p.role,
    category: p.category,
    title: p.title,
    body: p.body,
    pinned: p.pinned,
    videoEmbedUrl: p.embedUrl,
    embedUrl: p.embedUrl,
    attachmentUrl: p.attachmentUrl,
    comments: p.comments.map((c) => ({
      id: c.id,
      author: c.author,
      body: c.body,
      createdAt: c.createdAt,
    })),
    likes: p.likeCount,
    likeCount: p.likeCount,
    liked: p.likedByMe,
    likedByMe: p.likedByMe,
    createdAt: p.createdAt,
    mine: p.mine,
  };
}

// Pinned first, then newest first. Seeds without timestamps keep server order.
function sortFeed(list: FeedPost[]): FeedPost[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}

// Old localStorage rows predate kind/likeCount/likedByMe — fill the gaps.
function normalizeStoredPost(p: Partial<FeedPost> & { id: string }): FeedPost {
  const likes = p.likes ?? p.likeCount ?? 0;
  const liked = Boolean(p.liked ?? p.likedByMe);
  return {
    id: p.id,
    kind: p.kind ?? "member",
    refKey: p.refKey ?? null,
    author: p.author ?? "You",
    role: p.role ?? "Loan Officer",
    category: p.category ?? "Wins",
    title: p.title ?? "",
    body: p.body ?? "",
    pinned: p.pinned,
    videoEmbedUrl: p.videoEmbedUrl ?? p.embedUrl,
    embedUrl: p.embedUrl ?? p.videoEmbedUrl,
    attachmentUrl: p.attachmentUrl,
    comments: p.comments ?? [],
    likes,
    likeCount: likes,
    liked,
    likedByMe: liked,
    createdAt: p.createdAt,
    mine: p.kind === undefined || p.kind === "member" ? true : p.mine,
  };
}

// Offline fallback: static Academy seeds merged with locally-saved activity.
function legacyFeedPosts(state: FeedState): FeedPost[] {
  const seeds: FeedPost[] = feedSeedPosts.map((p) => {
    const likes = p.likes + (state.extraLikes[p.id] ?? 0);
    const liked = Boolean(state.liked[p.id]);
    return {
      id: p.id,
      kind: p.role === "Coach" ? "coach" : "member",
      refKey: null,
      author: p.author,
      role: p.role,
      category: p.category,
      title: p.title,
      body: p.body,
      pinned: p.pinned,
      videoEmbedUrl: p.videoEmbedUrl,
      embedUrl: p.videoEmbedUrl,
      comments: [...p.comments, ...(state.extraComments[p.id] ?? [])],
      likes,
      likeCount: likes,
      liked,
      likedByMe: liked,
    };
  });
  const user = state.userPosts.map((p) =>
    normalizeStoredPost({ ...p, liked: Boolean(state.liked[p.id] ?? p.liked) }),
  );
  // user posts first (newest), then pinned seeds, then the rest
  const pinned = seeds.filter((p) => p.pinned);
  const rest = seeds.filter((p) => !p.pinned);
  return [...pinned, ...user, ...rest];
}

function mutateLegacyFeed(fn: (prev: FeedState) => FeedState) {
  writeLS(K_FEED, fn(readLS<FeedState>(K_FEED, emptyFeed())));
}

export function useAcademyFeed() {
  const [hydrated, setHydrated] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  // "cloud" once the API hydrates; "local" keeps the localStorage fallback.
  const modeRef = useRef<"cloud" | "local">("local");

  const refresh = useCallback(async (): Promise<boolean> => {
    const remote = await loadFeedRemote();
    if (!remote) return false;
    modeRef.current = "cloud";
    setPosts(sortFeed(remote.map(fromRemotePost)));
    return true;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const remote = await loadFeedRemote();
      if (!alive) return;
      if (remote) {
        modeRef.current = "cloud";
        setPosts(sortFeed(remote.map(fromRemotePost)));
      } else {
        modeRef.current = "local";
        setPosts(legacyFeedPosts(readLS<FeedState>(K_FEED, emptyFeed())));
      }
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const addPost = useCallback((input: NewFeedPostInput) => {
    const tempId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: FeedPost = {
      id: tempId,
      kind: "member",
      refKey: null,
      author: input.author?.trim() || "You",
      role: input.role?.trim() || "Loan Officer",
      category: input.category,
      title: input.title,
      body: input.body,
      pinned: input.pinned ?? false,
      videoEmbedUrl: input.videoEmbedUrl,
      embedUrl: input.videoEmbedUrl,
      attachmentUrl: input.attachmentUrl,
      comments: [],
      likes: 0,
      likeCount: 0,
      liked: false,
      likedByMe: false,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    setPosts((prev) => sortFeed([optimistic, ...prev]));
    void (async () => {
      const saved = await createPostRemote({
        category: input.category,
        title: input.title,
        body: input.body,
        embedUrl: input.videoEmbedUrl,
        attachmentUrl: input.attachmentUrl,
      });
      if (saved) {
        setPosts((prev) =>
          sortFeed(prev.map((p) => (p.id === tempId ? fromRemotePost(saved) : p))),
        );
      } else {
        // Offline / unauthenticated — keep it locally so it survives reloads.
        mutateLegacyFeed((prev) => ({
          ...prev,
          userPosts: [optimistic, ...prev.userPosts],
        }));
      }
    })();
  }, []);

  const addComment = useCallback((id: string, body: string, _isSeed?: boolean) => {
    const optimistic: FeedComment = {
      author: "You",
      body,
      createdAt: new Date().toISOString(),
    };
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comments: [...p.comments, optimistic] } : p)),
    );
    void (async () => {
      const saved = await commentRemote(id, body);
      if (saved) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, comments: p.comments.map((c) => (c === optimistic ? saved : c)) }
              : p,
          ),
        );
      } else {
        const isSeed = feedSeedPosts.some((s) => s.id === id);
        mutateLegacyFeed((prev) =>
          isSeed
            ? {
                ...prev,
                extraComments: {
                  ...prev.extraComments,
                  [id]: [...(prev.extraComments[id] ?? []), optimistic],
                },
              }
            : {
                ...prev,
                userPosts: prev.userPosts.map((p) =>
                  p.id === id ? { ...p, comments: [...p.comments, optimistic] } : p,
                ),
              },
        );
      }
    })();
  }, []);

  const toggleLike = useCallback(
    (id: string, _isSeed?: boolean) => {
      const target = posts.find((p) => p.id === id);
      if (!target) return;
      const nextLiked = !target.likedByMe;
      const nextCount = Math.max(0, target.likeCount + (nextLiked ? 1 : -1));
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, liked: nextLiked, likedByMe: nextLiked, likes: nextCount, likeCount: nextCount }
            : p,
        ),
      );
      void (async () => {
        const ok = await likeRemote(id, nextLiked);
        if (!ok && modeRef.current === "local") {
          const delta = nextLiked ? 1 : -1;
          const isSeed = feedSeedPosts.some((s) => s.id === id);
          mutateLegacyFeed((prev) => {
            const liked = { ...prev.liked, [id]: nextLiked };
            return isSeed
              ? {
                  ...prev,
                  liked,
                  extraLikes: { ...prev.extraLikes, [id]: (prev.extraLikes[id] ?? 0) + delta },
                }
              : {
                  ...prev,
                  liked,
                  userPosts: prev.userPosts.map((p) =>
                    p.id === id
                      ? { ...p, likes: Math.max(0, p.likes + delta), likeCount: Math.max(0, p.likes + delta) }
                      : p,
                  ),
                };
          });
        }
      })();
    },
    [posts],
  );

  // Admin/owner only — the API enforces the role; optimistic flip here.
  const togglePin = useCallback((id: string, pinned: boolean) => {
    setPosts((prev) => sortFeed(prev.map((p) => (p.id === id ? { ...p, pinned } : p))));
    void pinRemote(id, pinned);
  }, []);

  // Own post or admin — the API enforces ownership; optimistic removal here.
  const deletePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    void (async () => {
      const ok = await deletePostRemote(id);
      if (!ok && modeRef.current === "local") {
        mutateLegacyFeed((prev) => ({
          ...prev,
          userPosts: prev.userPosts.filter((p) => p.id !== id),
        }));
      }
    })();
  }, []);

  const search = useCallback(
    (term: string): FeedPost[] => {
      const q = term.trim().toLowerCase();
      if (!q) return posts;
      return posts.filter((p) =>
        [p.title, p.body, p.author, p.category].some((s) => s?.toLowerCase().includes(q)),
      );
    },
    [posts],
  );

  // Backward-compatible helper: coach/seeded rows are "seed" posts.
  const isSeedId = useCallback(
    (id: string) => {
      const p = posts.find((x) => x.id === id);
      if (p) return p.kind !== "member";
      return feedSeedPosts.some((s) => s.id === id);
    },
    [posts],
  );

  return {
    hydrated,
    posts,
    addPost,
    addComment,
    toggleLike,
    togglePin,
    deletePost,
    search,
    refresh,
    isSeedId,
  };
}
