import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  Search,
  Users2,
  Video,
  X,
} from "lucide-react";

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

interface PageProps {
  searchParams: { q?: string; cat?: string };
}

export default async function AssetLibraryPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const sb = getSupabaseServerClient();
  const [manifest, uploaded, { data: socialRefs }] = await Promise.all([
    Promise.resolve(loadAssetManifest()),
    loadOrgUploadedAssets(),
    // One query, then aggregate per asset id below. Used to render the
    // "Used in N posts" chip on each asset card.
    sb
      .from("social_posts")
      .select("id,media_id,metadata"),
  ]);

  // Build a Map<string assetId/token, number>. The token shape is whatever
  // the social composer stores in metadata.media_ids — that can be a real
  // generated_media UUID, an uploaded shared_resources UUID, or a manifest
  // slug like "team-jeremy". We count any of those equally. The single
  // `media_id` column is also counted (UUID only).
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

  // Merge manifest (static, repo-checked-in) with uploaded (db-backed).
  // Uploaded items come first because they're newer and the owner just made
  // them — they should be most visible.
  const merged = [
    ...uploaded.map((u) => ({
      kind:
        u.kind === "document" ? "document" : u.kind === "video" ? "video" : ("image" as const),
      id: u.id,
      category: u.category,
      label: u.label,
      file_name: u.file_name,
      public_path: u.public_path,
      tags: u.tags,
      default_visibility: u.default_visibility,
      person: undefined as string | undefined,
      is_uploaded: true as const,
    })),
    ...manifest.assets.map((a) => ({
      kind: "image" as const,
      id: a.id,
      category: a.category,
      label: a.label,
      file_name: a.file_name,
      public_path: a.public_path,
      tags: a.tags,
      default_visibility: a.default_visibility,
      person: a.person,
      is_uploaded: false as const,
    })),
  ];

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

  const counts: Record<string, number> = {};
  for (const a of merged) {
    counts[a.category] = (counts[a.category] ?? 0) + 1;
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
        }). Uploads are saved to Supabase Storage and visible to your team based on the visibility you set.`}
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
          {activeCat && (
            <input type="hidden" name="cat" value={activeCat} />
          )}
          <button type="submit" className="btn-primary">
            Search
          </button>
          {(searchParams.q || searchParams.cat) && (
            <Link href="/admin/assets" className="btn">
              Reset
            </Link>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Category
          </span>
          <CategoryChip
            label="All"
            count={merged.length}
            href={searchParams.q ? `/admin/assets?q=${encodeURIComponent(searchParams.q)}` : "/admin/assets"}
            active={!activeCat}
          />
          {(Object.keys(CATEGORY_LABEL) as AssetCategory[])
            .filter((k) => (counts[k] ?? 0) > 0)
            .map((k) => {
              const params = new URLSearchParams();
              if (searchParams.q) params.set("q", searchParams.q);
              params.set("cat", k);
              return (
                <CategoryChip
                  key={k}
                  label={CATEGORY_LABEL[k]}
                  count={counts[k] ?? 0}
                  href={`/admin/assets?${params.toString()}`}
                  active={activeCat === k}
                />
              );
            })}
          {activeCat && (
            <Link
              href={searchParams.q ? `/admin/assets?q=${encodeURIComponent(searchParams.q)}` : "/admin/assets"}
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
            <article
              key={a.id}
              className="card overflow-hidden"
              title={a.file_name}
            >
              <div className="aspect-square w-full bg-checker">
                {a.kind === "image" && a.public_path ? (
                  <img
                    src={a.public_path}
                    alt={a.label}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : a.kind === "video" ? (
                  <div className="grid h-full w-full place-items-center text-ink-300">
                    <Video size={28} />
                    <span className="mt-1 text-[10px]">video</span>
                  </div>
                ) : a.kind === "document" ? (
                  <div className="grid h-full w-full place-items-center text-ink-300">
                    <FileText size={28} />
                    <span className="mt-1 text-[10px]">
                      .{a.file_name.split(".").pop()}
                    </span>
                  </div>
                ) : (
                  <div className="grid h-full w-full place-items-center text-[10px] text-ink-300">
                    <ImageIcon size={18} />
                    <span className="mt-1">local-only</span>
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3 text-xs">
                <p className="line-clamp-1 font-medium text-ink-100">
                  {a.label}
                </p>
                <p className="line-clamp-1 text-[10px] text-ink-300">
                  {a.file_name}
                </p>
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="chip">
                    {CATEGORY_LABEL[a.category] ?? a.category}
                  </span>
                  <UsageChip count={usageCount.get(a.id) ?? 0} />
                  {a.is_uploaded && (
                    <span className="chip-ok text-[10px]">uploaded</span>
                  )}
                  {a.default_visibility === "team_shared" ? (
                    <span className="chip-ok">
                      <Users2 size={10} />
                      team shared
                    </span>
                  ) : (
                    <span className="chip-info">owner only</span>
                  )}
                  {a.person && (
                    <span className="chip text-[10px]">{a.person}</span>
                  )}
                  {a.tags.map((t) => (
                    <span key={t} className="chip text-[10px]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
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
