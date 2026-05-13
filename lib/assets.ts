import { readFileSync } from "node:fs";
import { join } from "node:path";

export type AssetCategory =
  | "logo"
  | "background"
  | "team_photo"
  | "social_image"
  | "image_studio_reference"
  | "unclassified";

export interface AssetRecord {
  id: string;
  category: AssetCategory;
  label: string;
  file_name: string;
  public_path: string | null;
  source_path: string;
  size_bytes: number;
  tags: string[];
  default_visibility: "owner_only" | "team_shared";
  person?: string;
  notes?: string;
}

export interface AssetManifest {
  generated_at: string;
  summary: Record<string, number>;
  assets: AssetRecord[];
}

// Read the manifest committed into public/assets/manifest.json. This runs
// at request time on the server (force-dynamic pages); the fs read costs
// nothing relative to a Supabase query and avoids a separate API hop.
let cached: AssetManifest | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

export function loadAssetManifest(): AssetManifest {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) return cached;
  const path = join(process.cwd(), "public", "assets", "manifest.json");
  try {
    const raw = readFileSync(path, "utf-8");
    cached = JSON.parse(raw) as AssetManifest;
    cachedAt = now;
    return cached;
  } catch {
    return { generated_at: "", summary: {}, assets: [] };
  }
}

export function findBackground(mode: "dark" | "light"): AssetRecord | undefined {
  return loadAssetManifest().assets.find(
    (a) => a.category === "background" && a.tags.includes(mode)
  );
}

export function publicAssets(
  filter?: (a: AssetRecord) => boolean
): AssetRecord[] {
  return loadAssetManifest()
    .assets.filter((a) => a.public_path)
    .filter(filter ?? (() => true));
}

// Image library (Image Studio + Social Studio) — these are the assets we
// want to surface as selectable, in addition to the user's generated_media
// rows. Logos and backgrounds make great image-studio references; team
// photos and social images can be attached to social drafts.
export function imageLibrary(): AssetRecord[] {
  return publicAssets((a) =>
    ["logo", "background", "team_photo", "social_image", "image_studio_reference"].includes(
      a.category
    )
  );
}
