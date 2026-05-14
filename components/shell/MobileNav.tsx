"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { NAV_ITEMS } from "@/lib/navigation";
import { canSee } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

export function MobileNav({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center justify-center gap-2 rounded-full border border-accent-gold/40 bg-gradient-to-br from-accent-gold to-accent-orange px-4 py-3 text-ink-950 shadow-glow transition-transform hover:scale-[1.03]"
        aria-label="Open navigation"
      >
        <Menu size={16} />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative ml-auto h-full w-72 overflow-y-auto border-l border-ink-800/80 bg-ink-950/95 p-4 backdrop-blur-md">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-accent-gold/20 to-transparent"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent-orange to-accent-gold text-xs font-black text-ink-950 shadow-glow-sm">
                  L
                </div>
                <p className="text-sm font-semibold tracking-tight text-ink-100">
                  LegendsOS
                </p>
              </div>
              <button
                className="btn-ghost"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <p className="mt-4 px-1 text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">
              Navigation
            </p>
            <ul className="mt-2 space-y-0.5">
              {NAV_ITEMS.filter((item) => canSee(profile, item.gate ?? {})).map(
                (item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(active ? "nav-item-active" : "nav-item")}
                      >
                        <Icon
                          size={16}
                          className={
                            active ? "text-accent-gold" : "text-ink-400"
                          }
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                }
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
