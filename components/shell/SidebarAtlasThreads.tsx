"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, MessageCirclePlus } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatRelative, truncate } from "@/lib/utils";

interface ThreadRow {
  id: string;
  title: string;
  last_message_at: string | null;
  updated_at: string;
}

// Renders inside the existing left sidebar, immediately under the Atlas Chat
// nav item. Behaves like ChatGPT's chat history: a collapsible list of
// recent threads, plus a "New chat" link. Only fetches data when we're on an
// /atlas* path so we don't waste round-trips elsewhere.
export function SidebarAtlasThreads() {
  const pathname = usePathname();
  const onAtlas = pathname.startsWith("/atlas");
  const [open, setOpen] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!onAtlas) return;
    let cancelled = false;
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("chat_threads")
      .select("id,title,last_message_at,updated_at")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (cancelled) return;
        setThreads(((data ?? []) as ThreadRow[]) || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onAtlas, pathname]);

  if (!onAtlas) return null;

  const currentThreadId = pathname.match(/^\/atlas\/([0-9a-f-]+)/i)?.[1];

  return (
    <div className="mt-1 space-y-1 pl-3 pr-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-ink-400 hover:text-ink-200"
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Recent
        </button>
        <Link
          href="/atlas"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-ink-300 hover:bg-ink-800/70 hover:text-ink-100"
          title="Start a new conversation"
        >
          <MessageCirclePlus size={11} />
          New
        </Link>
      </div>
      {open && (
        <ul className="space-y-0.5">
          {loading && threads.length === 0 && (
            <li className="px-2 py-1 text-[11px] text-ink-400">Loading…</li>
          )}
          {!loading && threads.length === 0 && (
            <li className="px-2 py-1 text-[11px] text-ink-400">
              No conversations yet.
            </li>
          )}
          {threads.map((t) => {
            const active = currentThreadId === t.id;
            return (
              <li key={t.id}>
                <Link
                  href={`/atlas/${t.id}`}
                  className={cn(
                    "block truncate rounded-md px-2 py-1 text-[11px] transition",
                    active
                      ? "bg-accent-gold/15 text-accent-gold"
                      : "text-ink-200 hover:bg-ink-800/60 hover:text-ink-100"
                  )}
                  title={`${t.title}\n${formatRelative(
                    t.last_message_at ?? t.updated_at
                  )}`}
                >
                  {truncate(t.title || "Untitled", 26)}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
