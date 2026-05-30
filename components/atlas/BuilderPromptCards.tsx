"use client";

import { cn } from "@/lib/utils";
import { BUILDER_PROMPT_CARDS } from "@/lib/atlas/builderPrompts";

export interface BuilderPromptCardsProps {
  /** Called with the card's full prompt string when a card is clicked. */
  onPick: (prompt: string) => void;
  /** Denser layout for tight spaces (e.g. inside the empty chat card). */
  compact?: boolean;
}

export function BuilderPromptCards({ onPick, compact = false }: BuilderPromptCardsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2 sm:grid-cols-2",
        compact ? "lg:grid-cols-2" : "lg:grid-cols-4",
      )}
    >
      {BUILDER_PROMPT_CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onPick(card.prompt)}
            className="group flex flex-col gap-1.5 rounded-xl border border-accent-champagne/10 bg-white/40 dark:bg-ink-950/40 px-3 py-2.5 text-left transition hover:border-accent-champagne/30 hover:bg-accent-gold/5"
          >
            <span className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-accent-champagne/15 bg-accent-gold/10 text-accent-gold transition group-hover:border-accent-champagne/30">
                <Icon size={15} />
              </span>
              <span className="text-[12px] font-semibold text-ink-900 dark:text-ink-100">
                {card.title}
              </span>
            </span>
            {!compact && (
              <span className="text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
                {card.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default BuilderPromptCards;
