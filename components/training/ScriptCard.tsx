"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Client card for the Scripts Library. The page is a Server Component (it loads
// the profile), so the interactive Copy button must live in a client component
// — passing an onClick from a server component is what threw
// "Event handlers cannot be passed to Client Component props".

export interface ScriptItem {
  category: string;
  title: string;
  body: string;
}

export function ScriptCard({ script }: { script: ScriptItem }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(script.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className="glass-card-padded space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
          {script.category}
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-champagne transition hover:text-accent-gold"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy script"}
        </button>
      </div>
      <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">
        {script.title}
      </h3>
      <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 dark:border-accent-champagne/10 dark:bg-ink-950/50">
        <p className="text-sm italic leading-relaxed text-ink-700 dark:text-ink-300">
          &quot;{script.body}&quot;
        </p>
      </div>
    </div>
  );
}
