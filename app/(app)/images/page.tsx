import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { GeneratedMediaCard } from "@/components/images/GeneratedMediaCard";
import {
  ImageStudioClient,
  type FalReadiness,
  type ReferenceAsset,
} from "@/components/images/ImageStudioClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { imageLibrary } from "@/lib/assets";
import { loadOrgUploadedImageAssets } from "@/lib/admin/orgAssets";
import { getServerEnv } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { GeneratedMedia } from "@/types/database";

export const dynamic = "force-dynamic";

// ALLOW_PAID_IMAGE_GENERATION is read directly here (not via lib/env helpers)
// to keep this change scoped to the Image Studio page. Default is false, which
// matches the project-wide expectation that paid generation is opt-in only.
function readAllowPaidImageGeneration(): boolean {
  const raw = process.env.ALLOW_PAID_IMAGE_GENERATION;
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export default async function ImageStudioPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const [{ data }, uploadedImages] = await Promise.all([
    supabase
      .from("generated_media")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40),
    loadOrgUploadedImageAssets(),
  ]);
  const media = (data ?? []) as GeneratedMedia[];

  const falConfigured = Boolean(env.FAL_KEY);
  const paidAllowed = readAllowPaidImageGeneration();

  // Three-state readiness for the FAL chip + the guided composer's
  // "Generate image" button gate. Wording mirrors what we surface in the
  // component itself.
  const falReadiness: FalReadiness = !falConfigured
    ? "not_configured"
    : paidAllowed
    ? "ready"
    : "configured_but_paid_off";

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
    ) : falReadiness === "configured_but_paid_off" ? (
      <span className="chip-warn">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-accent-gold"
        />
        FAL · Configured but paid generation disabled
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
                    className="group overflow-hidden rounded-xl border border-ink-800 bg-checker"
                    title={a.label}
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
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-ink-950/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-ink-200">
                        {a.category.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="space-y-0.5 px-2.5 py-1.5 text-[11px]">
                      <p className="line-clamp-1 font-medium text-ink-100">
                        {a.label}
                      </p>
                      <p className="line-clamp-1 text-[10px] text-ink-300">
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
                      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                        Brand starters
                      </p>
                    </div>
                    {starters.map((a) => (
                      <article
                        key={a.id}
                        className="overflow-hidden rounded-xl border border-ink-800 bg-checker"
                        title={a.label}
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
                        <p className="line-clamp-1 px-2 py-1 text-[11px] text-ink-200">
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
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
            {assetRefs.map((a) =>
              a.public_path ? (
                <a
                  key={a.id}
                  href={a.public_path}
                  target="_blank"
                  rel="noreferrer"
                  className="group block overflow-hidden rounded-lg border border-ink-800 bg-checker"
                  title={a.label}
                >
                  <img
                    src={a.public_path}
                    alt={a.label}
                    className="aspect-square w-full object-cover transition group-hover:opacity-90"
                    loading="lazy"
                  />
                </a>
              ) : null
            )}
          </div>
          <p className="mt-3 text-[11px] text-ink-300">
            Shows owner-uploaded assets (from{" "}
            <Link href="/admin/assets" className="text-accent-gold">
              Asset Library
            </Link>
            ) plus anything in <code>public/assets/</code> via{" "}
            <code>npm run index-assets</code>.
          </p>
        </section>
      )}
    </div>
  );
}
