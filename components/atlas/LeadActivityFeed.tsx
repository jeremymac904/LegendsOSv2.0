"use client";

import { Activity, FileSignature, MessageSquare, PhoneCall, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FeedItem {
  id: string;
  icon: LucideIcon;
  tone: string;
  label: string;
  meta: string;
  when: string;
}

const SAMPLE_FEED: FeedItem[] = [
  {
    id: "1",
    icon: UserPlus,
    tone: "text-accent-gold",
    label: "New lead — Sarah Chen",
    meta: "FHA · 720 FICO",
    when: "12m ago",
  },
  {
    id: "2",
    icon: PhoneCall,
    tone: "text-status-info",
    label: "Logged call — Marcus Lee",
    meta: "Pre-approval review",
    when: "1h ago",
  },
  {
    id: "3",
    icon: MessageSquare,
    tone: "text-status-ok",
    label: "Drip sent — refi cohort",
    meta: "42 recipients",
    when: "3h ago",
  },
  {
    id: "4",
    icon: FileSignature,
    tone: "text-accent-gold",
    label: "Disclosures signed",
    meta: "Patel · file #2814",
    when: "5h ago",
  },
];

export function LeadActivityFeed() {
  return (
    <section
      aria-label="Lead activity feed"
      className="card overflow-hidden"
      data-mock="true"
    >
      <header className="flex items-center justify-between gap-2 border-b border-ink-800/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-md border border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
          >
            <Activity size={12} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              Lead activity
            </p>
            <p className="text-[10px] text-ink-400">Recent borrower events</p>
          </div>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.14em] text-amber-300">
          Sample
        </span>
      </header>
      <ul className="divide-y divide-ink-800/40">
        {SAMPLE_FEED.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className="flex items-start gap-2 px-3 py-2"
            >
              <span className={`mt-[2px] inline-flex shrink-0 ${item.tone}`}>
                <Icon size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-medium text-ink-100">
                  {item.label}
                </p>
                <p className="truncate text-[10px] text-ink-400">{item.meta}</p>
              </div>
              <span className="shrink-0 text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
                {item.when}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-ink-800/40 px-3 py-1.5 text-[9.5px] leading-snug text-ink-400">
        Sample activity — wire to lead events when available.
      </p>
    </section>
  );
}
