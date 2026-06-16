"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, LayoutGrid, Puzzle, Sparkles } from "lucide-react";

const ITEMS = [
  { href: "/settings", label: "Settings", icon: LayoutGrid },
  { href: "/settings/ai-preferences", label: "AI Voice", icon: Sparkles },
  { href: "/settings/assistant-memory", label: "Memory", icon: Brain },
  { href: "/settings/skills", label: "Skills", icon: Puzzle },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/settings"
            ? pathname === "/settings"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition " +
              (active
                ? "border-accent-gold/50 bg-accent-gold/15 text-accent-gold"
                : "border-ink-200 bg-ink-50 text-ink-600 hover:border-accent-champagne/40 hover:text-accent-champagne dark:border-accent-champagne/12 dark:bg-ink-950/40 dark:text-ink-300")
            }
          >
            <Icon size={13} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
