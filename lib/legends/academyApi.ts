"use client";

// Thin client for the Academy state API. Every call fails soft (returns
// null/false) so the hooks transparently fall back to localStorage when the
// user is offline, unauthenticated, or the API errors.

export interface AcademyRemoteState {
  today: Record<string, { fields: Record<string, string>; savedAt: string }>;
  scorecard: {
    cells: Record<string, number[]>;
    reflection: Record<string, string>;
    submitted?: boolean;
    submittedAt?: string | null;
    reviewed?: boolean;
    coachNote?: string | null;
  };
  progress: { weeksDone: number[]; graduated: boolean };
}

export async function loadAcademyState(): Promise<AcademyRemoteState | null> {
  try {
    const res = await fetch("/api/academy/state", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.ok) return null;
    return {
      today: json.today ?? {},
      scorecard: json.scorecard ?? { cells: {}, reflection: {} },
      progress: json.progress ?? { weeksDone: [], graduated: false },
    };
  } catch {
    return null;
  }
}

async function post(body: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/academy/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function saveTodayRemote(
  dayKey: string,
  fields: Record<string, string>,
  scorecard?: { cells: Record<string, number[]>; reflection: Record<string, string> },
): Promise<boolean> {
  return post({ kind: "today", dayKey, fields, scorecard });
}

export function saveScorecardRemote(
  cells: Record<string, number[]>,
  reflection: Record<string, string>,
): Promise<boolean> {
  return post({ kind: "scorecard", cells, reflection });
}

export function saveProgressRemote(
  weeksDone: number[],
  graduated: boolean,
): Promise<boolean> {
  return post({ kind: "progress", weeksDone, graduated });
}

// Submit the weekly scorecard to the coach for group-call review. Same payload
// as a normal save, plus the submit flag that stamps submitted/submitted_at.
export function submitScorecardRemote(
  cells: Record<string, number[]>,
  reflection: Record<string, string>,
): Promise<boolean> {
  return post({ kind: "scorecard", cells, reflection, submit: true });
}

// ── Feed ─────────────────────────────────────────────────────────────────────
// Cloud feed client. Same soft-fail contract as the state API: null/false on
// any failure so the store falls back to localStorage seeds.

export interface RemoteFeedComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface RemoteFeedPost {
  id: string;
  kind: string;
  refKey: string | null;
  category: string;
  title: string;
  body: string;
  author: string;
  authorId: string | null;
  role: string;
  pinned: boolean;
  embedUrl?: string;
  attachmentUrl?: string;
  comments: RemoteFeedComment[];
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  mine?: boolean;
}

async function postFeed(body: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("/api/academy/feed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown> | null;
    return json?.ok ? json : null;
  } catch {
    return null;
  }
}

export async function loadFeedRemote(): Promise<RemoteFeedPost[] | null> {
  try {
    const res = await fetch("/api/academy/feed", { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.ok || !Array.isArray(json.posts)) return null;
    return json.posts as RemoteFeedPost[];
  } catch {
    return null;
  }
}

export async function createPostRemote(input: {
  category: string;
  title: string;
  body: string;
  embedUrl?: string;
  attachmentUrl?: string;
}): Promise<RemoteFeedPost | null> {
  const json = await postFeed({ action: "post", ...input });
  return (json?.post as RemoteFeedPost | undefined) ?? null;
}

export async function commentRemote(
  postId: string,
  body: string,
): Promise<RemoteFeedComment | null> {
  const json = await postFeed({ action: "comment", postId, body });
  return (json?.comment as RemoteFeedComment | undefined) ?? null;
}

export async function likeRemote(postId: string, like: boolean): Promise<boolean> {
  const json = await postFeed({ action: like ? "like" : "unlike", postId });
  return json !== null;
}

export async function pinRemote(postId: string, pinned: boolean): Promise<boolean> {
  const json = await postFeed({ action: "pin", postId, pinned });
  return json !== null;
}

export async function deletePostRemote(postId: string): Promise<boolean> {
  const json = await postFeed({ action: "delete", postId });
  return json !== null;
}
