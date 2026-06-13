// Shared helpers for the Legends Mortgage Academy feed UI — URL normalization
// for video embeds, attachment detection, relative timestamps, coach-post
// ordering (weekday + week number), and the monthly contributor leaderboard.

import type { FeedComment, FeedPost } from "@/lib/legends/useAcademyStore";

// ── Coach post ordering ──────────────────────────────────────────────────────

/** Weekday order for daily coach posts (ref_key monday..weekend). */
export const DAY_ORDER: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  weekend: 5,
};

export function dailySortIndex(post: FeedPost): number {
  const idx = DAY_ORDER[post.refKey ?? ""];
  return idx === undefined ? 99 : idx;
}

/** Parse "w1".."w12" → 1..12; null for anything else. */
export function weekNumberFromRefKey(refKey?: string | null): number | null {
  const m = /^w(\d{1,2})$/.exec(refKey ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function weeklySortIndex(post: FeedPost): number {
  return weekNumberFromRefKey(post.refKey) ?? 99;
}

// ── Video URLs ───────────────────────────────────────────────────────────────

/**
 * Normalize a pasted video link to an embeddable iframe URL.
 * Supports YouTube (watch / youtu.be / shorts / live / embed) and HeyGen
 * (embeds pass through; share pages map to the embed). Returns null when the
 * link is not a known embeddable video — callers should fall back to a link
 * card instead of rendering a broken iframe.
 */
export function toEmbedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    const path = /^\/(shorts|embed|live)\/([\w-]{6,})/.exec(url.pathname);
    return path ? `https://www.youtube.com/embed/${path[2]}` : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "app.heygen.com") {
    if (url.pathname.startsWith("/embeds/")) return trimmed;
    const share = /^\/videos\/([\w-]+)/.exec(url.pathname);
    return share ? `https://app.heygen.com/embeds/${share[1]}` : null;
  }
  return null;
}

/** True when the URL is one of our two trusted iframe sources. */
export function isEmbeddableVideoUrl(url?: string): url is string {
  if (!url) return false;
  return (
    url.startsWith("https://www.youtube.com/embed/") ||
    url.startsWith("https://app.heygen.com/embeds/")
  );
}

// ── Attachments ──────────────────────────────────────────────────────────────

export function isImageUrl(url?: string): url is string {
  if (!url) return false;
  try {
    const { pathname } = new URL(url);
    return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(pathname);
  } catch {
    return false;
  }
}

export function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ── Time ─────────────────────────────────────────────────────────────────────

export function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export interface ContributorRow {
  name: string;
  posts: number;
  comments: number;
  score: number;
}

function inMonth(iso: string | undefined, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

/**
 * Top contributors this calendar month. Member posts weigh 3, comments weigh 1
 * — posting starts conversations; commenting keeps them alive. Seeded coach
 * rows (kind daily/weekly/coach) are excluded from post counts so the program
 * content doesn't drown out real member activity.
 */
export function topContributors(
  posts: FeedPost[],
  now = new Date(),
  limit = 5,
): ContributorRow[] {
  const rows = new Map<string, ContributorRow>();
  const bump = (name: string, kind: "post" | "comment") => {
    const key = name.trim();
    if (!key) return;
    const row =
      rows.get(key) ?? { name: key, posts: 0, comments: 0, score: 0 };
    if (kind === "post") {
      row.posts += 1;
      row.score += 3;
    } else {
      row.comments += 1;
      row.score += 1;
    }
    rows.set(key, row);
  };

  for (const post of posts) {
    if (post.kind === "member" && inMonth(post.createdAt, now)) {
      bump(post.author, "post");
    }
    for (const comment of post.comments as FeedComment[]) {
      if (inMonth(comment.createdAt, now)) bump(comment.author, "comment");
    }
  }

  return [...rows.values()]
    .sort((a, b) => b.score - a.score || b.posts - a.posts || a.name.localeCompare(b.name))
    .slice(0, limit);
}
