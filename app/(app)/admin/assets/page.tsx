import { redirect } from "next/navigation";
import { Image as ImageIcon, Search, Users2 } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { loadAssetManifest, type AssetCategory } from "@/lib/assets";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  logo: "Logos",
  background: "Backgrounds",
  team_photo: "Team photos",
  social_image: "Social images",
  image_studio_reference: "Image Studio references",
  unclassified: "Unclassified",
};

interface PageProps {
  searchParams: { q?: string; cat?: string };
}

export default async function AssetLibraryPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const manifest = loadAssetManifest();
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const activeCat = (searchParams.cat ?? "").trim() as AssetCategory | "";

  let assets = manifest.assets;
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

  const counts = manifest.summary as Record<AssetCategory, number>;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin · Asset Library"
        title="Local asset index"
        description={`${manifest.assets.length} assets indexed${
          manifest.generated_at
            ? ` (last scanned ${new Date(manifest.generated_at).toLocaleString()})`
            : ""
        }. Items copied to /public/assets are served live; everything else is listed for awareness only.`}
        action={
          <StatusPill
            status="info"
            label="run npm run index-assets to refresh"
          />
        }
      />

      <form className="card-padded flex flex-wrap items-end gap-3">
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
        <label>
          <span className="label">Category</span>
          <select
            name="cat"
            defaultValue={searchParams.cat ?? ""}
            className="input mt-1"
          >
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABEL) as AssetCategory[]).map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABEL[k]} ({counts[k] ?? 0})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      {assets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No assets match"
          description="Try clearing filters or re-run the indexer."
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
                {a.public_path ? (
                  <img
                    src={a.public_path}
                    alt={a.label}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
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
                  <span className="chip">{CATEGORY_LABEL[a.category]}</span>
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
