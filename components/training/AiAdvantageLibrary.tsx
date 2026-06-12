"use client";

import { useMemo, useState } from "react";
import { PlayCircle, Search, X } from "lucide-react";

import {
  aiAdvantagePublishedVideos,
  aiAdvantageVideoSectionOrder,
  type AiAdvantagePublishedVideo,
  type AiAdvantageVideoSection,
} from "@/lib/legends/aiAdvantageVideos";

type SectionFilter = "all" | AiAdvantageVideoSection;

/**
 * AI Advantage video library. Client component so the team can search and
 * filter the unlisted YouTube lessons and play any one inline. Pure data +
 * iframe embeds — no network calls beyond the YouTube player itself.
 */
export function AiAdvantageLibrary() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SectionFilter>("all");
  const [active, setActive] = useState<AiAdvantagePublishedVideo | null>(null);

  const q = query.trim().toLowerCase();

  const sectionCounts = useMemo(() => {
    const counts = new Map<SectionFilter, number>();
    counts.set("all", aiAdvantagePublishedVideos.length);
    for (const s of aiAdvantageVideoSectionOrder) {
      counts.set(
        s,
        aiAdvantagePublishedVideos.filter((v) => v.librarySection === s).length
      );
    }
    return counts;
  }, []);

  const visible = useMemo(() => {
    return aiAdvantagePublishedVideos.filter((v) => {
      if (section !== "all" && v.librarySection !== section) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.librarySection.toLowerCase().includes(q)
      );
    });
  }, [q, section]);

  const sections: SectionFilter[] = ["all", ...aiAdvantageVideoSectionOrder];

  return (
    <div className="space-y-4">
      <div className="glass-card-padded space-y-3">
        <label className="block">
          <span className="label flex items-center gap-1">
            <Search size={11} />
            Search the AI Advantage library
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
          {sections.map((s) => {
            const isActive = section === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={isActive ? "chip-active" : "chip"}
              >
                {s === "all" ? "All" : s}
                <span className="ml-1 tabular-nums opacity-70">
                  {sectionCounts.get(s) ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-ink-500 dark:text-ink-400">
        Showing {visible.length} of {aiAdvantagePublishedVideos.length} lessons.
        All videos are unlisted Legends training clips — do not share publicly.
      </p>

      {visible.length === 0 ? (
        <div className="glass-card-padded text-center text-sm text-ink-600 dark:text-ink-300">
          No lessons match your search. Clear filters and try again.
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((video) => (
            <article
              key={video.rowId}
              className="glass-card-padded flex flex-col"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="chip">{video.librarySection}</span>
                <PlayCircle size={16} className="text-accent-champagne" />
              </div>

              {active?.rowId === video.rowId ? (
                <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-accent-champagne/20 bg-black">
                  <iframe
                    src={`${video.youtubeEmbedUrl}?rel=0`}
                    title={video.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActive(video)}
                  className="group mt-3 flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-accent-champagne/20 bg-ink-950/40 transition hover:border-accent-champagne/50"
                  aria-label={`Play ${video.title}`}
                >
                  <span className="inline-flex items-center gap-2 rounded-full border border-accent-champagne/30 bg-accent-gold/10 px-3 py-1.5 text-xs font-medium text-accent-champagne transition group-hover:bg-accent-gold/20">
                    <PlayCircle size={15} />
                    Play lesson
                  </span>
                </button>
              )}

              <h3 className="mt-3 text-sm font-semibold leading-snug text-ink-900 dark:text-ink-100">
                {video.title.replace(/^AI Advantage:\s*/i, "")}
              </h3>
              <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                {video.description}
              </p>

              <div className="mt-3 flex items-center gap-3 text-[11px]">
                {active?.rowId === video.rowId ? (
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    className="inline-flex items-center gap-1 text-ink-500 hover:text-status-err"
                  >
                    <X size={12} /> Close player
                  </button>
                ) : null}
                <a
                  href={video.youtubeVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-500 transition-colors hover:text-accent-champagne dark:text-ink-400"
                >
                  Open on YouTube ↗
                </a>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
