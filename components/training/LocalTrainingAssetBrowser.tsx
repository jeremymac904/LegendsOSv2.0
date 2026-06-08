"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Headphones,
  Search,
  Video,
  type LucideIcon,
} from "lucide-react";

import type {
  LocalTrainingAsset,
  TrainingAssetCounts,
  TrainingAssetDriveLink,
} from "@/lib/legends/trainingAssets";
import { cn } from "@/lib/utils";

interface LocalTrainingAssetBrowserProps {
  assets: LocalTrainingAsset[];
  counts: TrainingAssetCounts;
  driveLinks?: TrainingAssetDriveLink[];
  title?: string;
  description?: string;
  maxVisible?: number;
  showLocalReferences?: boolean;
  compact?: boolean;
  className?: string;
}

const ALL = "All";

const KIND_ICONS: Record<string, LucideIcon> = {
  video: Video,
  audio: Headphones,
  document: FileText,
  transcript: FileText,
  summary: FileText,
  script: FileText,
  prompt: FileText,
  roleplay: FileText,
  tracker: Database,
  community: Database,
  knowledge: Database,
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function LocalTrainingAssetBrowser({
  assets,
  counts,
  driveLinks = [],
  title = "Local training asset index",
  description = "Read-only index of local training, community, transcript, video, and coaching assets.",
  maxVisible = 80,
  showLocalReferences = false,
  compact = false,
  className,
}: LocalTrainingAssetBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => [ALL, ...Array.from(new Set(assets.map((asset) => asset.category))).sort()],
    [assets]
  );
  const kindOptions = useMemo(
    () => [ALL, ...Array.from(new Set(assets.map((asset) => asset.kind))).sort()],
    [assets]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (category !== ALL && asset.category !== category) return false;
      if (kind !== ALL && asset.kind !== kind) return false;
      if (!needle) return true;
      const haystack = [
        asset.title,
        asset.summary,
        asset.category,
        asset.kind,
        asset.sourceGroup,
        asset.format,
        asset.relativePath,
        showLocalReferences ? asset.localPath : "",
        ...asset.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [assets, category, kind, query, showLocalReferences]);

  const visible = filtered.slice(0, maxVisible);
  const hiddenCount = Math.max(0, filtered.length - visible.length);
  const topKinds = Object.entries(counts.byKind)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  function copyPath(path: string) {
    void navigator.clipboard.writeText(path);
    setCopiedPath(path);
    window.setTimeout(() => setCopiedPath(null), 1400);
  }

  return (
    <section className={cn("card-padded space-y-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="label flex items-center gap-2">
            <Database size={12} />
            Generated index
          </p>
          <h2 className="mt-1 text-base font-semibold text-ink-900 dark:text-ink-100">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-700 dark:text-ink-300">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className="chip-active">{counts.indexedAssets} indexed</span>
          <span className="chip">{counts.scannedFiles} scanned</span>
          {counts.truncatedByLimit > 0 && (
            <span className="chip-off">{counts.truncatedByLimit} held back</span>
          )}
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-2">
          {topKinds.map(([label, count]) => (
            <span key={label} className="chip">
              {label}: {count}
            </span>
          ))}
        </div>
      )}

      {driveLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {driveLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-accent-champagne/20 bg-accent-gold/10 px-2.5 py-1 text-[11px] font-medium text-accent-gold transition-colors hover:border-accent-gold/60 hover:text-accent-gold-300"
            >
              {link.title}
              <ExternalLink size={11} />
            </a>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
        <label className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            className="input pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, tags, source folder, or notes..."
          />
        </label>
        <label className="relative">
          <Filter
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <select
            className="input pl-9"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <select
          className="input"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {kindOptions.map((option) => (
            <option key={option} value={option}>
              {option === ALL ? "All formats" : option}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {visible.map((asset) => {
          const Icon = KIND_ICONS[asset.kind] ?? Database;
          return (
            <article
              key={asset.id}
              className="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-900/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="chip-active">{asset.category}</span>
                    <span className="chip">{asset.format}</span>
                    {asset.ownerReviewRecommended && (
                      <span className="chip-off">owner review</span>
                    )}
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {asset.title}
                  </h3>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 text-accent-champagne">
                  <Icon size={15} />
                </span>
              </div>

              <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-ink-700 dark:text-ink-300">
                {asset.summary || "Indexed source with no text excerpt available yet."}
              </p>

              <div className="mt-3 space-y-1 text-[11px] text-ink-600 dark:text-ink-400">
                <p className="truncate">{asset.sourceGroup}</p>
                <p>
                  {asset.kind} / {formatBytes(asset.sizeBytes)}
                  {asset.transcriptPath ? " / transcript" : ""}
                  {asset.summaryPath ? " / summary" : ""}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {asset.tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="chip text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>

              {(asset.sourceUrls.length > 0 || asset.driveUrls.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {asset.sourceUrls.slice(0, 2).map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-accent-gold hover:text-accent-gold-300"
                    >
                      Source
                      <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              )}

              {showLocalReferences && (
                <div className="mt-3 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 text-[10px] text-ink-700 dark:border-ink-800 dark:bg-ink-950/60 dark:text-ink-300">
                    {asset.localPath}
                  </code>
                  <button
                    type="button"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 transition-colors hover:border-accent-gold/40 hover:text-accent-gold dark:border-ink-800 dark:text-ink-300"
                    onClick={() => copyPath(asset.localPath)}
                    aria-label={`Copy local path for ${asset.title}`}
                    title="Copy local path"
                  >
                    {copiedPath === asset.localPath ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-300 p-6 text-center dark:border-ink-700">
          <FileText className="mx-auto text-accent-gold" size={24} />
          <p className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">
            No indexed assets match those filters.
          </p>
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="text-center text-[11px] text-ink-500 dark:text-ink-400">
          Showing {visible.length} of {filtered.length}. Narrow the search to inspect more matches.
        </p>
      )}
    </section>
  );
}
