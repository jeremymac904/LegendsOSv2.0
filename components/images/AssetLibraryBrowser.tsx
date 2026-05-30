"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One pickable brand-library item. `origin` drives the honest label badge:
 *  - "uploaded"  → owner-uploaded asset from the Asset Library (real, team brand)
 *  - "library"   → checked-in manifest asset from public/assets via index-assets
 *  - "sample"    → starter/sample visual shipped for empty states (clearly labeled)
 */
export interface AssetLibraryItem {
  id: string;
  label: string;
  file_name: string;
  category: string;
  public_path: string | null;
  origin: "uploaded" | "library" | "sample";
}

interface AssetLibraryBrowserProps {
  assets: AssetLibraryItem[];
  /** Optional cap so the grid never explodes vertically before filtering. */
  className?: string;
}

const ORIGIN_META: Record<
  AssetLibraryItem["origin"],
  { label: string; chip: string }
> = {
  uploaded: { label: "Uploaded", chip: "chip-ok" },
  library: { label: "Library", chip: "chip-info" },
  sample: { label: "Sample", chip: "chip-warn" },
};

type OriginFilter = "all" | AssetLibraryItem["origin"];

/**
 * Compact, searchable/filterable brand-asset grid. Pure client component — it
 * only renders/links the items it is given (each tile is a real <a> to the
 * public asset URL), so there are no dead controls. Real generated/uploaded
 * assets and shipped samples are visibly distinguished via an origin badge.
 */
export function AssetLibraryBrowser({
  assets,
  className,
}: AssetLibraryBrowserProps) {
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<OriginFilter>("all");

  // Categories present in the data — drives the category chip row.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) set.add(a.category);
    return Array.from(set).sort();
  }, [assets]);
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (origin !== "all" && a.origin !== origin) return false;
      if (category !== "all" && a.category !== category) return false;
      if (!q) return true;
      return (
        a.label.toLowerCase().includes(q) ||
        a.file_name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }, [assets, query, origin, category]);

  const hasSamples = assets.some((a) => a.origin === "sample");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[180px] flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500 dark:text-ink-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            aria-label="Search brand assets"
            className="input h-9 w-full pl-8 text-xs"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "uploaded", "library", "sample"] as OriginFilter[])
            .filter((o) => o !== "sample" || hasSamples)
            .map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrigin(o)}
                className={cn(origin === o ? "chip-active" : "chip")}
              >
                {o === "all" ? "All" : ORIGIN_META[o].label}
              </button>
            ))}
        </div>
      </div>

      {categories.length > 1 && (
        <div className="scrollbar-thin flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(category === "all" ? "chip-active" : "chip")}
          >
            All types
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(category === c ? "chip-active" : "chip")}
            >
              {c.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-ink-500 dark:text-ink-400">
        {filtered.length} of {assets.length} asset
        {assets.length === 1 ? "" : "s"}
        {hasSamples && (
          <>
            {" "}
            · <span className="text-accent-gold">Sample</span> items are shipped
            starters, not your generated output.
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-ink-200 bg-white/60 px-3 py-6 text-center text-xs text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
          No assets match your search.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
          {filtered.map((a) =>
            a.public_path ? (
              <a
                key={a.id}
                href={a.public_path}
                target="_blank"
                rel="noreferrer"
                className="group relative block overflow-hidden rounded-lg border border-ink-200 bg-checker dark:border-ink-800"
                title={`${a.label} (${ORIGIN_META[a.origin].label})`}
              >
                <img
                  src={a.public_path}
                  alt={a.label}
                  className="aspect-square w-full object-cover transition group-hover:opacity-90"
                  loading="lazy"
                />
                <span
                  className={cn(
                    "absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em]",
                    ORIGIN_META[a.origin].chip
                  )}
                >
                  {ORIGIN_META[a.origin].label}
                </span>
              </a>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
