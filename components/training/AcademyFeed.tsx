"use client";

import { useMemo, useState } from "react";
import {
  Heart,
  MessageCircle,
  Pin,
  Send,
  Sparkles,
} from "lucide-react";

import { feedCategories } from "@/lib/legends/academyContent";
import { useAcademyFeed } from "@/lib/legends/useAcademyStore";

// Loan officers can post into these three categories. Daily / Weekly / Pinned
// stay coach-only (Jeremy), so they never appear in the composer dropdown.
const LO_CATEGORIES = ["Wins", "Questions", "Scripts"] as const;
type LoCategory = (typeof LO_CATEGORIES)[number];

export function AcademyFeed({ firstName }: { firstName: string }) {
  const { hydrated, posts, toggleLike, addComment, addPost, isSeedId } =
    useAcademyFeed();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<LoCategory>("Wins");
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  const visiblePosts = useMemo(() => {
    if (activeCategory === "All") return posts;
    if (activeCategory === "Pinned") return posts.filter((p) => p.pinned);
    return posts.filter((p) => p.category === activeCategory);
  }, [posts, activeCategory]);

  function submitPost() {
    const t = title.trim();
    const b = body.trim();
    if (!t && !b) return;
    addPost({
      author: firstName || "You",
      role: "Loan Officer",
      category,
      title: t || b.split("\n")[0].slice(0, 80),
      body: b,
    });
    setTitle("");
    setBody("");
    setCategory("Wins");
  }

  function submitComment(id: string) {
    const text = (commentDraft[id] ?? "").trim();
    if (!text) return;
    addComment(id, text, isSeedId(id));
    setCommentDraft((prev) => ({ ...prev, [id]: "" }));
  }

  if (!hydrated) {
    return (
      <div className="glass-card-padded">
        <p className="text-sm text-ink-500 dark:text-ink-400">Loading feed…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Composer */}
      <section className="glass-card-padded space-y-4">
        <div className="section-title">
          <h2 className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-accent-champagne" /> Share with
            the team
          </h2>
          <p>Post a win, ask a question, or drop a script that worked.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="space-y-1.5">
            <label className="label">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, specific, useful"
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as LoCategory)}
              className="input"
            >
              {LO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="label">Post</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What do you want to share with the team?"
            className="input min-h-[110px] leading-relaxed"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={submitPost}
            disabled={!title.trim() && !body.trim()}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={14} /> Post
          </button>
        </div>
      </section>

      {/* Category filter chips */}
      <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {feedCategories.map((cat) => {
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={active ? "chip-active" : "chip"}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Posts */}
      {visiblePosts.length === 0 ? (
        <div className="glass-card-padded text-center">
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Nothing in this category yet. Be the first to share.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post) => (
            <article
              key={post.id}
              className={
                "glass-card-padded space-y-4 " +
                (post.pinned ? "border-accent-gold/40" : "")
              }
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {post.author}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                    {post.role}
                  </span>
                  <span className="chip">{post.category}</span>
                </div>
                {post.pinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-gold px-2 py-0.5 text-[10px] font-semibold text-ink-950">
                    <Pin size={11} /> Pinned
                  </span>
                )}
              </div>

              {post.pinned && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-champagne/30 bg-ink-950/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-champagne">
                  <Sparkles size={11} /> Coach post from Jeremy
                </span>
              )}

              {/* Body */}
              <div>
                <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">
                  {post.title}
                </h3>
                {post.body && (
                  <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-700 dark:text-ink-200">
                    {post.body}
                  </p>
                )}
              </div>

              {/* Video */}
              {post.videoEmbedUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-accent-champagne/20 bg-black">
                  <iframe
                    src={post.videoEmbedUrl}
                    title={post.title}
                    className="h-full w-full"
                    loading="lazy"
                    allow="encrypted-media; fullscreen"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 border-t border-accent-champagne/15 pt-3">
                <button
                  type="button"
                  onClick={() => toggleLike(post.id, isSeedId(post.id))}
                  className={
                    "inline-flex items-center gap-1.5 text-[12px] font-medium transition " +
                    (post.liked
                      ? "text-accent-orange"
                      : "text-ink-500 hover:text-accent-champagne dark:text-ink-400")
                  }
                >
                  <Heart
                    size={15}
                    className={post.liked ? "fill-current" : ""}
                  />
                  {post.likes}
                </button>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-500 dark:text-ink-400">
                  <MessageCircle size={15} />
                  {post.comments.length}
                </span>
              </div>

              {/* Comments */}
              {post.comments.length > 0 && (
                <div className="space-y-2">
                  {post.comments.map((comment, i) => (
                    <div
                      key={`${post.id}-c-${i}`}
                      className="rounded-xl border border-accent-champagne/15 bg-ink-950/30 px-3 py-2"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-champagne">
                        {comment.author}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700 dark:text-ink-200">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment */}
              <div className="flex items-end gap-2">
                <input
                  value={commentDraft[post.id] ?? ""}
                  onChange={(e) =>
                    setCommentDraft((prev) => ({
                      ...prev,
                      [post.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitComment(post.id);
                    }
                  }}
                  placeholder="Add a comment…"
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => submitComment(post.id)}
                  disabled={!(commentDraft[post.id] ?? "").trim()}
                  className="btn-ghost shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
