"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, Lock, Users2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  updatedLabel: string;
  itemCount: number;
}

export interface RecentRow {
  id: string;
  title: string;
  collectionId: string | null;
  sourceType: string | null;
  createdLabel: string;
}

type TabKey = "private" | "team" | "recent";

interface Props {
  privateCollections: CollectionRow[];
  teamCollections: CollectionRow[];
  recent: RecentRow[];
}

// Single tabbed card that folds the former three stacked sections (My
// collections, Team-shared, Recent items) into one compact pane. Collections
// render as dense rows with item counts; each row links into its detail page.
// Cuts roughly two-thirds of the page's vertical footprint while keeping every
// link real.
export function KnowledgeBrowser({
  privateCollections,
  teamCollections,
  recent,
}: Props) {
  const tabs: { key: TabKey; label: string; icon: typeof Lock; count: number }[] = [
    { key: "private", label: "My collections", icon: Lock, count: privateCollections.length },
    { key: "team", label: "Team-shared", icon: Users2, count: teamCollections.length },
    { key: "recent", label: "Recent items", icon: Clock, count: recent.length },
  ];
  const [active, setActive] = useState<TabKey>(
    privateCollections.length > 0 ? "private" : teamCollections.length > 0 ? "team" : "recent"
  );

  return (
    <section className="card-padded space-y-4">
      <div
        role="tablist"
        aria-label="Knowledge collections"
        className="flex flex-wrap gap-1.5 border-b border-ink-200 pb-3 dark:border-ink-800"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition",
                isActive
                  ? "border-accent-gold/50 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-300 dark:hover:text-ink-100"
              )}
            >
              <Icon size={13} />
              {t.label}
              <span
                className={cn(
                  "rounded-md px-1.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-accent-gold/20 text-accent-gold"
                    : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {active === "private" && (
          <CollectionList
            rows={privateCollections}
            emptyTitle="No private collections yet"
            emptyBody="Create one below to start uploading source material."
            visibilityLabel="private"
          />
        )}
        {active === "team" && (
          <CollectionList
            rows={teamCollections}
            emptyTitle="No team-shared collections yet"
            emptyBody="Jeremy can promote any collection to team-shared visibility."
            visibilityLabel="shared"
          />
        )}
        {active === "recent" && <RecentList rows={recent} />}
      </div>
    </section>
  );
}

function CollectionList({
  rows,
  emptyTitle,
  emptyBody,
  visibilityLabel,
}: {
  rows: CollectionRow[];
  emptyTitle: string;
  emptyBody: string;
  visibilityLabel: "private" | "shared";
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center dark:border-ink-800">
        <BookOpen size={22} className="mx-auto text-ink-400 dark:text-ink-500" />
        <p className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">
          {emptyTitle}
        </p>
        <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">{emptyBody}</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-50 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
          <tr>
            <th className="px-3 py-2 font-medium">Collection</th>
            <th className="px-3 py-2 text-right font-medium">Items</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.id}
              className="border-t border-ink-200 transition hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-900/40"
            >
              <td className="px-3 py-2.5">
                <Link href={`/knowledge/${c.id}`} className="block">
                  <span className="block font-medium text-ink-900 hover:text-accent-gold dark:text-ink-100">
                    {c.name}
                  </span>
                  {c.description && (
                    <span className="mt-0.5 line-clamp-1 block text-xs text-ink-600 dark:text-ink-300">
                      {c.description}
                    </span>
                  )}
                  <span className="mt-0.5 inline-flex text-[10px] uppercase tracking-[0.16em] text-ink-500 sm:hidden dark:text-ink-400">
                    {visibilityLabel} · {c.updatedLabel}
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-900 dark:text-ink-100">
                {c.itemCount}
              </td>
              <td className="hidden px-3 py-2.5 text-right text-xs text-ink-600 sm:table-cell dark:text-ink-300">
                {c.updatedLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentList({ rows }: { rows: RecentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center dark:border-ink-800">
        <Clock size={22} className="mx-auto text-ink-400 dark:text-ink-500" />
        <p className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">
          No items yet
        </p>
        <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
          Items appear as soon as you add them to a collection.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-ink-200 overflow-hidden rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
      {rows.map((it) => {
        const inner = (
          <span className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="truncate text-ink-900 dark:text-ink-100">
              {it.title}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-ink-600 dark:text-ink-300">
              <span className="chip">{it.sourceType ?? "note"}</span>
              {it.createdLabel}
            </span>
          </span>
        );
        return (
          <li key={it.id}>
            {it.collectionId ? (
              <Link
                href={`/knowledge/${it.collectionId}`}
                className="block transition hover:bg-ink-50 dark:hover:bg-ink-900/40"
              >
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
