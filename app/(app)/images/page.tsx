import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { GeneratedMediaCard } from "@/components/images/GeneratedMediaCard";
import {
  AssetLibraryBrowser,
  type AssetLibraryItem,
} from "@/components/images/AssetLibraryBrowser";
import {
  ImageStudioClient,
  type FalReadiness,
  type ReferenceAsset,
} from "@/components/images/ImageStudioClient";
import { LegendsOSHelpCoaches } from "@/components/help/LegendsOSHelpCoaches";
import { EmptyState } from "@/components/ui/EmptyState";
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

  // Compact, client-searchable brand-library list. `origin` is the honest
  // real-vs-shipped label: owner-uploaded assets are "uploaded" (real team
  // brand), while checked-in manifest assets are "library". Starter previews
  // shown on the empty-state row are flagged "sample" so nothing pretends to
  // be generated output.
  const uploadedIds = new Set(uploadedRefs.map((u) => u.id));
  const starterIds = new Set(starters.map((s) => s.id));
  const browserAssets: AssetLibraryItem[] = assetRefs
    .filter((a) => a.public_path)
    .map((a) => ({
      id: a.id,
      label: a.label,
      file_name: a.file_name,
      category: a.category,
      public_path: a.public_path,
      origin: uploadedIds.has(a.id)
        ? "uploaded"
        : starterIds.has(a.id)
        ? "sample"
        : "library",
    }));

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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
        <ImageStudioClient
          falReadiness={falReadiness}
          referenceAssets={composerReferenceAssets}
        />
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>{media.length > 0 ? "Library" : "Starter visuals"}</h2>
              <p>
                {media.length > 0
                  ? "Your last 40 generations."
                  : "Curated brand visuals — generate your first image and these tuck into the Brand asset library below."}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {media.length === 0 && starters.length === 0 && (
              <EmptyState
                icon={ImageIcon}
                title="No images yet"
                description={
                  falConfigured
                    ? "Generate your first image on the left."
                    : "Add FAL_KEY in Settings → Providers to enable generation."
                }
              />
            )}
            {media.length === 0 && starters.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {starters.map((a) => (
                  <article
                    key={a.id}
                    className="group overflow-hidden rounded-xl border border-ink-200 bg-checker dark:border-ink-800"
                    title={`${a.label} (Sample)`}
                  >
                    <div className="relative aspect-square">
                      {a.public_path && (
                        <img
                          src={a.public_path}
                          alt={a.label}
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      )}
                      <span className="absolute left-1.5 top-1.5 rounded-full chip-warn px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em]">
                        Sample
                      </span>
                    </div>
                    <div className="space-y-0.5 px-2.5 py-1.5 text-[11px]">
                      <p className="line-clamp-1 font-medium text-ink-900 dark:text-ink-100">
                        {a.label}
                      </p>
                      <p className="line-clamp-1 text-[10px] text-ink-500 dark:text-ink-400">
                        {a.file_name}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {media.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {media.map((m) => (
                  <GeneratedMediaCard key={m.id} media={m} />
                ))}
                {showStarters && starters.length > 0 && (
                  <>
                    <div className="col-span-full mt-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                        Brand starters · sample
                      </p>
                    </div>
                    {starters.map((a) => (
                      <article
                        key={a.id}
                        className="relative overflow-hidden rounded-xl border border-ink-200 bg-checker dark:border-ink-800"
                        title={`${a.label} (Sample)`}
                      >
                        <div className="aspect-square">
                          {a.public_path && (
                            <img
                              src={a.public_path}
                              alt={a.label}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <span className="absolute left-1.5 top-1.5 rounded-full chip-warn px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em]">
                          Sample
                        </span>
                        <p className="line-clamp-1 px-2 py-1 text-[11px] text-ink-700 dark:text-ink-200">
                          {a.label}
                        </p>
                      </article>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {assetRefs.length > 0 && (
        <section className="card-padded">
          <div className="section-title">
            <div>
              <h2>Brand asset library</h2>
              <p>
                Curated logos, team photos and references from the local
                indexer. Pickable when composing social drafts; useful as
                visual reference prompts here.
              </p>
            </div>
            {owner && (
              <Link href="/admin/assets" className="btn-ghost text-xs">
                Manage library
              </Link>
            )}
          </div>
          <div className="mt-4">
            <AssetLibraryBrowser assets={browserAssets} />
          </div>
          <p className="mt-3 text-[11px] text-ink-500 dark:text-ink-400">
            <span className="text-status-ok">Uploaded</span> = owner assets from
            the{" "}
            <Link href="/admin/assets" className="text-accent-gold">
              Asset Library
            </Link>
            ; <span className="text-status-info">Library</span> = checked-in{" "}
            <code>public/assets/</code> via <code>npm run index-assets</code>;{" "}
            <span className="text-status-warn">Sample</span> = shipped starter
            visuals.
          </p>
        </section>
      )}
    </div>
  );
}
