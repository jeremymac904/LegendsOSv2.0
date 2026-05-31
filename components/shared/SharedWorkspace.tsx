"use client";

import { useState } from "react";
import { FolderOpen, Inbox, Sparkles } from "lucide-react";

import { ReviewItemsList } from "@/components/shared/ReviewItemsList";
import { SharedResourceIntakeForm } from "@/components/shared/SharedResourceIntakeForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, formatRelative } from "@/lib/utils";
import type { SharedReviewItem } from "@/lib/teamResources";

interface ActiveResource {
  id: string;
  title: string;
  description: string | null;
  resource_type: string;
  updated_at: string;
}

interface Props {
  owner: boolean;
  activeResources: ActiveResource[];
  reviewItems: SharedReviewItem[];
}

type Tab = "active" | "review";

export function SharedWorkspace({ owner, activeResources, reviewItems }: Props) {
  const [tab, setTab] = useState<Tab>("active");

  const tabs: { id: Tab; label: string; count: number; icon: typeof FolderOpen }[] = [
    { id: "active", label: "Active resources", count: activeResources.length, icon: FolderOpen },
  ];
  if (owner) {
    tabs.push({ id: "review", label: "Review queue", count: reviewItems.length, icon: Inbox });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
      <section className="card-padded">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-200 pb-3 dark:border-ink-800">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
                  isActive
                    ? "bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100"
                    : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                )}
              >
                <Icon size={14} />
                {t.label}
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    isActive
                      ? "bg-white text-ink-700 dark:bg-ink-900 dark:text-ink-300"
                      : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400"
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {tab === "active" ? (
            activeResources.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No shared resources yet"
                description={
                  owner
                    ? "Create a review item on the right, then publish it to make it available to every team member."
                    : "Jeremy has not shared any resources yet. Check back later."
                }
              />
            ) : (
              <div className="grid gap-2">
                {activeResources.map((r) => (
                  <article
                    key={r.id}
                    className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900/40"
                  >
                    <header className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-ink-900 dark:text-ink-100">
                        {r.title}
                      </h3>
                      <span className="chip">{r.resource_type}</span>
                    </header>
                    {r.description && (
                      <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
                        {r.description}
                      </p>
                    )}
                    <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400">
                      Updated {formatRelative(r.updated_at)}
                    </p>
                  </article>
                ))}
              </div>
            )
          ) : (
            <ReviewItemsList items={reviewItems} />
          )}
        </div>
      </section>

      <aside className="space-y-4">
        {owner ? (
          <SharedResourceIntakeForm />
        ) : (
          <div className="card-padded text-xs text-ink-700 dark:text-ink-300">
            <p className="label">Adding resources</p>
            <p className="mt-2">
              Only the owner can add or remove shared resources. Suggest
              additions to Jeremy directly.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
