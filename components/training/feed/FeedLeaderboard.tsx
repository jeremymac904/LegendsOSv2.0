"use client";

import { useMemo } from "react";
import { MessageCircle, Newspaper, Trophy } from "lucide-react";

import type { FeedPost } from "@/lib/legends/useAcademyStore";
import { topContributors } from "./feedUtils";

// Monthly contributor leaderboard for the Academy feed side panel. Computed
// live from the posts already in the feed — member posts (x3) + comments (x1)
// inside the current calendar month. No coach seed rows, no fabricated rows.

const RANK_STYLE: string[] = [
  "border-accent-gold/60 bg-accent-gold/15 text-accent-gold",
  "border-accent-champagne/40 bg-accent-champagne/10 text-accent-champagne",
  "border-accent-bronze/40 bg-accent-bronze/10 text-accent-bronze",
];

export function FeedLeaderboard({ posts }: { posts: FeedPost[] }) {
  const rows = useMemo(() => topContributors(posts), [posts]);
  const month = useMemo(
    () => new Date().toLocaleDateString(undefined, { month: "long" }),
    [],
  );

  return (
    <section className="glass-card-padded space-y-4">
      <div className="section-title">
        <h2 className="flex items-center gap-1.5">
          <Trophy size={14} className="text-accent-gold" /> Leaderboard
        </h2>
      </div>
      <p className="text-[12px] text-ink-500 dark:text-ink-400">
        Top contributors in {month} — posts and comments in the team feed.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-accent-champagne/15 bg-ink-950/30 px-3 py-4 text-center text-[12.5px] text-ink-500 dark:text-ink-400">
          No member activity yet this month. Post a win to open the board.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={row.name}
              className="glass-panel flex items-center gap-3 px-3 py-2"
            >
              <span
                className={
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold " +
                  (RANK_STYLE[i] ??
                    "border-ink-700/80 bg-ink-950/40 text-ink-300")
                }
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink-900 dark:text-ink-100">
                  {row.name}
                </span>
                <span className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-500 dark:text-ink-400">
                  <span className="inline-flex items-center gap-1">
                    <Newspaper size={11} /> {row.posts}{" "}
                    {row.posts === 1 ? "post" : "posts"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle size={11} /> {row.comments}{" "}
                    {row.comments === 1 ? "comment" : "comments"}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-[12px] font-bold text-accent-champagne">
                {row.score}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
