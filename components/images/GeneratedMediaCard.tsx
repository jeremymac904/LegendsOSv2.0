"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Download, ImageIcon, Share2 } from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { GeneratedMedia } from "@/types/database";

interface Props {
  media: Pick<
    GeneratedMedia,
    | "id"
    | "prompt"
    | "preview_url"
    | "status"
    | "created_at"
    | "provider"
    | "model"
    | "aspect_ratio"
  >;
}

export function GeneratedMediaCard({ media }: Props) {
  const [copied, setCopied] = useState(false);
  function copyPrompt() {
    if (!media.prompt) return;
    navigator.clipboard?.writeText(media.prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <figure className="card overflow-hidden">
      <div className="aspect-square w-full bg-checker">
        {media.preview_url ? (
          <img
            src={media.preview_url}
            alt={media.prompt ?? ""}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[10px] text-ink-300">
            <ImageIcon size={18} />
            <span className="mt-1">{media.status}</span>
          </div>
        )}
      </div>
      <figcaption className="space-y-2 p-3 text-xs">
        <p className="line-clamp-2 text-ink-100">{media.prompt ?? "—"}</p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-300">
          <StatusPill status={media.status as never} />
          <span className="chip">{media.provider ?? "—"}</span>
          {media.model && <span className="chip">{truncate(media.model, 20)}</span>}
          {media.aspect_ratio && <span className="chip">{media.aspect_ratio}</span>}
          <span className="ml-auto">{formatRelative(media.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Link
            href={`/social?media=${media.id}`}
            className="btn-ghost px-2 py-1 text-[11px]"
            title="Pre-attach this image to a new social draft"
          >
            <Share2 size={12} />
            Use in Social
          </Link>
          <button
            type="button"
            onClick={copyPrompt}
            className={cn(
              "btn-ghost px-2 py-1 text-[11px]",
              copied && "text-status-ok"
            )}
            disabled={!media.prompt}
            title="Copy the prompt to clipboard"
          >
            <Copy size={12} />
            {copied ? "Copied" : "Copy prompt"}
          </button>
          {media.preview_url && (
            <a
              href={media.preview_url}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost px-2 py-1 text-[11px]"
              download
              title="Open / download image"
            >
              <Download size={12} />
              Download
            </a>
          )}
        </div>
      </figcaption>
    </figure>
  );
}
