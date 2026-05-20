"use client";

import { TrendingUp } from "lucide-react";

interface Row {
  label: string;
  rate: string;
  apr: string;
  trend: "up" | "down" | "flat";
}

const SAMPLE_RATES: Row[] = [
  { label: "30-yr Conv", rate: "6.625%", apr: "6.785%", trend: "down" },
  { label: "15-yr Conv", rate: "5.875%", apr: "6.040%", trend: "flat" },
  { label: "30-yr VA", rate: "6.250%", apr: "6.402%", trend: "down" },
  { label: "30-yr FHA", rate: "6.375%", apr: "7.020%", trend: "up" },
];

function trendGlyph(t: Row["trend"]): { ch: string; tone: string } {
  if (t === "up") return { ch: "▲", tone: "text-status-err" };
  if (t === "down") return { ch: "▼", tone: "text-status-ok" };
  return { ch: "■", tone: "text-ink-400" };
}

/**
 * Sample rate sheet widget. Marks itself mock — wire to the rate-feed
 * connector once available.
 */
export function RateSheetWidget() {
  return (
    <section
      aria-label="Rate sheet"
      className="card overflow-hidden"
      data-mock="true"
    >
      <header className="flex items-center justify-between gap-2 border-b border-ink-800/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-md border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
          >
            <TrendingUp size={12} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              Rate sheet
            </p>
            <p className="text-[10px] text-ink-400">Today's snapshot</p>
          </div>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.14em] text-amber-300">
          Sample
        </span>
      </header>
      <div className="px-2 py-2">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
              <th className="px-1.5 py-1 text-left font-medium">Product</th>
              <th className="px-1.5 py-1 text-right font-medium">Rate</th>
              <th className="px-1.5 py-1 text-right font-medium">APR</th>
              <th className="px-1.5 py-1 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_RATES.map((r) => {
              const g = trendGlyph(r.trend);
              return (
                <tr
                  key={r.label}
                  className="border-t border-ink-800/40 last:border-b"
                >
                  <td className="px-1.5 py-1 text-ink-100">{r.label}</td>
                  <td className="px-1.5 py-1 text-right font-semibold text-ink-100">
                    {r.rate}
                  </td>
                  <td className="px-1.5 py-1 text-right text-ink-300">{r.apr}</td>
                  <td className={`px-1.5 py-1 text-right text-[10px] ${g.tone}`}>
                    {g.ch}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1.5 px-1 text-[9.5px] leading-snug text-ink-400">
          Sample rates — Atlas connector pending.
        </p>
      </div>
    </section>
  );
}
