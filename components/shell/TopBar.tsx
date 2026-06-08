"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { DesktopStatusBadge } from "@/components/desktop/DesktopRuntime";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NAV_ITEMS } from "@/lib/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export function TopBar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();

  const current = NAV_ITEMS.find((item) => {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });

  async function handleSignOut() {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="theme-shell desktop-titlebar-drag desktop-mac-traffic-offset shrink-0 z-20 flex items-center justify-between gap-4 border-b border-ink-900/10 px-5 py-3 relative dark:border-accent-champagne/10">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-accent-champagne/30 to-transparent dark:via-accent-champagne/20"
      />
      <div className="flex flex-1 items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-accent-champagne shadow-[0_0_8px_rgba(199,150,53,0.52)]"
          />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-500 dark:text-ink-400">
              {current?.section ?? "LegendsOS"}
            </p>
            <h1 className="text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-100">
              {current?.label ?? "Command Center"}
            </h1>
          </div>
        </div>
        <DesktopStatusBadge className="hidden xl:inline-flex" compact />
      </div>
      <div className="desktop-no-drag flex items-center gap-2">
        <ThemeToggle />
        <div className="hidden items-center gap-3 rounded-xl border border-ink-900/10 bg-white/70 px-3 py-1.5 backdrop-blur-sm dark:border-accent-champagne/10 dark:bg-ink-950/40 md:flex">
          <div className="flex flex-col text-right leading-tight">
            <span className="text-xs font-medium text-ink-900 dark:text-ink-100">
              {profile.full_name ?? profile.email}
            </span>
            <span className="flex items-center justify-end gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-orange dark:text-accent-champagne">
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full bg-accent-champagne shadow-[0_0_6px_rgba(199,150,53,0.52)]"
              />
              {profile.role}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="btn-ghost"
          aria-label="Sign out"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
