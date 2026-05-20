"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Mail,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface QuickActionsBarProps {
  onPick: (prompt: string) => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  /** If set, clicking sets the composer text. */
  prompt?: string;
  /** If set, renders as a link to a different studio. */
  href?: string;
  /** If set, opens a dropdown of preset prompts. */
  options?: { label: string; prompt: string }[];
}

const ACTIONS: QuickAction[] = [
  {
    id: "rate-sheet",
    label: "Rate sheet",
    icon: TrendingUp,
    options: [
      {
        label: "Today's rates (conv/FHA/VA)",
        prompt:
          "Give me today's rate snapshot across 30-yr conventional, 15-yr conventional, FHA, and VA.",
      },
      {
        label: "Compare 30-yr conv vs FHA at $450k",
        prompt:
          "Compare a 30-year conventional vs FHA loan at $450,000 with current rates.",
      },
      {
        label: "What's a good rate for 720 FICO?",
        prompt:
          "What's a competitive rate range right now for a borrower with a 720 FICO, 20% down, 30-year conventional?",
      },
    ],
  },
  {
    id: "lead-status",
    label: "Lead status",
    icon: Users,
    options: [
      {
        label: "Pull my active pipeline",
        prompt: "Show me a summary of my active leads — status, stage, next step.",
      },
      {
        label: "Who's stuck this week?",
        prompt:
          "Which leads in my pipeline haven't had activity in the last 7 days? Suggest next steps.",
      },
    ],
  },
  {
    id: "draft-email",
    label: "Draft email",
    icon: Mail,
    href: "/email?new=1",
  },
  {
    id: "trigger-automation",
    label: "Trigger automation",
    icon: Workflow,
    options: [
      {
        label: "Start new-lead drip",
        prompt:
          "Trigger the new-lead drip automation for the latest borrower I added.",
      },
      {
        label: "Send rate-watch alert",
        prompt:
          "Trigger the rate-watch alert workflow for clients waiting on a sub-7% rate.",
      },
    ],
  },
];

export function QuickActionsBar({ onPick }: QuickActionsBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpenId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenId(null);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  return (
    <div
      ref={rootRef}
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Atlas quick actions"
    >
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        if (a.href) {
          return (
            <Link
              key={a.id}
              href={a.href}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-ink-700/80 bg-ink-900/70 px-2.5 text-[10.5px] font-medium text-ink-200 backdrop-blur-sm transition hover:border-accent-gold/50 hover:text-accent-gold"
            >
              <Icon size={11} />
              {a.label}
            </Link>
          );
        }
        if (a.options && a.options.length > 0) {
          const open = openId === a.id;
          return (
            <div key={a.id} className="relative">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : a.id)}
                aria-haspopup="menu"
                aria-expanded={open}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] font-medium backdrop-blur-sm transition",
                  open
                    ? "border-accent-gold/60 bg-accent-gold/10 text-accent-gold"
                    : "border-ink-700/80 bg-ink-900/70 text-ink-200 hover:border-accent-gold/50 hover:text-accent-gold"
                )}
              >
                <Icon size={11} />
                {a.label}
                <ChevronDown size={10} className="opacity-70" />
              </button>
              {open && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/95 shadow-card backdrop-blur"
                >
                  {a.options.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onPick(o.prompt);
                        setOpenId(null);
                      }}
                      className="block w-full px-3 py-2 text-left text-[11px] text-ink-200 transition hover:bg-accent-gold/5 hover:text-accent-gold"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => a.prompt && onPick(a.prompt)}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-ink-700/80 bg-ink-900/70 px-2.5 text-[10.5px] font-medium text-ink-200 backdrop-blur-sm transition hover:border-accent-gold/50 hover:text-accent-gold"
          >
            <Icon size={11} />
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
