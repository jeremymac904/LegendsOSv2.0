"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, ChartLine, LayoutDashboard, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/usage", label: "Usage", icon: ChartLine },
  { href: "/admin/assets", label: "Assets", icon: ImageIcon },
];

// Shared top nav for every Admin surface so the four pages read as one
// tabbed product instead of four disconnected screens. Active tab is
// resolved from the pathname (exact match for /admin, prefix for the rest).
export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap gap-1.5 rounded-2xl border border-ink-200 bg-white p-1.5 dark:border-ink-800 dark:bg-ink-900/40"
    >
      {LINKS.map((l) => {
        const Icon = l.icon;
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition",
              active
                ? "bg-accent-gold/10 text-accent-gold shadow-sm"
                : "text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/50 dark:hover:text-ink-100"
            )}
          >
            <Icon size={14} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
