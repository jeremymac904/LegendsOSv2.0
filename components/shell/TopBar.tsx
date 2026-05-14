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
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-ink-800/70 bg-ink-950/65 px-5 py-3 backdrop-blur-md relative">
      {/* Bottom gold seam — faint, just to anchor the band. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-accent-gold/20 to-transparent"
      />
      <div className="flex flex-1 items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-accent-gold shadow-[0_0_8px_rgba(245,180,0,0.7)]"
          />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">
              {current?.section ?? "LegendsOS"}
            </p>
            <h1 className="text-sm font-semibold tracking-tight text-ink-100">
              {current?.label ?? "Command Center"}
            </h1>
          </div>
        </div>
        <div className="ml-6 hidden flex-1 max-w-md items-center gap-2 rounded-xl border border-ink-800/80 bg-ink-900/60 px-3 py-1.5 text-xs text-ink-300 backdrop-blur-sm transition-colors focus-within:border-accent-gold/40 md:flex">
          <Search size={14} className="text-ink-400" />
          <input
            placeholder="Search threads, drafts, knowledge…"
            className="flex-1 bg-transparent outline-none placeholder:text-ink-400"
          />
          <span className="rounded-md border border-ink-800 bg-ink-900/80 px-1.5 py-0.5 font-mono text-[10px] text-ink-400">
            ⌘ K
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-ghost px-2 py-2" aria-label="Notifications">
          <Bell size={16} />
        </button>
        <div className="hidden items-center gap-3 rounded-xl border border-ink-800/70 bg-ink-900/55 px-3 py-1.5 backdrop-blur-sm md:flex">
          <div className="flex flex-col text-right leading-tight">
            <span className="text-xs font-medium text-ink-100">
              {profile.full_name ?? profile.email}
            </span>
            <span className="flex items-center justify-end gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-gold">
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full bg-accent-gold shadow-[0_0_6px_rgba(245,180,0,0.7)]"
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
