"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  PlayCircle,
  Plus,
  Search,
  X,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  routeForResource,
  type TeamResourceItem,
  type TeamResourceMode,
  youtubeEmbedUrl,
} from "@/lib/teamResources";
import { cn, truncate } from "@/lib/utils";

type LibraryMode = TeamResourceMode;

interface Props {
  mode: LibraryMode;
  resourceType: string;
  items: TeamResourceItem[];
  categories: string[];
  owner: boolean;
  organizationId: string | null;
  userId: string;
  emptyTitle: string;
  emptyDescription: string;
}

function actionLabels(mode: LibraryMode) {
  if (mode === "training") {
    return {
      add: "Add training content",
      open: "Open resource",
      primary: "Open training",
      secondary: "View details",
      source: "Training",
    };
  }
  if (mode === "marketing") {
    return {
      add: "Add material",
      open: "Open source file",
      primary: "Use this template",
      secondary: "Customize this",
      source: "Material",
    };
  }
  return {
    add: "Add LF resource",
    open: "Open resource",
    primary: "Open resource",
    secondary: "View notes",
    source: "Resource",
  };
}

export function ResourceLibrary({
  mode,
  resourceType,
  items,
  categories,
  owner,
  organizationId,
  userId,
  emptyTitle,
  emptyDescription,
}: Props) {
  const router = useRouter();
  const labels = actionLabels(mode);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryOptions = useMemo(
    () => ["All", ...Array.from(new Set([...categories, ...items.map((i) => i.category)]))],
    [categories, items]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => category === "All" || item.category === category)
      .filter((item) => {
        if (!needle) return true;
        const haystack = [
          item.title,
          item.description,
          item.category,
          item.resourceType,
          item.audience,
          item.department,
          item.format,
          item.intendedUse,
          item.instructions,
          ...item.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
  }, [category, items, query]);

  function copyInstructions(item: TeamResourceItem) {
    const body =
      item.instructions ||
      `${item.title}\n\n${item.description}\n\nUse: ${item.intendedUse ?? "Customize for the intended audience."}`;
    void navigator.clipboard.writeText(body);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function addResource(form: FormData) {
    setError(null);
    if (!organizationId) {
      setError("Your profile must belong to an organization.");
      return;
    }
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const selectedCategory = String(form.get("category") ?? "").trim();
    const url = String(form.get("url") ?? "").trim();
    const format = String(form.get("format") ?? "").trim();
    const audience = String(form.get("audience") ?? "").trim();
    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const instructions = String(form.get("instructions") ?? "").trim();
    const concreteType = String(form.get("resource_type") ?? "").trim();
    if (!title || !selectedCategory) {
      setError("Title and category are required.");
      return;
    }
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const embed = mode === "training" ? youtubeEmbedUrl(url) : null;
      const { error: insertErr } = await supabase.from("shared_resources").insert({
        organization_id: organizationId,
        created_by: userId,
        resource_type: resourceType,
        title,
        description: description || null,
        payload: {
          category: selectedCategory,
          url: url || null,
          video_url: mode === "training" ? url || null : null,
          embed_url: embed,
          resource_type: concreteType || resourceType,
          format: format || null,
          audience: audience || null,
          tags,
          instructions: instructions || null,
          intended_use: instructions || null,
          visibility: "team_shared",
        },
      });
      if (insertErr) {
        setError(insertErr.message);
        return;
      }
      setShowAdd(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <section className="card p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600 dark:text-ink-400"
            />
            <input
              className="input pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${labels.source.toLowerCase()}s by title, tag, audience, or notes...`}
            />
          </label>
          <select
            className="input lg:w-60"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {owner && (
            <button
              type="button"
              className="btn-primary shrink-0"
              onClick={() => setShowAdd((value) => !value)}
            >
              {showAdd ? <X size={14} /> : <Plus size={14} />}
              {showAdd ? "Close" : labels.add}
            </button>
          )}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-600 dark:text-ink-400">
          <Filter size={11} />
          {filtered.length} {labels.source.toLowerCase()}
          {filtered.length === 1 ? "" : "s"}
          {category === "All" ? "" : ` in ${category}`}
          {query ? ` matching "${query}"` : ""}
        </p>
      </section>

      {showAdd && owner && (
        <form
          className="card-padded space-y-3 border-accent-gold/30 bg-accent-gold/5"
          onSubmit={(event) => {
            event.preventDefault();
            addResource(new FormData(event.currentTarget));
          }}
        >
          <div className="section-title">
            <div>
              <h2>{labels.add}</h2>
              <p>Owner-managed records save to Shared Resources and become visible to the team.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input name="title" className="input" placeholder="Title" required />
            <select name="category" className="input" required defaultValue={categories[0] ?? ""}>
              {categories.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
            <input name="url" className="input" placeholder="Source URL or YouTube link" />
            <input
              name="resource_type"
              className="input"
              placeholder={mode === "marketing" ? "template type" : "resource type"}
              defaultValue={mode === "marketing" ? "campaign" : resourceType}
            />
            <input name="format" className="input" placeholder="Format (video, PDF, checklist...)" />
            <input name="audience" className="input" placeholder="Audience" />
          </div>
          <textarea
            name="description"
            className="textarea"
            placeholder="Short description"
            maxLength={700}
          />
          <textarea
            name="instructions"
            className="textarea min-h-[100px]"
            placeholder="Usage notes, customization instructions, or training nugget"
          />
          <input name="tags" className="input" placeholder="Tags, comma separated" />
          {error && (
            <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
              {error}
            </p>
          )}
          <button className="btn-primary" type="submit" disabled={isPending}>
            <Plus size={14} />
            {isPending ? "Saving..." : "Save team resource"}
          </button>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="card-padded">
          <div className="rounded-2xl border border-dashed border-ink-300 bg-ink-50 p-6 text-center dark:border-accent-champagne/20 dark:bg-ink-950/30">
            <FileText className="mx-auto text-accent-gold" size={26} />
            <h2 className="mt-3 text-base font-semibold text-ink-900 dark:text-ink-100">
              {emptyTitle}
            </h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-ink-700 dark:text-ink-300">
              {emptyDescription}
            </p>
          </div>
        </div>
      ) : (
        <ul className="card divide-y divide-ink-200 overflow-hidden dark:divide-ink-800">
          {filtered.map((item) => {
            const hasEmbed = Boolean(item.embedUrl);
            const detailHref = routeForResource(mode, item.id);
            const canCopy =
              mode === "marketing" || Boolean(item.instructions);
            const copyLabel = mode === "marketing" ? "Copy instructions" : "Copy notes";
            return (
              <li
                key={item.id}
                className="group flex flex-col gap-3 p-3.5 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/30 sm:flex-row sm:items-center sm:gap-4"
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                    hasEmbed
                      ? "border-accent-gold/25 bg-accent-gold/10 text-accent-gold"
                      : "border-ink-200 bg-ink-50 text-ink-600 dark:border-accent-champagne/10 dark:bg-ink-950/40 dark:text-ink-300"
                  )}
                >
                  {hasEmbed ? <PlayCircle size={17} /> : <FileText size={17} />}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={detailHref}
                    className="block truncate text-sm font-semibold text-ink-900 hover:text-accent-gold dark:text-ink-100 dark:hover:text-accent-champagne"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-ink-600 dark:text-ink-400">
                    {item.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="chip-active">{item.category}</span>
                    <span className="chip">{item.format ?? item.resourceType}</span>
                    {item.source === "shared" && <span className="chip">team shared</span>}
                    {item.audience && <span className="chip">{item.audience}</span>}
                    {item.department && <span className="chip">{item.department}</span>}
                    {item.durationMinutes ? (
                      <span className="chip">{item.durationMinutes} min</span>
                    ) : null}
                    {item.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                    {item.updatedAt && (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-ink-600 dark:text-ink-500">
                        Updated {truncate(item.updatedAt, 10)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Link href={detailHref} className="btn-primary h-8 px-3 text-xs">
                    {labels.primary}
                  </Link>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary h-8 px-3 text-xs"
                      title={labels.open}
                    >
                      {labels.open}
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {canCopy && (
                    <button
                      type="button"
                      className="btn-ghost h-8 px-3 text-xs"
                      onClick={() => copyInstructions(item)}
                    >
                      {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === item.id ? "Copied" : copyLabel}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
