"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon, Search, X } from "lucide-react";

import { AssetCard } from "@/components/admin/AssetCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

/**
 * One asset row handed to the grid. `origin` is the honest real-vs-shipped
 * label, mirroring components/images/AssetLibraryBrowser.tsx:
 *  - "uploaded" → owner-uploaded Supabase asset (real team brand, deletable)
 *  - "library"  → checked-in public/assets manifest entry (indexer-managed)
 *  - "sample"   → starter/sample visual flagged so nothing pretends to be
 *                 real brand output. Currently derived from a "sample" tag;
 *                 the chip simply does not render when none are present.
 */
export interface AssetGridItem {
  id: string;
  kind: "image" | "document" | "video";
  category: string;
  categoryLabel: string;
  label: string;
  fileName: string;
  publicPath: string | null;
  visibility: "team_shared" | "owner_only";
  tags: string[];
  person?: string;
  isUploaded: boolean;
  usageCount: number;
  origin: "uploaded" | "library" | "sample";
}

interface AssetLibraryGridProps {
  assets: AssetGridItem[];
}

type OriginFilter = "all" | AssetGridItem["origin"];
type VisibilityFilter = "all" | "team_shared" | "owner_only";

const ORIGIN_META: Record<
  AssetGridItem["origin"],
  { label: string; chip: string }
> = {
  uploaded: { label: "Uploaded", chip: "chip-ok" },
  library: { label: "Library", chip: "chip-info" },
  sample: { label: "Sample", chip: "chip-warn" },
};

const VIS_LABEL: Record<VisibilityFilter, string> = {
  all: "All",
  team_shared: "Team shared",
  owner_only: "Owner only",
};

/**
 * Compact, fully client-side toolbar + grid for the admin Asset Library.
 * Search and every filter chip apply instantly (no page reload). Each tile
 * is a real AssetCard whose delete action still hits /api/admin/assets.
 */
export function AssetLibraryGrid({ assets }: AssetLibraryGridProps) {
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");

  // Category chips, derived from the data (label kept alongside the raw key).
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) if (!map.has(a.category)) map.set(a.category, a.categoryLabel);
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [assets]);

  const origins = useMemo(() => {
    const present = new Set(assets.map((a) => a.origin));
    return (["all", "uploaded", "library", "sample"] as OriginFilter[]).filter(
      (o) => o === "all" || present.has(o)
    );
  }, [assets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (origin !== "all" && a.origin !== origin) return false;
      if (category !== "all" && a.category !== category) return false;
      if (visibility !== "all" && a.visibility !== visibility) return false;
      if (!q) return true;
      return (
        a.label.toLowerCase().includes(q) ||
        a.fileName.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [assets, query, origin, category, visibility]);

  const originCount = (o: OriginFilter) =>
    o === "all" ? assets.length : assets.filter((a) => a.origin === o).length;
  const categoryCount = (c: string) =>
    c === "all" ? assets.length : assets.filter((a) => a.category === c).length;

  const isFiltered =
    query.trim() !== "" ||
    origin !== "all" ||
    category !== "all" ||
    visibility !== "all";

  function reset() {
    setQuery("");
    setOrigin("all");
    setCategory("all");
    setVisibility("all");
  }

  return (
    <div className="space-y-3">
      <div className="card-padded space-y-3">
        {/* Search + visibility on one compact row */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500 dark:text-ink-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by label, file name, or tag…"
              aria-label="Search assets"
              className="input h-9 w-full pl-8 text-xs"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
              Visibility
            </span>
            {(["all", "team_shared", "owner_only"] as VisibilityFilter[]).map(
              (v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={cn(visibility === v ? "chip-active" : "chip")}
                >
                  {VIS_LABEL[v]}
                </button>
              )
            )}
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-2.5 py-1 text-[11px] text-ink-600 transition hover:border-status-err/40 hover:text-status-err dark:border-ink-800 dark:text-ink-300"
              title="Clear all filters"
            >
              <X size={11} />
              Reset
            </button>
          )}
        </div>

        {/* Source / origin chips */}
        {origins.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
              Source
            </span>
            {origins.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrigin(o)}
                className={cn(origin === o ? "chip-active" : "chip")}
              >
                {o === "all" ? "All" : ORIGIN_META[o].label}
                <span className="ml-1 tabular-nums opacity-70">
                  {originCount(o)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Category chips */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
              Category
            </span>
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={cn(category === "all" ? "chip-active" : "chip")}
            >
              All
              <span className="ml-1 tabular-nums opacity-70">
                {categoryCount("all")}
              </span>
            </button>
            {categories.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(category === c.value ? "chip-active" : "chip")}
              >
                {c.label}
                <span className="ml-1 tabular-nums opacity-70">
                  {categoryCount(c.value)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-ink-500 dark:text-ink-400">
        Showing {filtered.length} of {assets.length} asset
        {assets.length === 1 ? "" : "s"}
        {origins.includes("sample") && (
          <>
            {" "}
            · <span className="text-accent-gold">Sample</span> items are shipped
            starters, not real brand output.
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No assets match"
          description="Try clearing filters, uploading something new above, or re-running the indexer."
        />
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((a) => (
            <AssetCard
              key={`${a.isUploaded ? "u" : "m"}-${a.id}`}
              id={a.id}
              kind={a.kind}
              category={a.category}
              categoryLabel={a.categoryLabel}
              label={a.label}
              fileName={a.fileName}
              publicPath={a.publicPath}
              visibility={a.visibility}
              tags={a.tags}
              person={a.person}
              isUploaded={a.isUploaded}
              usageCount={a.usageCount}
              originLabel={ORIGIN_META[a.origin].label}
              originChip={ORIGIN_META[a.origin].chip}
            />
          ))}
        </section>
      )}
    </div>
  );
}
