// Server-side query helpers for the owner-uploaded asset library.
//
// Storage: `shared_resources` table + bucket. Rows whose `resource_type`
// starts with `asset_` are surfaced here. The payload holds the file URL,
// category, and visibility — RLS handles the org scope.
//
// This intentionally returns a shape compatible with the existing
// `AssetRecord` so the Social Studio / Image Studio pickers can consume
// uploaded items alongside the static manifest entries without branching.

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AssetRecord, AssetCategory } from "@/lib/assets";

type AssetKind = "image" | "document" | "video";

interface AssetPayload {
  category?: string;
  visibility?: "owner_only" | "team_shared";
  mime_type?: string | null;
  size_bytes?: number;
  storage_bucket?: string;
  storage_path?: string;
  public_url?: string | null;
  original_name?: string;
  kind?: AssetKind;
}

export interface UploadedAsset extends AssetRecord {
  kind: AssetKind;
  description: string | null;
  is_uploaded: true;
  created_at: string;
}

function categoryToTyped(c: string | undefined): AssetCategory {
  switch (c) {
    case "logo":
    case "background":
    case "team_photo":
    case "social_image":
    case "image_studio_reference":
      return c;
    case "document":
    case "video":
    default:
      return "unclassified";
  }
}

export async function loadOrgUploadedAssets(): Promise<UploadedAsset[]> {
  const sb = getSupabaseServerClient();
  const { data, error } = await sb
    .from("shared_resources")
    .select(
      "id,resource_type,title,description,payload,created_by,created_at,is_active"
    )
    .like("resource_type", "asset_%")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data
    .map((r) => {
      const payload = (r.payload ?? {}) as AssetPayload;
      const kind: AssetKind =
        payload.kind ??
        (r.resource_type === "asset_image"
          ? "image"
          : r.resource_type === "asset_video"
          ? "video"
          : "document");
      const visibility: "owner_only" | "team_shared" =
        payload.visibility === "owner_only" ? "owner_only" : "team_shared";
      const cat = categoryToTyped(payload.category);
      const rec: UploadedAsset = {
        id: r.id,
        category: cat,
        label: r.title,
        file_name: payload.original_name ?? r.title,
        public_path: payload.public_url ?? null,
        source_path: payload.storage_path ?? "",
        size_bytes: payload.size_bytes ?? 0,
        tags: [],
        default_visibility: visibility,
        kind,
        description: r.description,
        is_uploaded: true,
        created_at: r.created_at,
      };
      return rec;
    })
    .filter((a) => a !== null);
}

// Same as `loadOrgUploadedAssets` but filtered to images only — the picker
// in Social / Image Studio doesn't want docs or videos in the thumbnail grid.
export async function loadOrgUploadedImageAssets(): Promise<UploadedAsset[]> {
  const all = await loadOrgUploadedAssets();
  return all.filter((a) => a.kind === "image");
}

// Returns a Map<assetId, count> describing how many `social_posts` rows
// reference each asset id, either via the legacy `media_id` column (UUID
// only) or via the `metadata.media_ids` JSON array (which can hold UUIDs OR
// non-UUID tokens like manifest slugs / asset library ids).
//
// One Supabase query — RLS scopes results to rows the caller can see, which
// is fine for owner/team views. We do the aggregation in-process because
// `metadata.media_ids` is a JSON array, not a relational column. The same
// pattern is used by the admin assets page; this helper centralizes it so
// Social Studio can reuse it without duplicating logic.
export async function loadSocialAssetUsageCounts(): Promise<
  Map<string, number>
> {
  const sb = getSupabaseServerClient();
  const { data, error } = await sb
    .from("social_posts")
    .select("id,media_id,metadata");
  const counts = new Map<string, number>();
  if (error || !data) return counts;
  for (const row of data as {
    id: string;
    media_id: string | null;
    metadata: { media_ids?: unknown } | null;
  }[]) {
    // Dedupe within a post — a post that references the same asset in both
    // `media_id` and `metadata.media_ids` should still count as one usage.
    const seen = new Set<string>();
    if (row.media_id) seen.add(row.media_id);
    const ids = row.metadata?.media_ids;
    if (Array.isArray(ids)) {
      for (const v of ids) {
        if (typeof v === "string" && v) seen.add(v);
      }
    }
    for (const id of seen) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}
