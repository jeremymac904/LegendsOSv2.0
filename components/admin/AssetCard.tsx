"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Lock, Trash2, Users2, Video } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AssetCardProps {
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
}

// Single asset card. Splits the heavy presentation (image / fallback /
// metadata) into a small client component so we can add a Delete button
// that hits /api/admin/assets and refreshes the server-rendered list.
// Static manifest entries are NOT deletable — they're checked into the
// repo and only the indexer removes them. The button only renders when
// `isUploaded` is true.
export function AssetCard(props: AssetCardProps) {
  const {
    id,
    kind,
    categoryLabel,
    label,
    fileName,
    publicPath,
    visibility,
    tags,
    person,
    isUploaded,
    usageCount,
  } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!isUploaded) return;
    const ok = window.confirm(
      `Delete "${label}" permanently? This removes the file from storage and unlinks it from any social drafts that referenced it.`
    );
    if (!ok) return;
    start(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/assets?id=${encodeURIComponent(id)}`,
          { method: "DELETE" }
        );
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          setError(
            res.status === 401 ? "Session expired" : "Server returned non-JSON"
          );
          return;
        }
        const data = await res.json();
        if (!data.ok) {
          setError(data.message ?? data.error ?? "Delete failed.");
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed.");
      }
    });
  }

  return (
    <article
      className={cn(
        "card group/asset overflow-hidden transition",
        pending ? "opacity-60" : "hover:border-accent-gold/30"
      )}
      title={fileName}
    >
      <div className="relative aspect-square w-full bg-checker">
        {kind === "image" && publicPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicPath}
            alt={label}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : kind === "video" ? (
          <div className="grid h-full w-full place-items-center text-ink-300">
            <Video size={28} />
            <span className="mt-1 text-[10px]">video</span>
          </div>
        ) : kind === "document" ? (
          <div className="grid h-full w-full place-items-center text-ink-300">
            <FileText size={28} />
            <span className="mt-1 text-[10px]">
              .{fileName.split(".").pop()}
            </span>
          </div>
        ) : (
          <div className="grid h-full w-full place-items-center text-[10px] text-ink-300">
            <ImageIcon size={18} />
            <span className="mt-1">local-only</span>
          </div>
        )}
        {isUploaded && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            aria-label="Delete asset"
            className="absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded-full border border-status-err/30 bg-ink-950/80 p-1.5 text-status-err opacity-0 transition group-hover/asset:opacity-100 hover:bg-status-err/20 focus:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <div className="space-y-1 p-3 text-xs">
        <p className="line-clamp-1 font-medium text-ink-100">{label}</p>
        <p className="line-clamp-1 text-[10px] text-ink-300">{fileName}</p>
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <span className="chip">{categoryLabel}</span>
          <UsageChip count={usageCount} />
          {isUploaded && <span className="chip-ok text-[10px]">uploaded</span>}
          {visibility === "team_shared" ? (
            <span className="chip-ok">
              <Users2 size={10} />
              team shared
            </span>
          ) : (
            <span className="chip-info">
              <Lock size={10} />
              owner only
            </span>
          )}
          {person && <span className="chip text-[10px]">{person}</span>}
          {tags.map((t) => (
            <span key={t} className="chip text-[10px]">
              {t}
            </span>
          ))}
        </div>
        {isUploaded && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-status-err/30 px-2 py-0.5 text-[10px] text-status-err transition hover:bg-status-err/10 disabled:opacity-50"
            >
              <Trash2 size={11} />
              {pending ? "Deleting…" : "Delete"}
            </button>
            {error && (
              <span className="truncate text-[10px] text-status-err" title={error}>
                {error}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function UsageChip({ count }: { count: number }) {
  const copy =
    count === 0
      ? "Used in 0 posts"
      : count === 1
      ? "Used in 1 post"
      : `Used in ${count} posts`;
  const className =
    count === 0
      ? "inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/50 px-2 py-0.5 text-[10px] text-ink-300"
      : "inline-flex items-center gap-1 rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-[10px] font-medium text-accent-gold";
  return <span className={className}>{copy}</span>;
}
