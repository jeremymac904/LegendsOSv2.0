"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ImageIcon, Search } from "lucide-react";

import { GeneratedMediaCard } from "@/components/images/GeneratedMediaCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { GeneratedMedia } from "@/types/database";

// Lightweight asset shape shared by manifest + uploaded assets. The server
// component already normalizes both sources to these fields before passing
// them down, so the panel never touches Node-only asset internals.
export interface PanelAsset {
  id: string;
  label: string;
  file_name: string;
  public_path: string | null;
  category: string;
}

interface Props {
  media: GeneratedMedia[];
  starters: PanelAsset[];
  assetRefs: PanelAsset[];
  showStarters: boolean;
  falConfigured: boolean;
  owner: boolean;
}

type TabId = "results" | "library";

// Searchable / filterable right-hand panel. Replaces the old wall of two
// stacked full-width cards (generations + brand library) with a single
// compact tabbed surface so the page stays mostly above the fold and only
// the grid scrolls.
export function MediaLibraryPanel({
  media,
  starters,
  assetRefs,
  showStarters,
  falConfigured,
  owner,
}: Props) {
  const hasMedia = media.length > 0;
  const [tab, setTab] = useState<TabId>(hasMedia ? "results" : "library");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Distinct statuses present on the real rows — never invent states the data
  // doesn't have, so the filter chips stay honest.
  const statuses = useMemo(() => {
    const set = new Set<string>();
    media.forEach((m) => m.status && set.add(m.status));
    return Array.from(set);
  }, [media]);

  const filteredMedia = useMemo(() => {
    const q = query.trim().toLowerCase();
    return media.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [m.prompt, m.provider, m.model, m.aspect_ratio]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [media, query, statusFilter]);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assetRefs;
    return assetRefs.filter((a) =>
      [a.label, a.file_name, a.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [assetRefs, query]);

  const showStarterRow = !hasMedia && starters.length > 0;

  return (
    <section className="card-padded flex min-h-0 flex-col">
      {/* Tabs + count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <TabButton
            active={tab === "results"}
            onClick={() => setTab("results")}
          >
            {hasMedia ? "Library" : "Results"}
            <CountBadge n={media.length} active={tab === "results"} />
          </TabButton>
          {assetRefs.length > 0 && (
            <TabButton
              active={tab === "library"}
              onClick={() => setTab("library")}
            >
              Brand assets
              <CountBadge n={assetRefs.length} active={tab === "library"} />
            </TabButton>
          )}
        </div>
        {owner && (
          <Link href="/admin/assets" className="btn-ghost text-xs">
            Manage library
          </Link>
        )}
      </div>

      {/* Search + status filter — shared across tabs */}
      {(media.length > 0 || assetRefs.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500 dark:text-ink-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === "results"
                  ? "Search prompts, models…"
                  : "Search asset names…"
              }
              className="input h-9 py-0 pl-8 text-xs"
            />
          </div>
          {tab === "results" && statuses.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <FilterChip
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              >
                All
              </FilterChip>
              {statuses.map((s) => (
                <FilterChip
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scroll region — only the grid scrolls */}
      <div className="scrollbar-thin mt-4 max-h-[calc(100vh-22rem)] min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "results" ? (
          <>
            {media.length === 0 && starters.length === 0 && (
              <EmptyState
                icon={ImageIcon}
                title="No images yet"
                description={
                  falConfigured
                    ? "Generate your first image on the left."
                    : "Add FAL_KEY in Settings → Providers to enable generation."
                }
              />
            )}

            {/* Fresh deploy: no generations yet, show curated starter previews */}
            {showStarterRow && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {starters.map((a) => (
                  <StarterCard key={a.id} asset={a} />
                ))}
              </div>
            )}

            {hasMedia && filteredMedia.length === 0 && (
              <p className="px-1 py-8 text-center text-xs text-ink-600 dark:text-ink-300">
                No results match “{query}”.
              </p>
            )}

            {hasMedia && filteredMedia.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredMedia.map((m) => (
                  <GeneratedMediaCard key={m.id} media={m} />
                ))}
              </div>
            )}

            {/* Brand starters appended under a thin result set */}
            {hasMedia &&
              showStarters &&
              starters.length > 0 &&
              statusFilter === "all" &&
              query.trim().length === 0 && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400">
                    Brand starters
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {starters.map((a) => (
                      <StarterCard key={a.id} asset={a} compact />
                    ))}
                  </div>
                </div>
              )}
          </>
        ) : (
          <>
            {filteredAssets.length === 0 ? (
              <p className="px-1 py-8 text-center text-xs text-ink-600 dark:text-ink-300">
                No assets match “{query}”.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredAssets.map((a) =>
                  a.public_path ? (
                    <a
                      key={a.id}
                      href={a.public_path}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden rounded-lg border border-ink-200 bg-checker dark:border-ink-800"
                      title={`${a.label} — open full size`}
                    >
                      <img
                        src={a.public_path}
                        alt={a.label}
                        className="aspect-square w-full object-cover transition group-hover:opacity-90"
                        loading="lazy"
                      />
                    </a>
                  ) : null
                )}
              </div>
            )}
            <p className="mt-3 text-[11px] text-ink-600 dark:text-ink-300">
              Owner-uploaded assets (from{" "}
              <Link href="/admin/assets" className="text-accent-gold">
                Asset Library
              </Link>
              ) plus anything in <code>public/assets/</code> via{" "}
              <code>npm run index-assets</code>. Click any tile to open it full
              size.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function StarterCard({
  asset,
  compact = false,
}: {
  asset: PanelAsset;
  compact?: boolean;
}) {
  return (
    <article
      className="group overflow-hidden rounded-xl border border-ink-200 bg-checker dark:border-ink-800"
      title={asset.label}
    >
      <div className="relative aspect-square">
        {asset.public_path && (
          <img
            src={asset.public_path}
            alt={asset.label}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-ink-950/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-ink-100">
          {asset.category.replace(/_/g, " ")}
        </span>
      </div>
      {!compact ? (
        <div className="space-y-0.5 px-2.5 py-1.5 text-[11px]">
          <p className="line-clamp-1 font-medium text-ink-900 dark:text-ink-100">
            {asset.label}
          </p>
          <p className="line-clamp-1 text-[10px] text-ink-600 dark:text-ink-300">
            {asset.file_name}
          </p>
        </div>
      ) : (
        <p className="line-clamp-1 px-2 py-1 text-[11px] text-ink-700 dark:text-ink-200">
          {asset.label}
        </p>
      )}
    </article>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
          : "border-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/50 dark:hover:text-ink-100"
      )}
    >
      {children}
    </button>
  );
}

function CountBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        active
          ? "bg-accent-gold/15 text-accent-gold"
          : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
      )}
    >
      {n}
    </span>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] capitalize transition-colors",
        active
          ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
          : "border-ink-300 text-ink-600 hover:border-ink-400 dark:border-ink-700 dark:text-ink-300 dark:hover:border-ink-500"
      )}
    >
      {children}
    </button>
  );
}
