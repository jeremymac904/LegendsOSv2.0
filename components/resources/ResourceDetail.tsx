"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  routeForResource,
  type TeamResourceItem,
  type TeamResourceMode,
} from "@/lib/teamResources";
import { cn } from "@/lib/utils";

interface ResourceDetailProps {
  mode: TeamResourceMode;
  item: TeamResourceItem;
  relatedItems: TeamResourceItem[];
}

function libraryHref(mode: TeamResourceMode): string {
  if (mode === "training") return "/training";
  if (mode === "marketing") return "/marketing-materials";
  return "/lf-resources";
}

function modeCopy(mode: TeamResourceMode) {
  if (mode === "training") {
    return {
      eyebrow: "Training detail",
      back: "Back to Training",
      source: "Open source material",
      copy: "Copy training notes",
      primary: "Training guide",
    };
  }
  if (mode === "marketing") {
    return {
      eyebrow: "Marketing material",
      back: "Back to Marketing Materials",
      source: "Open source file",
      copy: "Copy customization notes",
      primary: "Template guide",
    };
  }
  return {
    eyebrow: "LF resource",
    back: "Back to LF Resources",
    source: "Open source resource",
    copy: "Copy resource notes",
    primary: "Resource guide",
  };
}

function notesFor(item: TeamResourceItem): string {
  const parts = [
    item.title,
    item.description,
    item.intendedUse ? `Use: ${item.intendedUse}` : "",
    item.instructions ? `Notes: ${item.instructions}` : "",
    item.detail?.objective ? `Objective: ${item.detail.objective}` : "",
    ...(item.detail?.steps ?? []).map((step, index) => `${index + 1}. ${step}`),
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function ResourceDetail({
  mode,
  item,
  relatedItems,
}: ResourceDetailProps) {
  const labels = modeCopy(mode);
  const [copied, setCopied] = useState<string | null>(null);
  const sections = useMemo(() => {
    const base = item.detail?.sections ?? [];
    const generic = [
      item.intendedUse
        ? {
            title: "Intended use",
            body: item.intendedUse,
            items: [] as string[],
          }
        : null,
      item.instructions
        ? {
            title: "Instructions",
            body: item.instructions,
            items: [] as string[],
          }
        : null,
    ].filter((entry): entry is { title: string; body: string; items: string[] } =>
      Boolean(entry)
    );
    return [...base, ...generic];
  }, [item.detail?.sections, item.instructions, item.intendedUse]);

  function copy(id: string, body: string) {
    void navigator.clipboard.writeText(body);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={libraryHref(mode)} className="btn-secondary h-9 px-3 text-xs">
          <ArrowLeft size={13} />
          {labels.back}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost h-9 px-3 text-xs"
            onClick={() => copy("notes", notesFor(item))}
          >
            {copied === "notes" ? <Check size={13} /> : <Copy size={13} />}
            {copied === "notes" ? "Copied" : labels.copy}
          </button>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary h-9 px-3 text-xs"
            >
              {labels.source}
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>

      <section className="card-padded overflow-hidden">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="label flex items-center gap-2">
              <Sparkles size={12} />
              {labels.eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">
              {item.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              {item.detail?.summary ?? item.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="chip-active">{item.category}</span>
              <span className="chip">{item.format ?? item.resourceType}</span>
              {item.audience && <span className="chip">Audience: {item.audience}</span>}
              {item.department && <span className="chip">{item.department}</span>}
              {item.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <aside className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-accent-champagne/10 dark:bg-ink-950/30 dark:backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-gold dark:text-accent-champagne">
              {labels.primary}
            </p>
            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="text-ink-600 dark:text-ink-400">Use case</dt>
                <dd className="mt-1 text-ink-900 dark:text-ink-100">
                  {item.detail?.useCase ?? item.intendedUse ?? "Use this as a guided team resource."}
                </dd>
              </div>
              <div>
                <dt className="text-ink-600 dark:text-ink-400">Format</dt>
                <dd className="mt-1 text-ink-900 dark:text-ink-100">{item.format ?? item.resourceType}</dd>
              </div>
              <div>
                <dt className="text-ink-600 dark:text-ink-400">Primary action</dt>
                <dd className="mt-1 text-ink-900 dark:text-ink-100">
                  Start with this internal guide. Open the source link only when you need the raw file.
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      {item.embedUrl && (
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Training video</h2>
              <p>Embedded safely from the provided YouTube link.</p>
            </div>
            <PlayCircle size={18} className="text-accent-gold dark:text-accent-champagne" />
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 dark:border-accent-champagne/10 dark:bg-ink-950/70">
            <iframe
              src={item.embedUrl}
              title={item.title}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {(item.detail?.objective || item.detail?.includedAssets?.length || item.detail?.steps?.length) && (
        <section className="grid gap-3 xl:grid-cols-3">
          {item.detail?.objective && (
            <DetailPanel title="Objective" body={item.detail.objective} />
          )}
          {item.detail?.includedAssets?.length ? (
            <DetailPanel title="Included assets" items={item.detail.includedAssets} />
          ) : null}
          {item.detail?.steps?.length ? (
            <DetailPanel title="Next workflow" items={item.detail.steps} />
          ) : null}
        </section>
      )}

      {sections.length > 0 && (
        <section className="grid gap-3 lg:grid-cols-2">
          {sections.map((section) => (
            <DetailPanel
              key={`${section.title}-${section.body ?? ""}`}
              title={section.title}
              body={section.body}
              items={section.items}
            />
          ))}
        </section>
      )}

      {item.detail?.copyBlocks?.length ? (
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Copy-ready guidance</h2>
              <p>Reusable text blocks you can customize before using.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {item.detail.copyBlocks.map((block) => (
              <article
                key={block.title}
                className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-accent-champagne/10 dark:bg-ink-950/30 dark:backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">{block.title}</h3>
                  <button
                    type="button"
                    className="btn-ghost h-8 px-2 text-[11px]"
                    onClick={() => copy(block.title, block.body)}
                  >
                    {copied === block.title ? <Check size={12} /> : <Copy size={12} />}
                    {copied === block.title ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-700 dark:text-ink-300">
                  {block.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(item.detail?.complianceNote || item.detail?.nextSteps?.length) && (
        <section className="grid gap-3 lg:grid-cols-2">
          {item.detail?.complianceNote && (
            <DetailPanel
              title="Compliance note"
              body={item.detail.complianceNote}
              tone="warn"
            />
          )}
          {item.detail?.nextSteps?.length ? (
            <DetailPanel title="Next best actions" items={item.detail.nextSteps} />
          ) : null}
        </section>
      )}

      {relatedItems.length > 0 && (
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Related items</h2>
              <p>Open the next internal guide instead of searching raw folders.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {relatedItems.map((related) => (
              <Link
                key={related.id}
                href={routeForResource(mode, related.id)}
                className="rounded-2xl border border-ink-200 bg-ink-50 p-4 transition hover:border-accent-gold/40 dark:border-accent-champagne/10 dark:bg-ink-950/30 dark:hover:border-accent-champagne/30"
              >
                <FileText size={16} className="text-accent-gold dark:text-accent-champagne" />
                <p className="mt-3 text-sm font-semibold text-ink-900 dark:text-ink-100">
                  {related.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-700 dark:text-ink-300">
                  {related.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DetailPanel({
  title,
  body,
  items,
  tone = "default",
}: {
  title: string;
  body?: string;
  items?: string[];
  tone?: "default" | "warn";
}) {
  return (
    <article
      className={cn(
        "card-padded",
        tone === "warn" && "border-status-warn/25 bg-status-warn/5"
      )}
    >
      <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">{title}</h2>
      {body && <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-300">{body}</p>}
      {items && items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((entry) => (
            <li key={entry} className="flex gap-2 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-gold dark:bg-accent-champagne" />
              <span>{entry}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
