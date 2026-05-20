"use client";

import { Briefcase } from "lucide-react";

const MOCK_BUCKETS = [
  { label: "New", count: 4, tone: "text-accent-gold" },
  { label: "Working", count: 6, tone: "text-status-info" },
  { label: "Pre-approved", count: 2, tone: "text-status-ok" },
];

const TOTAL = MOCK_BUCKETS.reduce((s, b) => s + b.count, 0);

/**
 * Sample pipeline widget. Marks itself as mock with both a visible label and
 * a data-mock attribute so QA can grep it out before wiring `/leads`.
 */
export function PipelineWidget() {
  return (
    <section
      aria-label="My pipeline"
      className="card overflow-hidden"
      data-mock="true"
    >
      <header className="flex items-center justify-between gap-2 border-b border-ink-800/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-md border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
          >
            <Briefcase size={12} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              My pipeline
            </p>
            <p className="text-[10px] text-ink-400">{TOTAL} active leads</p>
          </div>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.14em] text-amber-300">
          Sample
        </span>
      </header>
      <div className="px-3 py-2.5">
        <ul className="space-y-1.5">
          {MOCK_BUCKETS.map((b) => (
            <li
              key={b.label}
              className="flex items-center justify-between gap-2 rounded-lg border border-ink-800/60 bg-ink-900/40 px-2 py-1.5"
            >
              <span className="text-[11px] font-medium text-ink-100">
                {b.label}
              </span>
              <span className={`text-[12px] font-semibold ${b.tone}`}>
                {b.count}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[9.5px] leading-snug text-ink-400">
          Sample data — wire to /leads when available.
        </p>
      </div>
    </section>
  );
}
