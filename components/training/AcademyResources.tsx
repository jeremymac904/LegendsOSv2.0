"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3 } from "lucide-react";

import {
  calendarItems,
  resourceTabs,
  type ResourceLink,
} from "@/lib/legends/academyContent";

// Resources hub for the Legends Mortgage Academy. Tab state is the only
// interactivity, so this is a client component. Every card is a real
// navigation — internal links use next/link, externals open in a new tab.
function LinkCard({ link }: { link: ResourceLink }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
          {link.title}
        </h3>
        {link.external && (
          <ArrowUpRight
            size={15}
            className="mt-0.5 shrink-0 text-accent-champagne/70 transition group-hover:text-accent-champagne"
          />
        )}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
        {link.description}
      </p>
    </>
  );

  const className =
    "group glass-card-padded block transition hover:-translate-y-0.5 hover:border-accent-champagne/30";

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {body}
    </Link>
  );
}

export function AcademyResources({ firstName }: { firstName: string }) {
  const [activeKey, setActiveKey] = useState(resourceTabs[0]?.key ?? "");
  const activeTab =
    resourceTabs.find((tab) => tab.key === activeKey) ?? resourceTabs[0];

  if (!activeTab) return null;

  const isCalendar = activeTab.key === "calendar";

  return (
    <div className="space-y-5">
      {/* Tab rail */}
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {resourceTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveKey(tab.key)}
            className={
              "shrink-0 " + (tab.key === activeKey ? "chip-active" : "chip")
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active tab */}
      <section className="space-y-4">
        <div className="section-title">
          <h2>{activeTab.label}</h2>
          <p>
            {firstName ? `${firstName}, ` : ""}
            {activeTab.blurb}
          </p>
        </div>

        {/* Weekly coaching rhythm — only on the Calendar tab. */}
        {isCalendar && (
          <div className="glass-card-padded">
            <p className="label flex items-center gap-1.5">
              <CalendarDays size={12} className="text-accent-champagne" />{" "}
              Weekly coaching rhythm
            </p>
            <ul className="mt-3 divide-y divide-accent-champagne/10">
              {calendarItems.map((item) => (
                <li
                  key={item.day}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4"
                >
                  <div className="flex w-full items-center justify-between gap-3 sm:w-44 sm:shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-champagne">
                      {item.day}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500 dark:text-ink-400">
                      <Clock3 size={11} />
                      {item.time}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                      {item.focus}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Link cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeTab.links.map((link) => (
            <LinkCard key={link.href + link.title} link={link} />
          ))}
        </div>
      </section>
    </div>
  );
}
