"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  Search,
  ShieldAlert,
  Target,
  X,
  Zap,
} from "lucide-react";

import {
  eliteLevels,
  eliteLessonCount,
  type EliteLevel,
} from "@/lib/legends/eliteContent";
import { cn } from "@/lib/utils";

/**
 * Elite Sales & Marketing library — the 101 Foundation → 601 Elite Execution
 * curriculum as level sections with lesson cards, search, and expandable
 * lesson plans. Only real media is embedded (the 101 YouTube recording);
 * everything else is the actual curriculum content rendered inline.
 */
export function EliteLibrary() {
  const [query, setQuery] = useState("");
  const [openPlans, setOpenPlans] = useState<Set<string>>(
    () => new Set(["101"])
  );

  const q = query.trim().toLowerCase();

  const visibleLevels = useMemo(() => {
    if (!q) {
      return eliteLevels.map((level) => ({ level, lessons: level.lessons }));
    }
    return eliteLevels
      .map((level) => {
        const levelMatches =
          level.title.toLowerCase().includes(q) ||
          level.theme.toLowerCase().includes(q) ||
          level.corePromise.toLowerCase().includes(q) ||
          level.name.toLowerCase().includes(q);
        const lessons = level.lessons.filter((lesson) =>
          lesson.title.toLowerCase().includes(q)
        );
        if (levelMatches) return { level, lessons: level.lessons };
        if (lessons.length > 0) return { level, lessons };
        return null;
      })
      .filter(
        (entry): entry is { level: EliteLevel; lessons: EliteLevel["lessons"] } =>
          entry !== null
      );
  }, [q]);

  const togglePlan = (levelKey: string) => {
    setOpenPlans((prev) => {
      const next = new Set(prev);
      if (next.has(levelKey)) next.delete(levelKey);
      else next.add(levelKey);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-sm">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${eliteLessonCount} lessons across six levels…`}
            className="w-full rounded-xl border border-ink-200 bg-white/60 py-2 pl-9 pr-9 text-sm text-ink-900 outline-none transition placeholder:text-ink-500 focus:border-accent-champagne/50 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 transition hover:text-accent-champagne"
            >
              <X size={14} />
            </button>
          )}
        </label>
        <span className="chip">
          {visibleLevels.reduce((sum, e) => sum + e.lessons.length, 0)} lessons
        </span>
        <span className="chip">{visibleLevels.length} levels</span>
      </div>

      {visibleLevels.length === 0 && (
        <div className="glass-card-padded text-center">
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            No lessons match “{query}”
          </p>
          <p className="mt-1 text-[12.5px] text-ink-600 dark:text-ink-300">
            Try a shorter term — levels cover foundation, conversion, partners,
            content, pipeline, and execution.
          </p>
        </div>
      )}

      {/* Level sections */}
      {visibleLevels.map(({ level, lessons }) => {
        const planOpen = openPlans.has(level.level);
        return (
          <section key={level.level} className="glass-card-padded space-y-4">
            {/* Level header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label flex items-center gap-1.5">
                  <GraduationCap size={12} className="text-accent-champagne" />
                  Level {level.level} · {level.name}
                </p>
                <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-100">
                  {level.title}
                </h3>
                <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
                  {level.corePromise}
                </p>
                <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
                  For: {level.audience}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {level.skillTags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Real training video (101 only — others have no published recording) */}
            {level.video && (
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-accent-champagne/20 bg-black">
                  <iframe
                    src={level.video.embedUrl}
                    title={level.video.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {level.video.title}
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                    {level.video.description}
                  </p>
                  <a
                    href={level.video.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost mt-3 text-[12px]"
                  >
                    Watch on YouTube
                  </a>
                </div>
              </div>
            )}

            {/* Lesson cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="group rounded-2xl border border-ink-200 bg-white/40 p-4 transition hover:-translate-y-0.5 hover:border-accent-champagne/30 dark:border-ink-800 dark:bg-ink-950/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="chip">{lesson.category}</span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                      {lesson.level}
                    </span>
                  </div>
                  <h4 className="mt-2.5 text-[13.5px] font-semibold leading-snug text-ink-900 dark:text-ink-100">
                    {lesson.title}
                  </h4>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
                    {level.theme}
                  </p>
                </div>
              ))}
            </div>

            {/* Lesson plan (real curriculum detail) */}
            <div className="rounded-2xl border border-ink-200 dark:border-ink-800">
              <button
                type="button"
                onClick={() => togglePlan(level.level)}
                aria-expanded={planOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-700 dark:text-ink-200">
                  <ClipboardList size={13} className="text-accent-champagne" />
                  Lesson plan — outcomes, assignment, and tracker
                </span>
                <ChevronDown
                  size={15}
                  className={cn(
                    "shrink-0 text-ink-500 transition-transform",
                    planOpen && "rotate-180"
                  )}
                />
              </button>
              {planOpen && (
                <div className="grid gap-5 border-t border-ink-200 px-4 py-4 dark:border-ink-800 md:grid-cols-2">
                  <PlanList
                    icon={Zap}
                    title="Do this today"
                    items={level.doThisToday}
                  />
                  <PlanList
                    icon={CheckCircle2}
                    title="Outcomes"
                    items={level.outcomes}
                  />
                  <PlanList
                    icon={BookOpenCheck}
                    title="Weekly assignment"
                    items={level.assignment}
                  />
                  <PlanList
                    icon={Target}
                    title="Tracker metrics"
                    items={level.trackerMetrics}
                  />
                  <div className="md:col-span-2">
                    <PlanList
                      icon={ShieldAlert}
                      title="Compliance watch-outs"
                      items={level.complianceWatchOuts}
                    />
                  </div>
                  {level.behaviorChange && (
                    <p className="rounded-xl border border-accent-champagne/20 bg-accent-champagne/5 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-700 dark:text-ink-200 md:col-span-2">
                      <span className="font-semibold text-accent-champagne">
                        Behavior change:
                      </span>{" "}
                      {level.behaviorChange}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PlanList({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <p className="label flex items-center gap-1.5">
        <Icon size={12} className="text-accent-champagne" />
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300"
          >
            <span
              aria-hidden
              className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-champagne/70"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
