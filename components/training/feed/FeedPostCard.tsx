"use client";

import { useState } from "react";
import {
  Heart,
  Link2,
  MessageCircle,
  Paperclip,
  Pin,
  PinOff,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { FeedPost } from "@/lib/legends/useAcademyStore";
import {
  hostnameOf,
  isEmbeddableVideoUrl,
  isImageUrl,
  timeAgo,
} from "./feedUtils";

// One Academy feed post — coach or member. Renders trusted video embeds
// (HeyGen / YouTube) inline, attachments as image or link card, plus likes,
// comments, and pin/delete moderation where the caller allows it.

export interface PostHighlight {
  icon: LucideIcon;
  label: string;
}

interface FeedPostCardProps {
  post: FeedPost;
  isAdmin: boolean;
  highlight?: PostHighlight;
  onToggleLike: (id: string) => void;
  onAddComment: (id: string, body: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}

function LinkCard({ url, icon: Icon }: { url: string; icon: LucideIcon }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="glass-panel flex items-center gap-3 px-3 py-2.5 transition hover:border-accent-champagne/40"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-champagne/20 bg-ink-950/40 text-accent-champagne">
        <Icon size={14} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-ink-900 dark:text-ink-100">
          {url}
        </span>
        <span className="block text-[11px] text-ink-500 dark:text-ink-400">
          {hostnameOf(url)}
        </span>
      </span>
    </a>
  );
}

export function FeedPostCard({
  post,
  isAdmin,
  highlight,
  onToggleLike,
  onAddComment,
  onTogglePin,
  onDelete,
}: FeedPostCardProps) {
  const [draft, setDraft] = useState("");
  const isCoachPost = post.kind !== "member";
  const posted = timeAgo(post.createdAt);
  const HighlightIcon = highlight?.icon;
  const canDelete = isAdmin || Boolean(post.mine);

  function submitComment() {
    const text = draft.trim();
    if (!text) return;
    onAddComment(post.id, text);
    setDraft("");
  }

  return (
    <article
      className={
        "glass-card-padded space-y-4 " +
        (highlight || post.pinned ? "border-accent-gold/40" : "")
      }
    >
      {/* Highlight ribbon — why this post is at the top of your feed today. */}
      {highlight && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-champagne/30 bg-ink-950/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-champagne">
          {HighlightIcon && <HighlightIcon size={11} />} {highlight.label}
        </span>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            {post.author}
          </span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
            {post.role}
          </span>
          <span className="chip">
            {post.category === "Pinned" ? "Announcement" : post.category}
          </span>
          {posted && (
            <span className="text-[11px] text-ink-500 dark:text-ink-400">
              {posted}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {post.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-gold px-2 py-0.5 text-[10px] font-semibold text-ink-950">
              <Pin size={11} /> Pinned
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => onTogglePin(post.id, !post.pinned)}
              aria-label={post.pinned ? "Unpin post" : "Pin post"}
              title={post.pinned ? "Unpin post" : "Pin post"}
              className="grid h-7 w-7 place-items-center rounded-full border border-accent-champagne/20 text-ink-400 transition hover:border-accent-gold/50 hover:text-accent-gold"
            >
              {post.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          )}
          {canDelete && !isCoachPost && (
            <button
              type="button"
              onClick={() => onDelete(post.id)}
              aria-label="Delete post"
              title="Delete post"
              className="grid h-7 w-7 place-items-center rounded-full border border-accent-champagne/20 text-ink-400 transition hover:border-status-err/50 hover:text-status-err"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {isCoachPost && !highlight && (
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

      {/* Video — trusted embeds render inline; anything else becomes a link card. */}
      {isEmbeddableVideoUrl(post.videoEmbedUrl) ? (
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
      ) : (
        post.videoEmbedUrl && <LinkCard url={post.videoEmbedUrl} icon={Link2} />
      )}

      {/* Attachment — image preview when the extension says image, else link card. */}
      {isImageUrl(post.attachmentUrl) ? (
        <a
          href={post.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-xl border border-accent-champagne/20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- member-supplied remote URL; domains unknown to next/image */}
          <img
            src={post.attachmentUrl}
            alt={post.title || "Post attachment"}
            loading="lazy"
            className="max-h-96 w-full bg-ink-950/40 object-contain"
          />
        </a>
      ) : (
        post.attachmentUrl && (
          <LinkCard url={post.attachmentUrl} icon={Paperclip} />
        )
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 border-t border-accent-champagne/15 pt-3">
        <button
          type="button"
          onClick={() => onToggleLike(post.id)}
          aria-pressed={Boolean(post.likedByMe)}
          aria-label={post.likedByMe ? "Unlike" : "Like"}
          className={
            "inline-flex items-center gap-1.5 text-[12px] font-medium transition " +
            (post.likedByMe
              ? "text-accent-orange"
              : "text-ink-500 hover:text-accent-champagne dark:text-ink-400")
          }
        >
          <Heart size={15} className={post.likedByMe ? "fill-current" : ""} />
          {post.likeCount}
        </button>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-500 dark:text-ink-400">
          <MessageCircle size={15} />
          {post.comments.length}
        </span>
      </div>

      {/* Comments */}
      {post.comments.length > 0 && (
        <div className="space-y-2">
          {post.comments.map((comment, i) => {
            const when = timeAgo(comment.createdAt);
            return (
              <div
                key={comment.id ?? `${post.id}-c-${i}`}
                className="rounded-xl border border-accent-champagne/15 bg-ink-950/30 px-3 py-2"
              >
                <p className="flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-champagne">
                  {comment.author}
                  {when && (
                    <span className="font-normal normal-case tracking-normal text-ink-500 dark:text-ink-400">
                      {when}
                    </span>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700 dark:text-ink-200">
                  {comment.body}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add comment */}
      <div className="flex items-end gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitComment();
            }
          }}
          placeholder="Add a comment…"
          className="input"
        />
        <button
          type="button"
          onClick={submitComment}
          disabled={!draft.trim()}
          aria-label="Send comment"
          className="btn-ghost shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>
    </article>
  );
}
