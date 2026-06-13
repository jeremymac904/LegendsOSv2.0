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
    href: "/training/scorecard",
    label: "Scorecard",
    description: "Your weekly numbers and pace",
    icon: BarChart3,
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

  function updateField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setJustSaved(false);
  }

  function handleSave() {
    saveDay(day.key, form);
    setJustSaved(true);
  }

  return (
    <div className="space-y-6">
      {/* Day tabs */}
      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {todayDays.map((d) => {
          const isActive = d.key === day.key;
          const hasSaved = hydrated && Boolean(getDay(d.key));
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveKey(d.key)}
              className={
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition " +
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

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main: theme, video, fields, save */}
        <section className="space-y-5">
          <div className="glass-card-padded">
            <p className="label flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-champagne" />
              {day.day} · {day.theme}
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold text-ink-900 dark:text-ink-100">
              {day.theme}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              {day.instruction}
            </p>

            {/* Jeremy's daily coaching video (HeyGen) */}
            {video && (
              <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-accent-champagne/20 bg-black">
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

            {/* Log fields */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {day.fields.map((field) => {
                const isLong = field.kind === "long";
                return (
                  <label
                    key={field.key}
                    className={
                      "block " + (isLong ? "sm:col-span-2" : "")
                    }
                  >
                    <span className="label flex items-center gap-1.5">
                      {field.label}
                      {field.metric && (
                        <span className="chip text-[9px]">scorecard</span>
                      )}
                    </span>
                    {isLong ? (
                      <textarea
                        aria-label={field.label}
                        value={form[field.key] ?? ""}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        rows={3}
                        className="input mt-1.5 min-h-24 resize-y"
                      />
                    ) : (
                      <input
                        aria-label={field.label}
                        type={field.kind === "number" ? "number" : "text"}
                        inputMode={field.kind === "number" ? "numeric" : undefined}
                        min={field.kind === "number" ? 0 : undefined}
                        value={form[field.key] ?? ""}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        className="input mt-1.5"
                      />
                    )}
                  </label>
                );
              })}
            </div>

            {/* Save row */}
            <div className="mt-5 flex flex-col gap-3 border-t border-accent-champagne/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-ink-600 dark:text-ink-300">
                  {filled} of {day.fields.length} fields filled
                </p>
                {(justSaved || saved) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-status-ok">
                    <CheckCircle2 size={12} className="shrink-0" />
                    Saved{" "}
                    {justSaved
                      ? "just now"
                      : saved
                        ? relativeSaved(saved.savedAt)
                        : ""}{" "}
                    — rolled into your scorecard
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hydrated}
                className="btn-primary shrink-0 disabled:opacity-50"
              >
                <Save size={15} />
                Save day
              </button>
            </div>

            {/* What do I do next — appears once the day is logged. Fridays
                point at the Scorecard submit; every other day points at the
                day's Feed question. */}
            {(justSaved || saved) && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-accent-gold/25 bg-accent-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="label flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-accent-gold" />
                    What&apos;s next
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700 dark:text-ink-200">
                    {day.key === "friday"
                      ? "Your numbers are rolled in. Review the week and submit your scorecard to your coach before the weekly group coaching call."
                      : day.communityPrompt}
                  </p>
                </div>
                <Link
                  href={day.key === "friday" ? "/training/scorecard" : "/training/feed"}
                  className="btn-ghost shrink-0"
                >
                  {day.key === "friday" ? "Open Scorecard" : "Answer in the Feed"}
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Sidebar: tools + accountability + community */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="glass-card-padded">
            <p className="label flex items-center gap-1.5">
              <Wrench size={12} className="text-accent-champagne" />
              Tools rail
            </p>
            <nav className="mt-3 space-y-1.5">
              {TOOL_LINKS.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 transition hover:border-accent-champagne/25 hover:bg-ink-100/60 dark:hover:bg-ink-950/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-champagne/20 bg-ink-50 text-accent-champagne dark:bg-ink-950/40">
                    <tool.icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-ink-900 dark:text-ink-100">
                      {tool.label}
                    </span>
                    <span className="block truncate text-[11px] text-ink-500 dark:text-ink-400">
                      {tool.description}
                    </span>
                  </span>
                  <ArrowRight
                    size={14}
                    className="shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-accent-champagne"
                  />
                </Link>
              ))}
            </nav>
          </div>

          <div className="glass-card-padded">
            <p className="label flex items-center gap-1.5">
              <ListChecks size={12} className="text-accent-champagne" />
              This day&apos;s accountability
            </p>
            <ul className="mt-3 space-y-2.5">
              {day.accountability.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-700 dark:text-ink-200"
                >
                  <CircleDashed
                    size={14}
                    className="mt-0.5 shrink-0 text-accent-gold"
                  />
                  {item}
                </li>
              ))}
            </ul>

            {/* Free-form accountability note — saved with the day log. */}
            <label className="mt-4 block border-t border-accent-champagne/10 pt-4">
              <span className="field-label flex items-center gap-1.5">
                <NotebookPen size={12} className="text-accent-champagne" />
                Accountability note
              </span>
              <textarea
                aria-label="Accountability note"
                value={form[ACCOUNTABILITY_NOTE_KEY] ?? ""}
                onChange={(e) => updateField(ACCOUNTABILITY_NOTE_KEY, e.target.value)}
                placeholder="Answer the checks above — what you'll own from today."
                rows={3}
                className="textarea mt-1.5 min-h-20"
              />
              <span className="mt-1 block text-[10.5px] text-ink-500 dark:text-ink-400">
                Saves with your day log when you hit Save day.
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-accent-champagne/15 bg-ink-950/30 p-5">
            <p className="label">Community prompt</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
              {day.communityPrompt}
            </p>
            <Link href="/training/feed" className="btn-ghost mt-4 w-full">
              Post in the feed
              <ArrowRight size={14} />
            </Link>
          </div>

          {firstName && (
            <p className="px-1 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
              {firstName}, log it daily — the week only counts when it&apos;s
              written down.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
