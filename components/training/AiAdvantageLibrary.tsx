"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, PlayCircle, Search, Sparkles, X } from "lucide-react";

import {
  aiAdvantagePublishedVideos,
  aiAdvantageVideoSectionOrder,
  type AiAdvantagePublishedVideo,
  type AiAdvantageVideoSection,
} from "@/lib/legends/aiAdvantageVideos";
import { thumbnailUrl } from "@/lib/legends/videoRegistry";
import { useTrainingProgress } from "@/lib/legends/useTrainingProgress";

type SectionFilter = "all" | AiAdvantageVideoSection;

const cleanTitle = (t: string) => t.replace(/^AI Advantage:\s*/i, "");
const poster = (v: AiAdvantagePublishedVideo) =>
  thumbnailUrl("youtube", v.youtubeVideoId) ?? "";

/**
 * AI Advantage — premium, Netflix-style training library. Featured lesson,
 * continue-watching + recently-added rails, per-section rails, search/filter,
 * local progress tracking, and an inline modal player. Pure data + YouTube
 * embeds; progress is device-local via useTrainingProgress.
 */
export function AiAdvantageLibrary() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SectionFilter>("all");
  const [active, setActive] = useState<AiAdvantagePublishedVideo | null>(null);
  const progress = useTrainingProgress("ai-advantage");

  const all = aiAdvantagePublishedVideos;
  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || section !== "all";

  const sectionCounts = useMemo(() => {
    const counts = new Map<SectionFilter, number>();
    counts.set("all", all.length);
    for (const s of aiAdvantageVideoSectionOrder) {
      counts.set(s, all.filter((v) => v.librarySection === s).length);
    }
    return counts;
  }, [all]);

  const filtered = useMemo(() => {
    return all.filter((v) => {
      if (section !== "all" && v.librarySection !== section) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.librarySection.toLowerCase().includes(q)
      );
    });
  }, [all, q, section]);

  const featured = useMemo(
    () => all.find((v) => v.rowId === "AIADV-001") ?? all[0],
    [all],
  );
  const recentlyAdded = useMemo(() => all.slice(-8).reverse(), [all]);

  const continueWatching = useMemo(() => {
    if (!progress.hydrated) return [];
    const byId = new Map(all.map((v) => [v.rowId, v]));
    return Object.entries(progress.touched)
      .filter(([id]) => byId.has(id) && !progress.done.includes(id))
      .sort((a, b) => (a[1] < b[1] ? 1 : -1))
      .map(([id]) => byId.get(id)!)
      .slice(0, 8);
  }, [all, progress.hydrated, progress.touched, progress.done]);

  const doneCount = progress.hydrated
    ? all.filter((v) => progress.done.includes(v.rowId)).length
    : 0;
  const pct = Math.round((doneCount / all.length) * 100);

  function play(video: AiAdvantagePublishedVideo) {
    progress.touch(video.rowId);
    setActive(video);
  }

  const sections: SectionFilter[] = ["all", ...aiAdvantageVideoSectionOrder];

  return (
    <div className="space-y-6">
      {/* Progress strip */}
      <div className="glass-card-padded flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="label flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent-champagne" /> Your progress
          </p>
          <p className="mt-1 text-sm text-ink-700 dark:text-ink-200">
            <span className="font-semibold text-ink-900 dark:text-ink-100">
              {doneCount}
            </span>{" "}
            of {all.length} lessons watched
            {doneCount === all.length && all.length > 0 && " — series complete 🎉"}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-200/70 dark:bg-ink-800/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-gold to-accent-orange transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-accent-champagne">
            {pct}%
          </span>
        </div>
      </div>

      {/* Search + section filter */}
      <div className="glass-card-padded space-y-3">
        <label className="block">
          <span className="label flex items-center gap-1">
            <Search size={11} /> Search the AI Advantage library
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="topic, tool, or keyword (e.g. Gemini, AI twin, follow-up)…"
            className="input mt-1"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
            Section
          </span>
          {sections.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={section === s ? "chip-active" : "chip"}
            >
              {s === "all" ? "All" : s}
              <span className="ml-1 tabular-nums opacity-70">
                {sectionCounts.get(s) ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtering ? (
        /* Filtered grid */
        <section className="space-y-3">
          <p className="text-[11px] text-ink-500 dark:text-ink-400">
            {filtered.length} {filtered.length === 1 ? "lesson" : "lessons"}
            {section !== "all" && ` in ${section}`}
            {q && ` matching “${query.trim()}”`}.
          </p>
          {filtered.length === 0 ? (
            <div className="glass-card-padded text-center text-sm text-ink-600 dark:text-ink-300">
              No lessons match. Clear filters and try again.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((v) => (
                <LessonCard
                  key={v.rowId}
                  video={v}
                  watched={progress.isDone(v.rowId)}
                  onPlay={() => play(v)}
                  onToggle={() => progress.toggleDone(v.rowId)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-7">
          {/* Featured */}
          {featured && (
            <section className="space-y-3">
              <SectionLabel
                title="Featured lesson"
                sub="Start here if you're new to AI Advantage."
              />
              <button
                type="button"
                onClick={() => play(featured)}
                className="group relative grid w-full gap-0 overflow-hidden rounded-2xl border border-accent-champagne/20 text-left shadow-glass transition hover:border-accent-champagne/45 md:grid-cols-[1.4fr_1fr]"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-ink-950">
                  {poster(featured) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster(featured)}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02] group-hover:opacity-100"
                    />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/20 to-transparent" />
                  <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-accent-gold/40 bg-ink-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-gold">
                    Featured
                  </span>
                  <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-accent-gold px-4 py-2 text-sm font-semibold text-ink-950 shadow-lg transition group-hover:bg-accent-orange">
                    <PlayCircle size={17} /> Play lesson
                  </span>
                </div>
                <div className="flex flex-col justify-center gap-2 bg-white/60 p-5 dark:bg-ink-950/50">
                  <span className="chip w-fit">{featured.librarySection}</span>
                  <h3 className="text-lg font-semibold leading-snug text-ink-900 dark:text-ink-100">
                    {cleanTitle(featured.title)}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
                    {featured.description}
                  </p>
                </div>
              </button>
            </section>
          )}

          {/* Continue watching */}
          {continueWatching.length > 0 && (
            <Rail
              title="Continue watching"
              sub="Pick up where you left off."
              icon={<Clock3 size={13} className="text-accent-champagne" />}
            >
              {continueWatching.map((v) => (
                <RailCard
                  key={v.rowId}
                  video={v}
                  watched={progress.isDone(v.rowId)}
                  onPlay={() => play(v)}
                  onToggle={() => progress.toggleDone(v.rowId)}
                />
              ))}
            </Rail>
          )}

          {/* Recently added */}
          <Rail title="Recently added" sub="Newest clips in the library.">
            {recentlyAdded.map((v) => (
              <RailCard
                key={v.rowId}
                video={v}
                watched={progress.isDone(v.rowId)}
                onPlay={() => play(v)}
                onToggle={() => progress.toggleDone(v.rowId)}
              />
            ))}
          </Rail>

          {/* Per-section rails */}
          {aiAdvantageVideoSectionOrder.map((s) => {
            const items = all.filter((v) => v.librarySection === s);
            if (items.length === 0) return null;
            return (
              <Rail key={s} title={s} sub={`${items.length} lessons`}>
                {items.map((v) => (
                  <RailCard
                    key={v.rowId}
                    video={v}
                    watched={progress.isDone(v.rowId)}
                    onPlay={() => play(v)}
                    onToggle={() => progress.toggleDone(v.rowId)}
                  />
                ))}
              </Rail>
            );
          })}
        </div>
      )}

      {active && (
        <PlayerModal
          video={active}
          watched={progress.isDone(active.rowId)}
          onToggle={() => progress.toggleDone(active.rowId)}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
          {title}
        </h2>
        {sub && (
          <p className="text-[11px] text-ink-500 dark:text-ink-400">{sub}</p>
        )}
      </div>
    </div>
  );
}

function Rail({
  title,
  sub,
  icon,
  children,
}: {
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <SectionLabel title={title} sub={sub} />
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin [scroll-snap-type:x_proximity]">
        {children}
      </div>
    </section>
  );
}

function Thumb({
  video,
  watched,
  onPlay,
  onToggle,
}: {
  video: AiAdvantagePublishedVideo;
  watched: boolean;
  onPlay: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl border border-accent-champagne/15 bg-ink-950">
      {poster(video) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster(video)}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-85 transition group-hover:scale-[1.03] group-hover:opacity-100"
        />
      )}
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play ${cleanTitle(video.title)}`}
        className="absolute inset-0 grid place-items-center bg-ink-950/30 transition group-hover:bg-ink-950/15"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full border border-accent-champagne/50 bg-ink-950/70 text-accent-champagne shadow-glass transition group-hover:scale-110 group-hover:bg-accent-gold group-hover:text-ink-950">
          <PlayCircle size={22} />
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={watched ? "Mark unwatched" : "Mark watched"}
        title={watched ? "Watched" : "Mark watched"}
        className={
          watched
            ? "absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-accent-gold text-ink-950 shadow"
            : "absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-accent-champagne/40 bg-ink-950/70 text-ink-300 opacity-0 transition group-hover:opacity-100 hover:text-accent-champagne"
        }
      >
        <Check size={14} />
      </button>
    </div>
  );
}

function RailCard({
  video,
  watched,
  onPlay,
  onToggle,
}: {
  video: AiAdvantagePublishedVideo;
  watched: boolean;
  onPlay: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="w-[230px] shrink-0 [scroll-snap-align:start] sm:w-[250px]">
      <Thumb video={video} watched={watched} onPlay={onPlay} onToggle={onToggle} />
      <h3 className="mt-2 line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink-900 dark:text-ink-100">
        {cleanTitle(video.title)}
      </h3>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
        {video.librarySection}
      </p>
    </article>
  );
}

function LessonCard({
  video,
  watched,
  onPlay,
  onToggle,
}: {
  video: AiAdvantagePublishedVideo;
  watched: boolean;
  onPlay: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="glass-card-padded flex flex-col">
      <Thumb video={video} watched={watched} onPlay={onPlay} onToggle={onToggle} />
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="chip">{video.librarySection}</span>
        {watched && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-gold">
            <Check size={11} /> Watched
          </span>
        )}
      </div>
      <h3 className="mt-2 text-sm font-semibold leading-snug text-ink-900 dark:text-ink-100">
        {cleanTitle(video.title)}
      </h3>
      <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
        {video.description}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onPlay} className="btn-primary text-[12px]">
          <PlayCircle size={14} /> Play
        </button>
        <a
          href={video.youtubeVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-[11px]"
        >
          YouTube ↗
        </a>
      </div>
    </article>
  );
}

function PlayerModal({
  video,
  watched,
  onToggle,
  onClose,
}: {
  video: AiAdvantagePublishedVideo;
  watched: boolean;
  onToggle: () => void;
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
      aria-label={cleanTitle(video.title)}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-accent-champagne/25 bg-ink-950 shadow-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video w-full bg-black">
          <iframe
            src={`${video.youtubeEmbedUrl}?rel=0&autoplay=1`}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <span className="chip">{video.librarySection}</span>
            <h3 className="mt-2 text-sm font-semibold text-ink-100">
              {cleanTitle(video.title)}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
              {video.description}
            </p>
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
        <div className="flex flex-wrap items-center gap-2 border-t border-accent-champagne/10 px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            className={watched ? "btn-ghost text-[12px]" : "btn-primary text-[12px]"}
          >
            <Check size={14} /> {watched ? "Watched" : "Mark watched"}
          </button>
          <a
            href={video.youtubeVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-[11px]"
          >
            YouTube ↗
          </a>
        </div>
      </div>
    </div>
  );
}
