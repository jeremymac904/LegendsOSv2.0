"use client";

import { useCallback, useMemo, useState } from "react";
import { PlayCircle, Search, SearchX, Sparkles, Target } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { currentDayKey, todayDays } from "@/lib/legends/academyContent";
import { masteryWeeks } from "@/lib/legends/coachingProgram";
import {
  useAcademyFeed,
  type FeedPost,
  type NewFeedPostInput,
} from "@/lib/legends/useAcademyStore";
import { useTrainingProgress } from "@/lib/legends/useTrainingProgress";

import { FeedComposer } from "./feed/FeedComposer";
import { FeedLeaderboard } from "./feed/FeedLeaderboard";
import { FeedPostCard, type PostHighlight } from "./feed/FeedPostCard";
import { NextActionStrip } from "./feed/NextActionStrip";
import { dailySortIndex, weeklySortIndex } from "./feed/feedUtils";

// Legends Mortgage Academy team feed. "All" is curated: the pinned welcome
// post, today's daily coaching video, and the current week's video lead the
// stream; the full daily and weekly libraries live behind their own pills so
// 19 coach videos never bury member conversation.

const FILTERS = [
  "All",
  "Announcements",
  "Daily",
  "Weekly",
  "Wins",
  "Questions",
  "Scripts",
  "Coach Picks",
] as const;
type Filter = (typeof FILTERS)[number];

function byNewest(a: FeedPost, b: FeedPost): number {
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

export function AcademyFeed({
  firstName,
  isAdmin,
}: {
  firstName: string;
  isAdmin?: boolean;
}) {
  const {
    hydrated,
    posts,
    toggleLike,
    addComment,
    addPost,
    togglePin,
    deletePost,
    isSeedId,
  } = useAcademyFeed();
  const progress = useTrainingProgress("academy");

  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  // Admin = explicit prop, or inferred: the API stamps owner/admin posts with
  // role "Coach", so a coach's own post marks them. Server enforces regardless.
  const admin =
    isAdmin ?? posts.some((p) => p.mine && p.role === "Coach");

  // First incomplete Academy week — same `academy-w{n}` ids CoachingJourney
  // tracks, so the feed and the roadmap agree on "this week".
  const currentWeek = useMemo(() => {
    if (!progress.hydrated) return 1;
    for (const w of masteryWeeks) {
      if (!progress.isDone(`academy-w${w.week}`)) return w.week;
    }
    return masteryWeeks[masteryWeeks.length - 1]?.week ?? 1;
  }, [progress]);

  const dayKey = currentDayKey();

  // Curated "All" order: welcome → today's daily → this week's weekly →
  // other pinned → everything else newest-first. Off-day daily and off-week
  // weekly coach posts stay out of All (they live in the Daily/Weekly pills).
  const { allOrdered, highlights } = useMemo(() => {
    const welcome = posts.find(
      (p) => p.kind === "coach" && p.refKey === "welcome",
    );
    const daily = posts.find((p) => p.kind === "daily" && p.refKey === dayKey);
    const weekly = posts.find(
      (p) => p.kind === "weekly" && p.refKey === `w${currentWeek}`,
    );

    const lead = [welcome, daily, weekly].filter(
      (p): p is FeedPost => Boolean(p),
    );
    const placed = new Set(lead.map((p) => p.id));

    const otherPinned = posts.filter(
      (p) =>
        !placed.has(p.id) &&
        p.pinned &&
        p.kind !== "daily" &&
        p.kind !== "weekly",
    );
    for (const p of otherPinned) placed.add(p.id);

    const rest = posts
      .filter(
        (p) => !placed.has(p.id) && p.kind !== "daily" && p.kind !== "weekly",
      )
      .sort(byNewest);

    const map = new Map<string, PostHighlight>();
    if (welcome) map.set(welcome.id, { icon: Sparkles, label: "Start here" });
    if (daily) {
      const day = todayDays.find((d) => d.key === dayKey);
      map.set(daily.id, {
        icon: PlayCircle,
        label: day ? `Today's coaching — ${day.day}` : "Today's coaching",
      });
    }
    if (weekly) {
      const theme = masteryWeeks.find((w) => w.week === currentWeek)?.theme;
      map.set(weekly.id, {
        icon: Target,
        label: theme
          ? `This week — Week ${currentWeek}: ${theme}`
          : `This week — Week ${currentWeek}`,
      });
    }

    return {
      allOrdered: [...lead, ...otherPinned, ...rest],
      highlights: map,
    };
  }, [posts, dayKey, currentWeek]);

  // Pill filter, then live title+body search on top of it.
  const visiblePosts = useMemo(() => {
    let list: FeedPost[];
    switch (activeFilter) {
      case "All":
        list = allOrdered;
        break;
      case "Announcements":
        list = posts
          .filter((p) => p.category === "Pinned" || p.kind === "coach")
          .sort(byNewest);
        break;
      case "Daily":
        list = posts
          .filter((p) => p.kind === "daily" || p.category === "Daily")
          .sort((a, b) => dailySortIndex(a) - dailySortIndex(b));
        break;
      case "Weekly":
        list = posts
          .filter((p) => p.kind === "weekly" || p.category === "Weekly")
          .sort((a, b) => weeklySortIndex(a) - weeklySortIndex(b));
        break;
      case "Coach Picks":
        list = posts.filter((p) => p.pinned);
        break;
      default:
        list = posts.filter((p) => p.category === activeFilter).sort(byNewest);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
    );
  }, [activeFilter, allOrdered, posts, query]);

  const handleAddPost = useCallback(
    (input: NewFeedPostInput) => addPost(input),
    [addPost],
  );
  const handleToggleLike = useCallback(
    (id: string) => toggleLike(id, isSeedId(id)),
    [toggleLike, isSeedId],
  );
  const handleAddComment = useCallback(
    (id: string, body: string) => addComment(id, body, isSeedId(id)),
    [addComment, isSeedId],
  );
  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm("Delete this post? This cannot be undone.")) {
        deletePost(id);
      }
    },
    [deletePost],
  );

  if (!hydrated) {
    return (
      <div className="glass-card-padded">
        <p className="text-sm text-ink-500 dark:text-ink-400">Loading feed…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NextActionStrip />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main stream */}
        <div className="min-w-0 space-y-6">
          <FeedComposer
            firstName={firstName}
            isAdmin={admin}
            onSubmit={handleAddPost}
          />

          {/* Filter pills + search */}
          <div className="space-y-3">
            <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  aria-pressed={activeFilter === f}
                  className={activeFilter === f ? "chip-active" : "chip"}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search
                size={14}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 dark:text-ink-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts by title or body…"
                aria-label="Search feed posts"
                className="input pl-9"
              />
            </div>
          </div>

          {/* Posts */}
          {visiblePosts.length === 0 ? (
            <EmptyState
              icon={query.trim() ? SearchX : Sparkles}
              title={
                query.trim() ? "No posts match your search" : "Nothing here yet"
              }
              description={
                query.trim()
                  ? "Try a different search term, or clear it to see the full stream."
                  : "Be the first to share — post a win, a question, or a script that worked."
              }
            />
          ) : (
            <div className="space-y-4">
              {visiblePosts.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  isAdmin={admin}
                  highlight={
                    activeFilter === "All" ? highlights.get(post.id) : undefined
                  }
                  onToggleLike={handleToggleLike}
                  onAddComment={handleAddComment}
                  onTogglePin={togglePin}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="space-y-6 xl:sticky xl:top-6">
          <FeedLeaderboard posts={posts} />
        </aside>
      </div>
    </div>
  );
}
