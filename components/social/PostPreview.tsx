"use client";

import {
  Facebook,
  ImageIcon,
  Instagram,
  MapPin,
  PlayCircle,
  Youtube,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ChannelId =
  | "facebook"
  | "instagram"
  | "google_business_profile"
  | "youtube";

interface MediaPreview {
  id: string;
  preview_url: string | null;
  prompt: string | null;
}

export interface PostPreviewProps {
  body: string;
  channels: ChannelId[];
  media: MediaPreview[];
  youtubeTitle?: string;
  scheduledAt?: string;
  postStatus?: "draft" | "scheduled" | "posted" | null;
  brandName?: string;
}

// Per-channel character limits we surface to the user. These are the
// "you can technically post this much" numbers Jeremy expects to see — they
// aren't enforced at submit time.
const CHANNEL_LIMITS: Record<ChannelId, number> = {
  facebook: 63206,
  instagram: 2200,
  google_business_profile: 1500,
  youtube: 5000,
};

const CHANNEL_LABELS: Record<ChannelId, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  google_business_profile: "Google Business",
  youtube: "YouTube",
};

export function PostPreview({
  body,
  channels,
  media,
  youtubeTitle,
  scheduledAt,
  postStatus,
  brandName = "The Legends Mortgage Team",
}: PostPreviewProps) {
  const primary = media[0] ?? null;
  const showYouTube = channels.includes("youtube");
  const showFacebook = channels.includes("facebook");
  const showInstagram = channels.includes("instagram");
  const showGBP = channels.includes("google_business_profile");

  return (
    <aside className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300">
          Live preview
        </p>
        <StatusChips
          postStatus={postStatus ?? "draft"}
          scheduledAt={scheduledAt}
        />
      </header>

      <CharacterCount body={body} channels={channels} />

      <div className="space-y-3">
        {channels.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/30 p-6 text-center text-xs text-ink-300">
            Pick at least one channel to see the live preview.
          </div>
        )}

        {showFacebook && (
          <FacebookPreview
            body={body}
            primary={primary}
            brandName={brandName}
          />
        )}

        {showInstagram && (
          <InstagramPreview
            body={body}
            primary={primary}
            brandName={brandName}
          />
        )}

        {showGBP && (
          <GBPPreview body={body} primary={primary} brandName={brandName} />
        )}

        {showYouTube && (
          <YouTubePreview
            body={body}
            primary={primary}
            title={youtubeTitle ?? ""}
            brandName={brandName}
          />
        )}
      </div>
    </aside>
  );
}

function CharacterCount({
  body,
  channels,
}: {
  body: string;
  channels: ChannelId[];
}) {
  if (channels.length === 0) return null;
  const len = body.length;
  // The tightest limit across the selected channels — that's the one the user
  // will trip first.
  const tightest = channels.reduce(
    (min, c) => Math.min(min, CHANNEL_LIMITS[c]),
    Infinity
  );
  const over = len > tightest;
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-1.5 text-[11px]",
        over
          ? "border-status-err/40 bg-status-err/10 text-status-err"
          : "border-ink-800 bg-ink-900/40 text-ink-300"
      )}
    >
      {len.toLocaleString()} chars / {tightest.toLocaleString()} limit
      {over && " — over the tightest selected channel's limit."}
    </p>
  );
}

function StatusChips({
  postStatus,
  scheduledAt,
}: {
  postStatus: "draft" | "scheduled" | "posted" | null;
  scheduledAt?: string;
}) {
  const label =
    postStatus === "posted"
      ? "Posted"
      : postStatus === "scheduled"
      ? scheduledAt
        ? `Scheduled · ${formatLocal(scheduledAt)}`
        : "Scheduled"
      : "Draft";
  const tone =
    postStatus === "posted"
      ? "bg-status-ok/15 text-status-ok border-status-ok/30"
      : postStatus === "scheduled"
      ? "bg-status-warn/15 text-status-warn border-status-warn/30"
      : "bg-ink-800/60 text-ink-200 border-ink-700";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]",
        tone
      )}
    >
      {label}
    </span>
  );
}

function FacebookPreview({
  body,
  primary,
  brandName,
}: {
  body: string;
  primary: MediaPreview | null;
  brandName: string;
}) {
  return (
    <PreviewFrame
      icon={<Facebook size={12} />}
      label="Facebook"
      tint="from-[#1877F2]/10"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-accent-gold to-accent-orange text-[10px] font-semibold text-ink-950">
          LM
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-ink-100">
            {brandName}
          </p>
          <p className="text-[9px] text-ink-300">Just now · 🌐</p>
        </div>
      </div>
      <p className="px-3 pb-2 text-[12px] leading-relaxed text-ink-100 whitespace-pre-wrap">
        {body || (
          <span className="text-ink-400">Your post body will appear here.</span>
        )}
      </p>
      {primary?.preview_url ? (
        <img
          src={primary.preview_url}
          alt={primary.prompt ?? ""}
          className="w-full max-h-72 object-cover"
        />
      ) : (
        <PlaceholderImage />
      )}
      <div className="flex items-center justify-around border-t border-ink-800 px-2 py-1.5 text-[10px] text-ink-300">
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>↗ Share</span>
      </div>
    </PreviewFrame>
  );
}

function InstagramPreview({
  body,
  primary,
  brandName,
}: {
  body: string;
  primary: MediaPreview | null;
  brandName: string;
}) {
  return (
    <PreviewFrame
      icon={<Instagram size={12} />}
      label="Instagram"
      tint="from-pink-500/10"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-amber-400 text-[10px] font-semibold text-white">
          LM
        </div>
        <p className="truncate text-[11px] font-medium text-ink-100">
          legends.mortgage
        </p>
      </div>
      <div className="aspect-square w-full bg-ink-950">
        {primary?.preview_url ? (
          <img
            src={primary.preview_url}
            alt={primary.prompt ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <PlaceholderImage square />
        )}
      </div>
      <div className="flex items-center gap-3 px-3 py-1.5 text-ink-200">
        <span>♡</span>
        <span>💬</span>
        <span>↗</span>
      </div>
      <p className="px-3 pb-3 text-[11px] leading-snug text-ink-100 whitespace-pre-wrap">
        <span className="font-semibold">legends.mortgage</span>{" "}
        {body || (
          <span className="text-ink-400">
            Your caption will appear here. {brandName} branding always applies.
          </span>
        )}
      </p>
    </PreviewFrame>
  );
}

function GBPPreview({
  body,
  primary,
  brandName,
}: {
  body: string;
  primary: MediaPreview | null;
  brandName: string;
}) {
  return (
    <PreviewFrame
      icon={<MapPin size={12} />}
      label="Google Business"
      tint="from-[#1A73E8]/10"
    >
      <div className="flex items-center gap-2 border-b border-ink-800 px-3 py-2">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-[10px] font-semibold text-white">
          G
        </div>
        <div>
          <p className="text-[11px] font-medium text-ink-100">{brandName}</p>
          <p className="text-[9px] text-ink-300">Update · Google</p>
        </div>
      </div>
      {primary?.preview_url ? (
        <img
          src={primary.preview_url}
          alt={primary.prompt ?? ""}
          className="w-full max-h-56 object-cover"
        />
      ) : (
        <PlaceholderImage />
      )}
      <p className="px-3 py-2 text-[12px] leading-relaxed text-ink-100 whitespace-pre-wrap">
        {body || (
          <span className="text-ink-400">
            Your business update will appear here.
          </span>
        )}
      </p>
    </PreviewFrame>
  );
}

function YouTubePreview({
  body,
  primary,
  title,
  brandName,
}: {
  body: string;
  primary: MediaPreview | null;
  title: string;
  brandName: string;
}) {
  return (
    <PreviewFrame
      icon={<Youtube size={12} />}
      label="YouTube"
      tint="from-[#FF0000]/15"
    >
      <div className="relative aspect-video w-full bg-ink-950">
        {primary?.preview_url ? (
          <img
            src={primary.preview_url}
            alt={primary.prompt ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <PlaceholderImage video />
        )}
        <div className="absolute inset-0 grid place-items-center bg-black/20">
          <PlayCircle size={36} className="text-white/90 drop-shadow" />
        </div>
      </div>
      <div className="px-3 pb-3 pt-2">
        <p className="text-[12px] font-semibold text-ink-100 line-clamp-2">
          {title || (
            <span className="text-ink-400">
              Video title goes here — fill in the YouTube title field.
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-ink-300">
          {brandName} · 0 views · just now
        </p>
        <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-ink-200 whitespace-pre-wrap">
          {body || (
            <span className="text-ink-400">
              Video description will appear here.
            </span>
          )}
        </p>
      </div>
    </PreviewFrame>
  );
}

function PreviewFrame({
  icon,
  label,
  tint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-950 shadow-card">
      <div
        className={cn(
          "flex items-center gap-1.5 border-b border-ink-800 bg-gradient-to-r to-transparent px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-200",
          tint
        )}
      >
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function PlaceholderImage({
  square,
  video,
}: {
  square?: boolean;
  video?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid w-full place-items-center bg-ink-900 text-ink-400",
        square ? "aspect-square" : video ? "aspect-video" : "h-40"
      )}
    >
      <div className="flex flex-col items-center gap-1 text-[10px]">
        <ImageIcon size={20} />
        <span>No media attached</span>
      </div>
    </div>
  );
}

function formatLocal(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
