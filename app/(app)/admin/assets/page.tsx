import { redirect } from "next/navigation";

import { AssetLibraryGrid, type AssetGridItem } from "@/components/admin/AssetLibraryGrid";
import { AssetUploadCard } from "@/components/admin/AssetUploadCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { loadAssetManifest, type AssetCategory } from "@/lib/assets";
import { loadOrgUploadedAssets } from "@/lib/admin/orgAssets";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  logo: "Logos",
  background: "Backgrounds",
  team_photo: "Team photos",
  social_image: "Social images",
  image_studio_reference: "Image Studio references",
  unclassified: "Documents & videos",
};

export default async function AssetLibraryPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const sb = getSupabaseServerClient();
  const [manifest, uploaded, { data: socialRefs }] = await Promise.all([
    Promise.resolve(loadAssetManifest()),
    loadOrgUploadedAssets(),
    sb.from("social_posts").select("id,media_id,metadata"),
  ]);

  // Count how many social drafts reference each asset id, so each card can
  // honestly say whether deleting it would orphan a draft.
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

  const manifestTs = manifest.generated_at ?? "";

  // Merge uploaded (real Supabase rows) + manifest (checked-in library) into a
  // single shape. `origin` is the honest source label, mirroring
  // components/images/AssetLibraryBrowser.tsx: uploaded → real team brand,
  // library → repo-managed manifest, sample → a tagged starter visual.
  const items: AssetGridItem[] = [
    ...uploaded.map<AssetGridItem & { sortTs: string }>((u) => ({
      kind:
        u.kind === "document" ? "document" : u.kind === "video" ? "video" : "image",
      id: u.id,
      category: u.category,
      categoryLabel: CATEGORY_LABEL[u.category] ?? u.category,
      label: u.label,
      fileName: u.file_name,
      publicPath: u.public_path,
      visibility: u.default_visibility,
      tags: u.tags,
      person: undefined,
      isUploaded: true,
      usageCount: usageCount.get(u.id) ?? 0,
      origin: "uploaded",
      sortTs: u.created_at,
    })),
    ...manifest.assets.map<AssetGridItem & { sortTs: string }>((a) => ({
      kind: "image",
      id: a.id,
      category: a.category,
      categoryLabel: CATEGORY_LABEL[a.category] ?? a.category,
      label: a.label,
      fileName: a.file_name,
      publicPath: a.public_path,
      visibility: a.default_visibility,
      tags: a.tags,
      person: a.person,
      isUploaded: false,
      usageCount: usageCount.get(a.id) ?? 0,
      origin: a.tags.some((t) => t.toLowerCase() === "sample")
        ? "sample"
        : "library",
      sortTs: manifestTs,
    })),
  ]
    // Newest uploads first; manifest entries (shared ts) fall back to label.
    .sort((a, b) => {
      const diff = (b.sortTs || "").localeCompare(a.sortTs || "");
      return diff !== 0 ? diff : a.label.localeCompare(b.label);
    })
    .map(({ sortTs: _sortTs, ...rest }) => rest);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin · Asset Library"
        title="Brand & content assets"
        description={`${items.length} assets · ${uploaded.length} uploaded to Supabase Storage · ${manifest.assets.length} in the checked-in library${
          manifest.generated_at
            ? `, last scanned ${new Date(manifest.generated_at).toLocaleDateString()}`
            : ""
        }. Uploads are shared with your team based on the visibility you set. Sorted newest-first.`}
        action={
          <StatusPill status="ok" label="upload to add new assets — no terminal needed" />
        }
      />

      <AssetUploadCard />

      <AssetLibraryGrid assets={items} />
    </div>
  );
}
