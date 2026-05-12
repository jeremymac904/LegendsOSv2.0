"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Search } from "lucide-react";

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
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-ink-800/80 bg-ink-950/70 px-5 py-3 backdrop-blur-md">
      <div className="flex flex-1 items-center gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            {current?.section ?? "LegendsOS"}
          </p>
          <h1 className="text-sm font-semibold text-ink-100">
            {current?.label ?? "Command Center"}
          </h1>
        </div>
        <div className="ml-6 hidden flex-1 max-w-md items-center gap-2 rounded-xl border border-ink-800 bg-ink-900/70 px-3 py-1.5 text-xs text-ink-300 md:flex">
          <Search size={14} />
          <input
            placeholder="Search threads, drafts, knowledge…"
            className="flex-1 bg-transparent outline-none placeholder:text-ink-400"
          />
          <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300">
            ⌘ K
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-ghost px-2 py-2" aria-label="Notifications">
          <Bell size={16} />
        </button>
        <div className="hidden flex-col items-end text-right md:flex">
          <span className="text-xs font-medium text-ink-100">
            {profile.full_name ?? profile.email}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-accent-gold">
            {profile.role}
          </span>
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
