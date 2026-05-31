import {
  ImageStudioClient,
  type FalReadiness,
  type ReferenceAsset,
} from "@/components/images/ImageStudioClient";
import {
  MediaLibraryPanel,
  type PanelAsset,
} from "@/components/images/MediaLibraryPanel";
import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { imageLibrary } from "@/lib/assets";
import { loadOrgUploadedImageAssets } from "@/lib/admin/orgAssets";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { GeneratedMedia } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ImageStudioPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const [{ data }, uploadedImages, { data: falProviderRow }] = await Promise.all([
    supabase
      .from("generated_media")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40),
    loadOrgUploadedImageAssets(),
    supabase
      .from("provider_credentials_public")
      .select("provider,is_enabled")
      .eq("provider", "fal")
      .maybeSingle(),
  ]);
  const media = (data ?? []) as GeneratedMedia[];

  const falStatus = getAIProviderStatuses().find((p) => p.id === "fal");
  const falConfigured = Boolean(env.FAL_KEY);
  const falOwnerEnabled = falProviderRow?.is_enabled !== false;
  const falEnabled = Boolean(falStatus?.enabled && falOwnerEnabled);

  // Readiness for the FAL chip + guided composer button. The API route already
  // enforces configured/enabled provider state; keep the UI aligned with that
  // so configured Fal.ai does not look blocked by the old paid-generation flag.
  const falReadiness: FalReadiness = !falConfigured
    ? "not_configured"
    : falEnabled
    ? "ready"
    : "provider_disabled";

  // Asset library entries (logos, team photos, social refs) curated by the
  // local indexer. Owner-only items are filtered out for non-owners. Owner-
  // uploaded assets join the same gallery — they're already filtered to
  // images-only and respect the visibility chosen at upload.
  const owner = isOwner(profile);
  const manifestRefs = imageLibrary().filter(
    (a) => owner || a.default_visibility === "team_shared"
  );
  const uploadedRefs = uploadedImages.filter(
    (a) => owner || a.default_visibility === "team_shared"
  );
  const assetRefs = [...uploadedRefs, ...manifestRefs];

  // The composer's "Reference asset" dropdown wants a lightweight shape: only
  // pickable items with a public URL or a label we can stuff into the prompt.
  const composerReferenceAssets: ReferenceAsset[] = assetRefs
    .filter((a) => a.public_path)
    .map((a) => ({
      id: a.id,
      label: a.label,
      public_path: a.public_path,
      source: uploadedRefs.some((u) => u.id === a.id) ? "uploaded" : "library",
    }));

  // When the user has < 4 generations we show a "Starter visuals" row that
  // surfaces the strongest brand-library images, so the right column never
  // looks empty for a fresh deploy. Starters are read-only previews;
  // generated_media rows still take priority.
  const SHOW_STARTERS_THRESHOLD = 4;
  const starters = assetRefs
    .filter(
      (a) =>
        a.public_path &&
        (a.category === "social_image" ||
          a.category === "image_studio_reference" ||
          a.category === "background")
    )
    .slice(0, 6);
  const showStarters = media.length < SHOW_STARTERS_THRESHOLD;

  // Trim the asset records to the serializable shape the client panel needs.
  // (The full AssetRecord carries Node-only source paths we never expose.)
  const toPanelAsset = (a: (typeof assetRefs)[number]): PanelAsset => ({
    id: a.id,
    label: a.label,
    file_name: a.file_name,
    public_path: a.public_path,
    category: a.category,
  });
  const panelAssets = assetRefs.map(toPanelAsset);
  const panelStarters = starters.map(toPanelAsset);

  // Three-state chip surfaced in the SectionHeader action slot. The
  // composer renders its own chip too — both pull from the same value so
  // they always agree.
  const readinessChip =
    falReadiness === "ready" ? (
      <span className="chip-ok">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-status-ok"
        />
        FAL · Ready
      </span>
    ) : falReadiness === "provider_disabled" ? (
      <span className="chip-warn">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-accent-gold"
        />
        FAL · Disabled in Settings
      </span>
    ) : (
      <span className="chip-off">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-status-off"
        />
        FAL · Not configured
      </span>
    );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Image Studio"
        title="Mortgage marketing visuals"
        description="Brand-aware image generation via Fal.ai. Outputs save to Supabase Storage and can be attached to social drafts."
        action={<div className="flex flex-wrap gap-2">{readinessChip}</div>}
      />
      <LegendsOSHelpCoaches
        coaches={["marketing"]}
        intro="Use the official marketing image coach before generating campaign visuals, preparing reference photos, or tightening Image Studio prompts."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.7fr]">
        <ImageStudioClient
          falReadiness={falReadiness}
          referenceAssets={composerReferenceAssets}
        />
        <MediaLibraryPanel
          media={media}
          starters={panelStarters}
          assetRefs={panelAssets}
          showStarters={showStarters}
          falConfigured={falConfigured}
          owner={owner}
        />
      </div>
    </div>
  );
}
