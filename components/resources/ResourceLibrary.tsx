"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
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
  MARKETING_RESOURCE_TYPE,
  type TeamResourceItem,
  youtubeEmbedUrl,
} from "@/lib/teamResources";
import { cn, truncate } from "@/lib/utils";

type LibraryMode = "training" | "marketing" | "lf";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    <div className="space-y-4">
      <section className="card-padded">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="label flex items-center gap-2">
              <Filter size={12} />
              Library filters
            </p>
            <p className="mt-1 text-xs text-ink-300">
              Search title, tags, category, audience, department, or usage notes.
            </p>
          </div>
          {owner && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowAdd((value) => !value)}
            >
              {showAdd ? <X size={14} /> : <Plus size={14} />}
              {showAdd ? "Close" : labels.add}
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <label className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              className="input pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${labels.source.toLowerCase()}s...`}
            />
          </label>
          <select
            className="input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
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

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="card-padded lg:col-span-2">
            <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/35 p-6 text-center">
              <FileText className="mx-auto text-accent-gold" size={26} />
              <h2 className="mt-3 text-base font-semibold text-ink-100">
                {emptyTitle}
              </h2>
              <p className="mx-auto mt-1 max-w-xl text-sm text-ink-300">
                {emptyDescription}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((item) => {
            const expanded = expandedId === item.id;
            const hasEmbed = Boolean(item.embedUrl);
            return (
              <article
                key={item.id}
                className={cn(
                  "card-padded overflow-hidden transition",
                  expanded && "border-accent-gold/35"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="chip-active">{item.category}</span>
                      <span className="chip">{item.format ?? item.resourceType}</span>
                      {item.source === "shared" && <span className="chip">team shared</span>}
                    </div>
                    <h2 className="mt-3 text-base font-semibold text-ink-100">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-ink-300">
                      {item.description}
                    </p>
                  </div>
                  {hasEmbed ? (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-gold/25 bg-accent-gold/10 text-accent-gold">
                      <PlayCircle size={18} />
                    </span>
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-700 bg-ink-900/70 text-ink-300">
                      <FileText size={18} />
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.audience && <span className="chip">Audience: {item.audience}</span>}
                  {item.department && <span className="chip">{item.department}</span>}
                  {item.durationMinutes && <span className="chip">{item.durationMinutes} min</span>}
                  {item.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>

                {expanded && (
                  <div className="mt-4 space-y-3">
                    {item.embedUrl && (
                      <div className="overflow-hidden rounded-xl border border-ink-800 bg-ink-950/70">
                        <iframe
                          src={item.embedUrl}
                          title={item.title}
                          className="aspect-video w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {(item.intendedUse || item.instructions) && (
                      <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
                        {item.intendedUse && (
                          <p className="text-xs text-ink-300">
                            <span className="font-medium text-ink-100">Use: </span>
                            {item.intendedUse}
                          </p>
                        )}
                        {item.instructions && (
                          <p className="mt-2 text-xs leading-relaxed text-ink-300">
                            <span className="font-medium text-ink-100">Notes: </span>
                            {item.instructions}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary h-9 px-3 text-xs"
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                  >
                    {hasEmbed ? labels.secondary : "Details"}
                    <ArrowRight size={13} />
                  </button>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary h-9 px-3 text-xs"
                    >
                      {mode === "marketing" && item.resourceType !== MARKETING_RESOURCE_TYPE
                        ? labels.open
                        : labels.primary}
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {mode === "marketing" && (
                    <button
                      type="button"
                      className="btn-ghost h-9 px-3 text-xs"
                      onClick={() => copyInstructions(item)}
                    >
                      {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === item.id ? "Copied" : "Copy instructions"}
                    </button>
                  )}
                  {mode !== "marketing" && item.instructions && (
                    <button
                      type="button"
                      className="btn-ghost h-9 px-3 text-xs"
                      onClick={() => copyInstructions(item)}
                    >
                      {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === item.id ? "Copied" : "Copy notes"}
                    </button>
                  )}
                </div>

                {item.updatedAt && (
                  <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    Updated {truncate(item.updatedAt, 10)}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
