import { redirect } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  Search,
  Users2,
  Video,
} from "lucide-react";

import { AssetUploadCard } from "@/components/admin/AssetUploadCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { loadAssetManifest, type AssetCategory } from "@/lib/assets";
import { loadOrgUploadedAssets } from "@/lib/admin/orgAssets";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile } from "@/lib/supabase/server";

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

  const [manifest, uploaded] = await Promise.all([
    Promise.resolve(loadAssetManifest()),
    loadOrgUploadedAssets(),
  ]);

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
