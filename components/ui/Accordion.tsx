"use client";

import { useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AccordionItemData {
  id: string;
  title: string;
  /** Optional short text shown to the right of the title (e.g. a count or status). */
  meta?: React.ReactNode;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItemData[];
  /**
   * When false, opening one item closes the others. Defaults to true so several
   * sections can stay open at once.
   */
  allowMultiple?: boolean;
  className?: string;
}

/**
 * Dark-gold-glass accordion for collapsing long stacked sections.
 * Accessible: each header is a real <button> with aria-expanded / aria-controls,
 * the panel is labelled by its header, and the chevron rotates on open.
 */
export function Accordion({
  items,
  allowMultiple = true,
  className,
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<string[]>(() =>
    items.filter((i) => i.defaultOpen).map((i) => i.id)
  );

  function toggle(id: string): void {
    setOpenIds((prev) => {
      const isOpen = prev.includes(id);
      if (allowMultiple) {
        return isOpen ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return isOpen ? [] : [id];
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          item={item}
          open={openIds.includes(item.id)}
          onToggle={() => toggle(item.id)}
        />
      ))}
    </div>
  );
}

interface AccordionItemProps {
  item: AccordionItemData;
  open: boolean;
  onToggle: () => void;
}

export function AccordionItem({ item, open, onToggle }: AccordionItemProps) {
  const { id, title, meta, icon: Icon } = item;
  const headerId = `accordion-header-${id}`;
  const panelId = `accordion-panel-${id}`;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        open
          ? "border-accent-gold/30 bg-ink-950/40"
          : "border-ink-200 bg-white/60 dark:border-ink-800 dark:bg-ink-950/30"
      )}
    >
      <h3>
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
            "hover:bg-accent-gold/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold/50"
          )}
        >
          {Icon && (
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
                open
                  ? "border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-200 bg-ink-950/30 text-ink-300 dark:border-ink-800"
              )}
            >
              <Icon size={16} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">
              {title}
            </span>
          </span>
          {meta && (
            <span className="shrink-0 text-[11px] text-ink-400 dark:text-ink-300">
              {meta}
            </span>
          )}
          <ChevronDown
            size={16}
            aria-hidden
            className={cn(
              "shrink-0 text-ink-400 transition-transform duration-200",
              open && "rotate-180 text-accent-gold"
            )}
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        hidden={!open}
        className="border-t border-ink-200/60 px-4 py-4 dark:border-ink-800/60"
      >
        {item.children}
      </div>
    </div>
  );
}
