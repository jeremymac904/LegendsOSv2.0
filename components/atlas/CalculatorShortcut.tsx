"use client";

import { useState } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";

interface CalculatorShortcutProps {
  /** Fired with the assembled prompt; AtlasShell sets composer text. */
  onPrompt: (prompt: string) => void;
  /** Optionally fire the message immediately rather than just filling the box. */
  onSend?: (prompt: string) => void;
}

/**
 * Sidebar shortcut that pre-fills the composer with a mortgage-calc prompt.
 * Includes a tiny inline form so the user can tweak principal / rate / term
 * before firing, but stays compact when collapsed.
 */
export function CalculatorShortcut({ onPrompt, onSend }: CalculatorShortcutProps) {
  const [open, setOpen] = useState(false);
  const [principal, setPrincipal] = useState(450000);
  const [rate, setRate] = useState(6.625);
  const [term, setTerm] = useState(30);

  function buildPrompt(): string {
    return `Calculate a mortgage for $${principal.toLocaleString()} at ${rate}% for ${term} years.`;
  }

  function quickFill() {
    onPrompt(buildPrompt());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const prompt = buildPrompt();
    if (onSend) onSend(prompt);
    else onPrompt(prompt);
  }

  return (
    <section aria-label="Mortgage calculator shortcut" className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 border-b border-ink-800/70 px-3.5 py-2.5 text-left transition hover:bg-ink-800/30"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-md border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
          >
            <Calculator size={12} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              Quick calc
            </p>
            <p className="text-[10px] text-ink-400">Fire a mortgage calc prompt</p>
          </div>
        </div>
        {open ? (
          <ChevronUp size={13} className="text-ink-300" />
        ) : (
          <ChevronDown size={13} className="text-ink-300" />
        )}
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-2 px-3 py-2.5">
          <label className="block">
            <span className="text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
              Principal
            </span>
            <div className="mt-0.5 flex items-center rounded-lg border border-ink-700/80 bg-ink-900/70 px-2 focus-within:border-accent-gold/40">
              <span className="text-[11px] text-ink-400">$</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={5000}
                value={principal}
                onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
                className="w-full bg-transparent px-1 py-1 text-[12px] text-ink-100 outline-none"
              />
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
                Rate
              </span>
              <div className="mt-0.5 flex items-center rounded-lg border border-ink-700/80 bg-ink-900/70 px-2 focus-within:border-accent-gold/40">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.125}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)}
                  className="w-full bg-transparent px-1 py-1 text-[12px] text-ink-100 outline-none"
                />
                <span className="text-[11px] text-ink-400">%</span>
              </div>
            </label>
            <label className="block">
              <span className="text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
                Term
              </span>
              <div className="mt-0.5 flex items-center rounded-lg border border-ink-700/80 bg-ink-900/70 px-2 focus-within:border-accent-gold/40">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={term}
                  onChange={(e) => setTerm(Number(e.target.value) || 0)}
                  className="w-full bg-transparent px-1 py-1 text-[12px] text-ink-100 outline-none"
                />
                <span className="text-[11px] text-ink-400">yrs</span>
              </div>
            </label>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={quickFill}
              className="btn-secondary h-7 flex-1 px-2 text-[10.5px]"
            >
              Fill composer
            </button>
            <button type="submit" className="btn-primary h-7 flex-1 px-2 text-[10.5px]">
              {onSend ? "Run calc" : "Use prompt"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
