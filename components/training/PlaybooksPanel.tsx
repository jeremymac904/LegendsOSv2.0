"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ListChecks, RotateCcw, Target } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { Accordion, type AccordionItemData } from "@/components/ui/Accordion";
import TrackersPanel from "@/components/training/TrackersPanel";
import {
  PLAYBOOKS_STORAGE_KEY,
  playbooks,
  type Playbook,
  type PlaybookProgress,
} from "@/lib/legends/playbooks";
import { cn } from "@/lib/utils";

// Legends Mortgage Academy — Playbooks. Step-by-step plays with checkable
// steps (persisted to localStorage) and per-playbook progress, plus the
// Execution Trackers embedded beneath. Self-contained: no props required.

function readProgress(): PlaybookProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PLAYBOOKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as PlaybookProgress;
  } catch {
    return {};
  }
}

function writeProgress(progress: PlaybookProgress) {
  try {
    window.localStorage.setItem(PLAYBOOKS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* quota / disabled — ignore */
  }
}

interface PlaybookBodyProps {
  playbook: Playbook;
  checked: number[];
  onToggleStep: (stepIndex: number) => void;
  onReset: () => void;
}

function PlaybookBody({ playbook, checked, onToggleStep, onReset }: PlaybookBodyProps) {
  const done = checked.length;
  const total = playbook.steps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* When to use */}
      <div>
        <p className="label">When to use</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-700 dark:text-ink-300">
          {playbook.whenToUse}
        </p>
      </div>

      {/* Checkable steps */}
      <div>
        <p className="label">Steps</p>
        <ul className="mt-1.5 space-y-0.5">
          {playbook.steps.map((step, index) => {
            const isChecked = checked.includes(index);
            return (
              <li key={index}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isChecked}
                  onClick={() => onToggleStep(index)}
                  className="group flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-accent-gold/[0.05]"
                >
                  <span
                    className={cn(
                      "mt-px grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                      isChecked
                        ? "border-accent-gold/60 bg-accent-gold/15 text-accent-gold"
                        : "border-ink-300 text-transparent group-hover:border-accent-champagne/50 dark:border-ink-600",
                    )}
                  >
                    <Check size={13} strokeWidth={3} aria-hidden />
                  </span>
                  <span
                    className={cn(
                      "text-sm leading-relaxed transition-colors",
                      isChecked
                        ? "text-ink-500 line-through decoration-ink-400/60 dark:text-ink-400"
                        : "text-ink-900 dark:text-ink-100",
                    )}
                  >
                    {step}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200/70 dark:bg-ink-800/70">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              pct >= 100 ? "bg-status-ok" : "bg-gradient-to-r from-accent-gold to-accent-orange",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={cn(
            "text-[11px] font-bold tabular-nums",
            pct >= 100 ? "text-status-ok" : "text-accent-champagne",
          )}
        >
          {done}/{total} · {pct}%
        </span>
        {done > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="btn-ghost !px-2 !py-1 text-[11.5px]"
            aria-label={`Reset ${playbook.title} progress`}
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
      </div>

      {/* Outcome */}
      <div className="rounded-xl border border-accent-champagne/20 bg-ink-50 px-4 py-3 dark:bg-ink-950/40">
        <p className="label flex items-center gap-1.5">
          <Target size={11} className="text-accent-champagne" aria-hidden /> Outcome
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-700 dark:text-ink-200">
          {playbook.outcome}
        </p>
      </div>
    </div>
  );
}

export default function PlaybooksPanel() {
  const [progress, setProgress] = useState<PlaybookProgress>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(readProgress());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeProgress(progress);
  }, [hydrated, progress]);

  function toggleStep(playbookKey: string, stepIndex: number) {
    setProgress((current) => {
      const checked = current[playbookKey] ?? [];
      const next = checked.includes(stepIndex)
        ? checked.filter((i) => i !== stepIndex)
        : [...checked, stepIndex].sort((a, b) => a - b);
      return { ...current, [playbookKey]: next };
    });
  }

  function resetPlaybook(playbookKey: string) {
    setProgress((current) => ({ ...current, [playbookKey]: [] }));
  }

  const completedCount = useMemo(
    () =>
      playbooks.filter((p) => (progress[p.key] ?? []).length >= p.steps.length).length,
    [progress],
  );

  const items: AccordionItemData[] = playbooks.map((playbook) => {
    const checked = progress[playbook.key] ?? [];
    const done = checked.length;
    const total = playbook.steps.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      id: playbook.key,
      title: playbook.title,
      icon: ListChecks,
      meta: (
        <span className="inline-flex items-center gap-2">
          <span className="hidden uppercase tracking-[0.08em] sm:inline">
            {playbook.category}
          </span>
          <span
            className={cn(
              "font-bold tabular-nums",
              pct >= 100 ? "text-status-ok" : "text-accent-champagne",
            )}
          >
            {pct}%
          </span>
        </span>
      ),
      children: (
        <PlaybookBody
          playbook={playbook}
          checked={checked}
          onToggleStep={(stepIndex) => toggleStep(playbook.key, stepIndex)}
          onReset={() => resetPlaybook(playbook.key)}
        />
      ),
    };
  });

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          eyebrow="Legends Mortgage Academy"
          title="Playbooks"
          description="Step-by-step plays for partners, conversion, follow-up, and pipeline. Check off each step as you run it — progress saves automatically."
          action={
            <span className={completedCount > 0 ? "chip-active" : "chip"}>
              {completedCount}/{playbooks.length} complete
            </span>
          }
        />
        <Accordion items={items} />
      </section>

      <section>
        <SectionHeader
          title="Execution Trackers"
          description="The lightweight lists behind the playbooks — keep them open next to your LOS and bring snapshots to the weekly group coaching call."
        />
        <TrackersPanel />
      </section>
    </div>
  );
}
