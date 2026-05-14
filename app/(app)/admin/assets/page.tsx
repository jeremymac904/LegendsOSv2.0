import Link from "next/link";
import { redirect } from "next/navigation";
import { Image as ImageIcon, Search, X } from "lucide-react";

import { AssetCard } from "@/components/admin/AssetCard";
import { AssetUploadCard } from "@/components/admin/AssetUploadCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { loadAssetManifest, type AssetCategory } from "@/lib/assets";
import { loadOrgUploadedAssets } from "@/lib/admin/orgAssets";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  logo: "Logos",
  background: "Backgrounds",
  team_photo: "Team photos",
  social_image: "Social images",
  image_studio_reference: "Image Studio references",
  unclassified: "Documents & videos",
};

// Type chips at the top of the listing. "Other" maps to anything that
// isn't an image / document / video — currently empty in practice but
// kept future-proof.
type KindFilter = "all" | "image" | "document" | "video" | "other";
const KIND_LABEL: Record<KindFilter, string> = {
  all: "All",
  image: "Images",
  document: "Docs",
  video: "Video",
  other: "Other",
};

interface PageProps {
  searchParams: { q?: string; cat?: string; kind?: string };
}

function normalizeKind(k: string | undefined): KindFilter {
  if (k === "image" || k === "document" || k === "video" || k === "other")
    return k;
  return "all";
}

type MergedAsset = {
  kind: "image" | "document" | "video";
  id: string;
  category: AssetCategory;
  label: string;
  file_name: string;
  public_path: string | null;
  tags: string[];
  default_visibility: "owner_only" | "team_shared";
  person: string | undefined;
  is_uploaded: boolean;
  // Used to sort by recency. Uploaded assets carry the row's created_at;
  // manifest assets fall back to the manifest's generated_at (or empty
  // string) so they always sort below recent uploads.
  sort_ts: string;
};

export default async function AssetLibraryPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const sb = getSupabaseServerClient();
  const [manifest, uploaded, { data: socialRefs }] = await Promise.all([
    Promise.resolve(loadAssetManifest()),
    loadOrgUploadedAssets(),
    sb.from("social_posts").select("id,media_id,metadata"),
  ]);

  const usageCount = new Map<string, number>();
  for (const row of (socialRefs ?? []) as {
    id: string;
    media_id: string | null;
    metadata: { media_ids?: unknown } | null;
  }[]) {
    const seen = new Set<string>();
    if (row.media_id) seen.add(row.media_id);
    const ids = row.metadata?.media_ids;
    if (Array.isArray(ids)) {
      for (const v of ids) {
        if (typeof v === "string" && v) seen.add(v);
      }
    }
    for (const id of seen) {
      usageCount.set(id, (usageCount.get(id) ?? 0) + 1);
    }
  }

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const activeCat = (searchParams.cat ?? "").trim() as AssetCategory | "";
  const activeKind = normalizeKind(searchParams.kind);

  const manifestTs = manifest.generated_at ?? "";

  // Merge uploaded (newest first) + manifest. Both go through the same
  // shape so the AssetCard component doesn't have to branch.
  const merged: MergedAsset[] = [
    ...uploaded.map<MergedAsset>((u) => ({
      kind:
        u.kind === "document" ? "document" : u.kind === "video" ? "video" : "image",
      id: u.id,
      category: u.category,
      label: u.label,
      file_name: u.file_name,
      public_path: u.public_path,
      tags: u.tags,
      default_visibility: u.default_visibility,
      person: undefined,
      is_uploaded: true,
      sort_ts: u.created_at,
    })),
    ...manifest.assets.map<MergedAsset>((a) => ({
      kind: "image",
      id: a.id,
      category: a.category,
      label: a.label,
      file_name: a.file_name,
      public_path: a.public_path,
      tags: a.tags,
      default_visibility: a.default_visibility,
      person: a.person,
      is_uploaded: false,
      sort_ts: manifestTs,
    })),
  ];

  // Default sort: newest first by sort_ts, falling back to label asc when
  // timestamps are equal (manifest assets all share the same ts).
  merged.sort((a, b) => {
    const diff = (b.sort_ts || "").localeCompare(a.sort_ts || "");
    if (diff !== 0) return diff;
    return a.label.localeCompare(b.label);
  });

  let assets = merged;
  if (q) {
    assets = assets.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.file_name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  if (activeCat) {
    assets = assets.filter((a) => a.category === activeCat);
  }
  if (activeKind !== "all") {
    assets = assets.filter((a) =>
      activeKind === "other"
        ? !(a.kind === "image" || a.kind === "document" || a.kind === "video")
        : a.kind === activeKind
    );
  }

  const counts: Record<string, number> = {};
  for (const a of merged) {
    counts[a.category] = (counts[a.category] ?? 0) + 1;
  }
  const kindCounts: Record<KindFilter, number> = {
    all: merged.length,
    image: merged.filter((a) => a.kind === "image").length,
    document: merged.filter((a) => a.kind === "document").length,
    video: merged.filter((a) => a.kind === "video").length,
    other: 0,
  };

  function buildHref(next: {
    q?: string | null;
    cat?: AssetCategory | null;
    kind?: KindFilter | null;
  }): string {
    const params = new URLSearchParams();
    const qNext = next.q === undefined ? searchParams.q : next.q;
    const catNext = next.cat === undefined ? activeCat : next.cat;
    const kindNext = next.kind === undefined ? activeKind : next.kind;
    if (qNext) params.set("q", qNext);
    if (catNext) params.set("cat", catNext);
    if (kindNext && kindNext !== "all") params.set("kind", kindNext);
    const qs = params.toString();
    return qs ? `/admin/assets?${qs}` : "/admin/assets";
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin · Asset Library"
        title="Brand & content assets"
        description={`${merged.length} assets (${uploaded.length} uploaded · ${manifest.assets.length} indexed${
          manifest.generated_at
            ? `, last scanned ${new Date(manifest.generated_at).toLocaleString()}`
            : ""
        }). Uploads are saved to Supabase Storage and visible to your team based on the visibility you set. Sorted newest-first by default.`}
        action={
          <StatusPill
            status="ok"
            label="upload to add new assets — no terminal needed"
          />
        }
      />

      <AssetUploadCard />

      <div className="card-padded space-y-3">
        <form className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px]">
            <span className="label flex items-center gap-1">
              <Search size={11} />
              Search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="name, file, tag…"
              className="input mt-1"
            />
          </label>
          {activeCat && <input type="hidden" name="cat" value={activeCat} />}
          {activeKind !== "all" && (
            <input type="hidden" name="kind" value={activeKind} />
          )}
          <button type="submit" className="btn-primary">
            Search
          </button>
          {(searchParams.q || searchParams.cat || activeKind !== "all") && (
            <Link href="/admin/assets" className="btn">
              Reset
            </Link>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Type
          </span>
          {(Object.keys(KIND_LABEL) as KindFilter[]).map((k) => (
            <CategoryChip
              key={k}
              label={KIND_LABEL[k]}
              count={kindCounts[k]}
              href={buildHref({ kind: k })}
              active={activeKind === k}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Category
          </span>
          <CategoryChip
            label="All"
            count={merged.length}
            href={buildHref({ cat: null })}
            active={!activeCat}
          />
          {(Object.keys(CATEGORY_LABEL) as AssetCategory[])
            .filter((k) => (counts[k] ?? 0) > 0)
            .map((k) => (
              <CategoryChip
                key={k}
                label={CATEGORY_LABEL[k]}
                count={counts[k] ?? 0}
                href={buildHref({ cat: k })}
                active={activeCat === k}
              />
            ))}
          {activeCat && (
            <Link
              href={buildHref({ cat: null })}
              className="inline-flex items-center gap-1 rounded-full border border-ink-700 px-2 py-1 text-[11px] text-ink-300 transition hover:border-status-err/40 hover:text-status-err"
              title="Clear category filter"
            >
              <X size={10} />
              Clear
            </Link>
          )}
        </div>
      </div>

      <p className="text-[11px] text-ink-300">
        Showing {assets.length} of {merged.length} assets
        {activeKind !== "all" && ` · type: ${KIND_LABEL[activeKind]}`}
        {activeCat && ` · category: ${CATEGORY_LABEL[activeCat as AssetCategory] ?? activeCat}`}
        {q && ` · search: "${q}"`}
      </p>

      {assets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No assets match"
          description="Try clearing filters, uploading something new above, or re-running the indexer."
        />
      ) : (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((a) => (
            <AssetCard
              key={`${a.is_uploaded ? "u" : "m"}-${a.id}`}
              id={a.id}
              kind={a.kind}
              category={a.category}
              categoryLabel={CATEGORY_LABEL[a.category] ?? a.category}
              label={a.label}
              fileName={a.file_name}
              publicPath={a.public_path}
              visibility={a.default_visibility}
              tags={a.tags}
              person={a.person}
              isUploaded={a.is_uploaded}
              usageCount={usageCount.get(a.id) ?? 0}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  href,
  active,
}: {
  label: string;
  count: number;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center gap-1 rounded-full border border-accent-gold/50 bg-accent-gold/10 px-2.5 py-1 text-[11px] font-medium text-accent-gold"
          : "inline-flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/40 px-2.5 py-1 text-[11px] text-ink-200 transition hover:border-ink-500 hover:text-ink-100"
      }
    >
      {label}
      <span
        className={
          active
            ? "rounded-full bg-accent-gold/20 px-1.5 text-[10px] tabular-nums"
            : "rounded-full bg-ink-800 px-1.5 text-[10px] tabular-nums text-ink-300"
        }
      >
        {count}
      </span>
    </Link>
  );
}
