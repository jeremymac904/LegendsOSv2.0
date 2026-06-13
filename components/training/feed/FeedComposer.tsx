"use client";

import { useState } from "react";
import { Link2, Paperclip, Send, Sparkles } from "lucide-react";

import type { NewFeedPostInput } from "@/lib/legends/useAcademyStore";
import { isHttpUrl, toEmbedUrl } from "./feedUtils";

// Academy feed composer. Members post Wins / Questions / Scripts; the coach
// (admin/owner) can also publish an Announcement — stored under the coach-only
// "Pinned" category the feed API reserves for admins. Optional video links are
// normalized to a trusted embed (YouTube watch → /embed, HeyGen share →
// /embeds) before submit so the feed never renders a dead iframe.

const MEMBER_CATEGORIES = ["Wins", "Questions", "Scripts"] as const;
// Label → API category. "Announcement" maps to the admin-only Pinned category.
const ADMIN_EXTRA = { label: "Announcement", value: "Pinned" } as const;

interface FeedComposerProps {
  firstName: string;
  isAdmin: boolean;
  onSubmit: (input: NewFeedPostInput) => void;
}

export function FeedComposer({ firstName, isAdmin, onSubmit }: FeedComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("Wins");
  const [videoUrl, setVideoUrl] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const videoTrimmed = videoUrl.trim();
  const embedUrl = videoTrimmed ? toEmbedUrl(videoTrimmed) : null;
  const videoInvalid = Boolean(videoTrimmed) && !embedUrl;

  const attachmentTrimmed = attachmentUrl.trim();
  const attachmentInvalid = Boolean(attachmentTrimmed) && !isHttpUrl(attachmentTrimmed);

  const hasContent = Boolean(title.trim() || body.trim());
  const canSubmit = hasContent && !videoInvalid && !attachmentInvalid;

  function submit() {
    if (!canSubmit) return;
    const t = title.trim();
    const b = body.trim();
    onSubmit({
      author: firstName || "You",
      role: isAdmin ? "Coach" : "Loan Officer",
      category,
      title: t || b.split("\n")[0].slice(0, 80),
      body: b,
      videoEmbedUrl: embedUrl ?? undefined,
      attachmentUrl: attachmentTrimmed || undefined,
    });
    setTitle("");
    setBody("");
    setCategory("Wins");
    setVideoUrl("");
    setAttachmentUrl("");
  }

  return (
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
          <label htmlFor="feed-post-title" className="label">
            Title
          </label>
          <input
            id="feed-post-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short, specific, useful"
            className="input"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="feed-post-category" className="label">
            Category
          </label>
          <select
            id="feed-post-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input"
          >
            {MEMBER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {isAdmin && (
              <option value={ADMIN_EXTRA.value}>{ADMIN_EXTRA.label}</option>
            )}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="feed-post-body" className="label">
          Post
        </label>
        <textarea
          id="feed-post-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What do you want to share with the team?"
          className="input min-h-[110px] leading-relaxed"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="feed-post-video"
            className="label flex items-center gap-1"
          >
            <Link2 size={11} /> Video URL (optional)
          </label>
          <input
            id="feed-post-video"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube watch link or HeyGen embed"
            className={
              "input " +
              (videoInvalid ? "border-status-err/60 focus:border-status-err/60" : "")
            }
          />
          {videoInvalid && (
            <p className="text-[11px] text-status-err">
              Paste a YouTube watch link or a HeyGen embed/share link.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="feed-post-attachment"
            className="label flex items-center gap-1"
          >
            <Paperclip size={11} /> Attachment URL (optional)
          </label>
          <input
            id="feed-post-attachment"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            placeholder="Image or document link"
            className={
              "input " +
              (attachmentInvalid
                ? "border-status-err/60 focus:border-status-err/60"
                : "")
            }
          />
          {attachmentInvalid && (
            <p className="text-[11px] text-status-err">
              Attachment must be a full http(s) link.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={14} /> Post
        </button>
      </div>
    </section>
  );
}
