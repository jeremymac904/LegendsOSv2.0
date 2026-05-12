"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { NAV_ITEMS, NAV_SECTIONS } from "@/lib/navigation";
import { canSee } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

import { SidebarAtlasThreads } from "./SidebarAtlasThreads";

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-800/80 bg-ink-950/80 px-3 py-5 lg:flex">
      <div className="px-2">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-orange to-accent-gold text-sm font-black text-ink-950 shadow-glow">
            L
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink-100">
              LegendsOS
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
              v2.0 · internal
            </p>
          </div>
        </Link>
      </div>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1 scrollbar-thin">
        {NAV_SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter(
            (item) =>
              item.section === section.key && canSee(profile, item.gate ?? {})
          );
          if (items.length === 0) return null;
          return (
            <div key={section.key}>
              <p className="px-3 text-[10px] uppercase tracking-[0.18em] text-ink-400">
                {section.label}
              </p>
              <ul className="mt-2 space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group",
                          active ? "nav-item-active" : "nav-item",
                          "justify-between"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Icon
                            size={16}
                            className={
                              active ? "text-accent-gold" : "text-ink-300"
                            }
                          />
                          {item.label}
                        </span>
                        <ChevronRight
                          size={14}
                          className={cn(
                            "transition-transform",
                            active
                              ? "text-accent-gold opacity-100"
                              : "text-ink-400 opacity-0 group-hover:opacity-100"
                          )}
                        />
                      </Link>
                      {item.href === "/atlas" && <SidebarAtlasThreads />}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-ink-800/70 pt-4">
        <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-3">
          <p className="text-xs font-medium text-ink-100">{profile.full_name ?? profile.email}</p>
          <p className="text-[11px] text-ink-300">{profile.email}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-accent-gold">
            {profile.role}
          </p>
        </div>
      </div>
    </aside>
  );
}
