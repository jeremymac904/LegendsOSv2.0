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
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-800/70 bg-ink-950/85 px-3 py-5 backdrop-blur-md lg:flex relative">
      {/* Faint vertical gold seam on the inside edge of the sidebar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-accent-gold/15 to-transparent"
      />

      <div className="px-2">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-orange to-accent-gold text-sm font-black text-ink-950 shadow-glow">
            L
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent-gold shadow-[0_0_8px_rgba(245,180,0,0.85)]"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-ink-100">
              <span className="bg-gradient-to-r from-ink-100 via-ink-100 to-accent-gold/80 bg-clip-text text-transparent">
                LegendsOS
              </span>
            </p>
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-ink-400">
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full bg-accent-gold/70"
              />
              v2.0 · internal
            </p>
          </div>
        </Link>
      </div>

      <nav className="mt-7 flex-1 space-y-5 overflow-y-auto pr-1 scrollbar-thin">
        {NAV_SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter(
            (item) =>
              item.section === section.key && canSee(profile, item.gate ?? {})
          );
          if (items.length === 0) return null;
          return (
            <div key={section.key}>
              <p className="px-3 text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">
                {section.label}
              </p>
              <ul className="mt-2 space-y-0.5">
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
                              active
                                ? "text-accent-gold"
                                : "text-ink-400 group-hover:text-ink-200"
                            }
                          />
                          {item.label}
                        </span>
                        <ChevronRight
                          size={14}
                          className={cn(
                            "transition-all",
                            active
                              ? "text-accent-gold opacity-100"
                              : "text-ink-400 opacity-0 group-hover:opacity-70"
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
        <div className="relative overflow-hidden rounded-2xl border border-ink-800/80 bg-ink-900/60 p-3 backdrop-blur-sm">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent"
          />
          <p className="truncate text-xs font-medium text-ink-100">
            {profile.full_name ?? profile.email}
          </p>
          <p className="truncate text-[11px] text-ink-400">{profile.email}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-gold">
            <span
              aria-hidden
              className="inline-block h-1 w-1 rounded-full bg-accent-gold shadow-[0_0_6px_rgba(245,180,0,0.7)]"
            />
            {profile.role}
          </p>
        </div>
      </div>
    </aside>
  );
}
