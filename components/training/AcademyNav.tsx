"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  Gem,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Megaphone,
  Newspaper,
  Sparkles,
  Trophy,
} from "lucide-react";

// Sub-navigation shared across the Legends Mortgage Academy surfaces.
const ITEMS = [
  { href: "/coaching", label: "Overview", icon: LayoutGrid },
  { href: "/training/feed", label: "Feed", icon: Newspaper },
  { href: "/training/today", label: "Today", icon: CalendarCheck },
  { href: "/training/scorecard", label: "Scorecard", icon: ListChecks },
  { href: "/training/academy", label: "Academy", icon: GraduationCap },
  { href: "/training/resources", label: "Resources", icon: Megaphone },
  { href: "/training/elite", label: "Elite", icon: Gem },
  { href: "/training/ai-advantage", label: "AI Advantage", icon: Sparkles },
  { href: "/training", label: "Training", icon: Trophy },
];

export function AcademyNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/training"
            ? pathname === "/training"
            : pathname === item.href;
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
