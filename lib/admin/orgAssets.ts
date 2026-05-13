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
