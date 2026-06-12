"use client";

import { useEffect } from "react";
import { PlayCircle, X } from "lucide-react";

// HeyGen avatar embeds have no public thumbnail URL, so we render a branded
// dark/gold poster facade instead of loading dozens of iframes at once. The
// facade plays the real HeyGen embed in a modal on click — fast list render,
// real playback on demand.

export function HeyGenPoster({
  eyebrow,
  title,
  meta,
  onPlay,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  onPlay: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play ${title}`}
      className={
        "group relative flex aspect-video w-full flex-col justify-end overflow-hidden rounded-xl border border-accent-champagne/20 bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-3 text-left transition hover:border-accent-champagne/50 " +
        className
      }
    >
      <span className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-accent-gold/15 blur-2xl transition group-hover:bg-accent-gold/25" />
      <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-accent-champagne/40 bg-ink-950/70 text-accent-champagne shadow-glass transition group-hover:scale-110 group-hover:bg-accent-gold group-hover:text-ink-950">
        <PlayCircle size={20} />
      </span>
      {eyebrow && (
        <span className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-accent-champagne/80">
          {eyebrow}
        </span>
      )}
      <span className="relative mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-ink-100">
        {title}
      </span>
      {meta && (
        <span className="relative mt-1 text-[11px] text-ink-400">{meta}</span>
      )}
    </button>
  );
}

export function HeyGenModal({
  embedUrl,
  title,
  subtitle,
  onClose,
}: {
  embedUrl: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-accent-champagne/25 bg-ink-950 shadow-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={title}
            className="h-full w-full"
            allow="encrypted-media; fullscreen"
            allowFullScreen
          />
        </div>
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
            {subtitle && (
              <p className="mt-1 text-[12px] text-ink-300">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent-champagne/25 text-ink-300 transition hover:text-status-err"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
