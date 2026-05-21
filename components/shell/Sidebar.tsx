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
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-accent-champagne/10 bg-ink-950/78 px-3 py-5 backdrop-blur-xl lg:flex relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-accent-champagne/20 to-transparent"
      />

      <div className="px-2">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <div className="flex h-11 w-36 shrink-0 items-center rounded-xl border border-accent-gold/20 bg-ink-950/40 px-2 shadow-glass">
            <img
              src="/assets/logos/legends-os-logo.png"
              alt="LegendsOS"
              className="h-9 w-full object-contain"
            />
          </div>
          <div className="sr-only">
            <p className="text-sm font-semibold tracking-tight text-ink-100">
              LegendsOS
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
                                ? "text-accent-champagne"
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
                              ? "text-accent-champagne opacity-100"
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
        <div className="relative overflow-hidden rounded-2xl border border-accent-champagne/10 bg-ink-950/40 p-3 backdrop-blur-sm">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-accent-champagne/30 to-transparent"
          />
          <p className="truncate text-xs font-medium text-ink-100">
            {profile.full_name ?? profile.email}
          </p>
          <p className="truncate text-[11px] text-ink-400">{profile.email}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-champagne">
            <span
              aria-hidden
              className="inline-block h-1 w-1 rounded-full bg-accent-champagne shadow-[0_0_6px_rgba(199,150,53,0.52)]"
            />
            {profile.role}
          </p>
        </div>
      </div>
    </aside>
  );
}
