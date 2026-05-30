import { MessageCircle, ShieldCheck } from "lucide-react";

import {
  LEGENDS_ASSISTANTS,
  wiringStatusLabel,
} from "@/lib/legends/assistants";

/**
 * Static catalog card showing the three Legends Atlas assistants planned for
 * wiring. No live model calls. No links into /atlas because the assistants
 * are not yet seeded in the live `atlas_assistants` table — this surface is
 * a draft preview only.
 */
export function LegendsAssistantsCatalog() {
  return (
    <section className="glass-card-padded">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-accent-champagne/25 bg-ink-950/40 text-accent-champagne dark:bg-ink-950/40">
            <MessageCircle size={14} />
          </span>
          <div>
            <p className="label">Atlas Hub · Preview</p>
            <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
              Legends Assistants — Catalog only
            </h2>
          </div>
        </div>
        <span className="chip flex items-center gap-1">
          <ShieldCheck size={11} />
          Not yet wired
        </span>
      </header>
      <p className="mt-3 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
        Three Legends Atlas assistants will land inside <code className="text-[12px]">/atlas</code> once Jeremy approves
        live wiring and the provider gate is flipped. Until then, they are
        catalog drafts. No live model calls, no database writes.
      </p>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {LEGENDS_ASSISTANTS.map((assistant) => (
          <li
            key={assistant.slug}
            className="rounded-2xl border border-accent-champagne/12 bg-ink-950/25 p-4 dark:bg-ink-950/25"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                {assistant.displayName}
              </h3>
              {assistant.isDefault && (
                <span className="chip-active">Default</span>
              )}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
              {assistant.shortDescription}
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
              Scope
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-[12px] text-ink-600 dark:text-ink-300">
              {assistant.scope.slice(0, 3).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <span className="chip">{wiringStatusLabel(assistant.wiringStatus)}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Wiring path lives in <code className="text-[11px]">lib/legends/assistants.ts</code> and{" "}
        <code className="text-[11px]">supabase/seeds/legends_assistants.sql</code>. The seed is
        intentionally NOT auto-applied; Jeremy runs it manually after sign-off.
      </p>
    </section>
  );
}
