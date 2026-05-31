import Link from "next/link";
import { type LucideIcon } from "lucide-react";

export interface QuickLaunchTile {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Compact quick-launch grid — small tiles (icon + label), NOT big cards.
 * Every tile links to a real, existing route (validated against
 * lib/navigation.ts). No dead tiles, no filler. Dual-theme, high-contrast.
 */
export function QuickLaunch({ tiles }: { tiles: QuickLaunchTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3 py-2.5 transition hover:border-accent-gold/40 hover:shadow-glow dark:border-ink-800 dark:bg-ink-950/40"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent-orange/30 to-accent-gold/25 text-accent-gold transition-transform group-hover:scale-105">
            <Icon size={15} aria-hidden />
          </span>
          <span className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
            {label}
          </span>
        </Link>
      ))}
    </div>
  );
}
