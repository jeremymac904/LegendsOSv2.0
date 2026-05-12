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
        className="btn-ghost fixed bottom-5 right-5 z-30 rounded-full border border-ink-700 bg-ink-900/90 px-4 py-3 shadow-glow"
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
          <div className="relative ml-auto h-full w-72 overflow-y-auto border-l border-ink-800 bg-ink-950 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-100">Navigation</p>
              <button
                className="btn-ghost"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <ul className="mt-4 space-y-1">
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
                        <Icon size={16} className="text-ink-300" />
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
