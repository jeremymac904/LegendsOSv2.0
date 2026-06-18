"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FileText,
  ListChecks,
  MessagesSquare,
  NotebookPen,
  Save,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  currentDayKey,
  dailyVideoForDay,
  todayDays,
  type TodayDay,
} from "@/lib/legends/academyContent";
import { useAcademyToday } from "@/lib/legends/useAcademyStore";

// Legends Mortgage Academy — TODAY workspace. A theme-day cockpit: pick the day,
// watch Jeremy's daily coaching video, log your block, and save. Numeric fields
// tagged with a metric roll into the weekly Scorecard automatically on save.

type FormFields = Record<string, string>;

// Free-form note saved alongside the day's structured fields. Not part of
// day.fields, so it never affects the filled-count or the scorecard rollup.
const ACCOUNTABILITY_NOTE_KEY = "accountability_note";

// Deep links into the surfaces an LO touches around the daily block.
const TOOL_LINKS: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/training/scripts",
    label: "Scripts",
    description: "Word-for-word call scripts",
    icon: FileText,
  },
  {
    href: "/training/resources?tab=playbooks",
    label: "Trackers",
    description: "Playbooks and weekly trackers",
    icon: ClipboardList,
  },
  {
    href: "/training/resources",
    label: "Resources",
    description: "Templates, playbooks, and downloads",
    icon: FileText,
  },
  {
    href: "/training/feed",
    label: "Feed",
    description: "Group wins, questions, and coaching",
    icon: MessagesSquare,
  },
];

function emptyForm(day: TodayDay): FormFields {
  const out: FormFields = {};
  for (const field of day.fields) out[field.key] = "";
  return out;
}

function relativeSaved(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}

export function AcademyToday({ firstName }: { firstName: string }) {
  const { hydrated, getDay, saveDay } = useAcademyToday();

  const [activeKey, setActiveKey] = useState<string>(todayDays[0]?.key ?? "monday");
  const [form, setForm] = useState<FormFields>(() =>
    emptyForm(todayDays.find((d) => d.key === (todayDays[0]?.key ?? "")) ?? todayDays[0]),
  );
  const [justSaved, setJustSaved] = useState(false);

  const day: TodayDay =
    todayDays.find((d) => d.key === activeKey) ?? todayDays[0];
  const video = useMemo(() => dailyVideoForDay(day.key), [day.key]);
  const saved = hydrated ? getDay(day.key) : undefined;

  // After hydration, default-select today's tab and prefill its saved values.
  useEffect(() => {
    if (!hydrated) return;
    const todayKey = currentDayKey();
    const target = todayDays.find((d) => d.key === todayKey) ? todayKey : day.key;
    setActiveKey(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on hydration
  }, [hydrated]);

  // Whenever the active day changes (or hydration completes), load that day's
  // saved values into the local form.
  useEffect(() => {
    const base = emptyForm(day);
    const stored = hydrated ? getDay(day.key)?.fields : undefined;
    setForm(stored ? { ...base, ...stored } : base);
    setJustSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on day + hydration
  }, [activeKey, hydrated]);

  const filled = day.fields.filter(
    (f) => (form[f.key] ?? "").trim().length > 0,
  ).length;
  const scorecardFieldCount = day.fields.filter((field) => field.metric).length;

  function updateField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setJustSaved(false);
  }

  function handleSave() {
    saveDay(day.key, form);
    setJustSaved(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto xl:overflow-hidden">
      {/* Day tabs */}
      <nav className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {todayDays.map((d) => {
          const isActive = d.key === day.key;
          const hasSaved = hydrated && Boolean(getDay(d.key));
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveKey(d.key)}
              className={
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition " +
                (isActive
                  ? "border-accent-gold/50 bg-accent-gold/15 text-accent-gold"
                  : "border-ink-200 bg-ink-50 text-ink-600 hover:border-accent-champagne/40 hover:text-accent-champagne dark:border-accent-champagne/12 dark:bg-ink-950/40 dark:text-ink-300")
              }
            >
              {hasSaved && (
                <CheckCircle2 size={12} className="text-accent-gold" />
              )}
              {d.day}
            </button>
          );
        })}
      </nav>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(240px,0.78fr)_minmax(430px,1.18fr)_minmax(270px,0.78fr)] xl:overflow-hidden">
        {/* Left: coaching is visible, but secondary to daily execution. */}
        <section className="grid min-h-0 gap-3 xl:grid-rows-[auto_1fr] xl:overflow-hidden">
          <div className="glass-card p-3">
            <p className="label flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-champagne" />
              {day.day} coaching
            </p>
            <h2 className="mt-1 text-base font-semibold text-ink-900 dark:text-ink-100">
              {day.theme}
            </h2>

            {video && (
              <div className="mt-2 aspect-video max-h-[180px] min-h-[120px] w-full overflow-hidden rounded-lg border border-accent-champagne/20 bg-black">
                <iframe
                  key={video.embedUrl}
                  src={video.embedUrl}
                  title={video.title}
                  className="h-full w-full"
                  allow="encrypted-media; fullscreen"
                  allowFullScreen
                />
              </div>
            )}
          </div>

          <div className="glass-card min-h-0 p-3">
            <p className="label">Daily coaching summary</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-700 dark:text-ink-200">
              {day.instruction}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-accent-champagne/15 bg-white/55 p-2 dark:bg-ink-950/30">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                  Fields
                </p>
                <p className="mt-1 text-lg font-semibold text-ink-900 dark:text-ink-100">
                  {filled}/{day.fields.length}
                </p>
              </div>
              <div className="rounded-lg border border-accent-champagne/15 bg-white/55 p-2 dark:bg-ink-950/30">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                  Scorecard
                </p>
                <p className="mt-1 text-lg font-semibold text-ink-900 dark:text-ink-100">
                  {scorecardFieldCount}
                </p>
              </div>
            </div>
            {firstName && (
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
                {firstName}, log the numbers before the day gets away from you.
              </p>
            )}
            {(justSaved || saved) && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-status-ok">
                <CheckCircle2 size={12} className="shrink-0" />
                Saved{" "}
                {justSaved
                  ? "just now"
                  : saved
                    ? relativeSaved(saved.savedAt)
                    : ""}{" "}
                and rolled into Scorecard.
              </p>
            )}
          </div>
        </section>

        {/* Center: the operating scorecard and pipeline/accountability fields. */}
        <section className="glass-card flex min-h-0 flex-col overflow-hidden p-3">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label flex items-center gap-1.5">
                <BarChart3 size={12} className="text-accent-champagne" />
                Scorecard + pipeline
              </p>
              <h3 className="mt-1 text-base font-semibold text-ink-900 dark:text-ink-100">
                Today&apos;s operating numbers
              </h3>
            </div>
            <span className="chip h-5 px-2 text-[9px]">
              {filled}/{day.fields.length}
            </span>
          </div>

          <div className="mt-2 grid min-h-0 flex-1 content-start grid-cols-1 gap-2 overflow-hidden sm:grid-cols-2">
            {day.fields.map((field) => {
              const isLong = field.kind === "long";
              return (
                <label
                  key={field.key}
                  className={"block min-w-0 " + (isLong ? "sm:col-span-2" : "")}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                    <span className="truncate">{field.label}</span>
                    {field.metric && (
                      <span className="rounded-full border border-accent-gold/25 px-1.5 py-0.5 text-[8px] tracking-[0.08em] text-accent-gold">
                        scorecard
                      </span>
                    )}
                  </span>
                  {isLong ? (
                    <textarea
                      aria-label={field.label}
                      value={form[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      rows={2}
                      className="input mt-1 h-14 resize-none rounded-lg px-2 py-1.5 text-[12px] leading-snug"
                    />
                  ) : (
                    <input
                      aria-label={field.label}
                      type={field.kind === "number" ? "number" : "text"}
                      inputMode={field.kind === "number" ? "numeric" : undefined}
                      min={field.kind === "number" ? 0 : undefined}
                      value={form[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="input mt-1 h-8 rounded-lg px-2 py-1 text-[12px]"
                    />
                  )}
                </label>
              );
            })}
          </div>

          <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-accent-champagne/15 pt-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-ink-600 dark:text-ink-300">
                {filled} of {day.fields.length} daily fields logged
              </p>
              <p className="mt-0.5 text-[10.5px] text-ink-500 dark:text-ink-400">
                Scorecard fields roll up when saved.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hydrated}
              className="btn-primary h-9 shrink-0 px-3 text-[12px] disabled:opacity-50"
            >
              <Save size={14} />
              Save day
            </button>
          </div>

          {(justSaved || saved) && (
            <div className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded-lg border border-accent-gold/25 bg-accent-gold/10 p-2">
              <p className="min-w-0 truncate text-[11.5px] text-ink-700 dark:text-ink-200">
                {day.key === "friday"
                  ? "Review the week and submit your scorecard."
                  : day.communityPrompt}
              </p>
              <Link
                href={day.key === "friday" ? "/training/scorecard" : "/training/feed"}
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accent-gold"
              >
                {day.key === "friday" ? "Open Scorecard" : "Answer"}
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </section>

        {/* Right: tools, accountability, action prompt. */}
        <aside className="grid min-h-0 gap-3 xl:grid-rows-[auto_1fr_auto] xl:overflow-hidden">
          <div className="glass-card p-3">
            <p className="label flex items-center gap-1.5">
              <Wrench size={12} className="text-accent-champagne" />
              Tools rail
            </p>
            <nav className="mt-2 grid gap-1.5">
              {TOOL_LINKS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-accent-champagne/25 hover:bg-ink-100/60 dark:hover:bg-ink-950/40"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent-champagne/20 bg-ink-50 text-accent-champagne dark:bg-ink-950/40">
                    <tool.icon size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-ink-900 dark:text-ink-100">
                      {tool.label}
                    </span>
                    <span className="block truncate text-[10.5px] text-ink-500 dark:text-ink-400">
                      {tool.description}
                    </span>
                  </span>
                  <ArrowRight
                    size={13}
                    className="shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-accent-champagne"
                  />
                </Link>
              ))}
            </nav>
          </div>

          <div className="glass-card min-h-0 p-3">
            <p className="label flex items-center gap-1.5">
              <ListChecks size={12} className="text-accent-champagne" />
              Accountability
            </p>
            <ul className="mt-2 space-y-1.5">
              {day.accountability.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12px] leading-snug text-ink-700 dark:text-ink-200"
                >
                  <CircleDashed
                    size={12}
                    className="mt-0.5 shrink-0 text-accent-gold"
                  />
                  {item}
                </li>
              ))}
            </ul>

            <label className="mt-3 block border-t border-accent-champagne/10 pt-3">
              <span className="field-label flex items-center gap-1.5 text-[10px]">
                <NotebookPen size={12} className="text-accent-champagne" />
                Accountability note
              </span>
              <textarea
                aria-label="Accountability note"
                value={form[ACCOUNTABILITY_NOTE_KEY] ?? ""}
                onChange={(e) => updateField(ACCOUNTABILITY_NOTE_KEY, e.target.value)}
                placeholder="Own the next decision, stuck file, or follow-up."
                rows={3}
                className="input mt-1 h-20 resize-none rounded-lg px-2 py-1.5 text-[12px] leading-snug"
              />
              <span className="mt-1 block text-[10px] text-ink-500 dark:text-ink-400">
                Saves with this day.
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-ink-200 bg-white/65 p-3 dark:border-accent-champagne/15 dark:bg-ink-950/30">
            <p className="label">Coaching prompt</p>
            <p className="mt-2 text-[12px] leading-snug text-ink-600 dark:text-ink-300">
              {day.communityPrompt}
            </p>
            <Link
              href="/training/feed"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-gold"
            >
              Post in the feed
              <ArrowRight size={13} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
