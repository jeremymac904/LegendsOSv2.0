import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { GeneratedMediaCard } from "@/components/images/GeneratedMediaCard";
import { ImageStudioClient } from "@/components/images/ImageStudioClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
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

  // Asset library entries (logos, team photos, social refs) curated by the
  // local indexer. Owner-only items are filtered out for non-owners.
  // The owner-uploaded assets join the same gallery — they're already
  // filtered to images-only and respect the visibility chosen at upload.
  const owner = isOwner(profile);
  const manifestRefs = imageLibrary().filter(
    (a) => owner || a.default_visibility === "team_shared"
  );
  const uploadedRefs = uploadedImages.filter(
    (a) => owner || a.default_visibility === "team_shared"
  );
  const assetRefs = [...uploadedRefs, ...manifestRefs];

  // When the user has < 4 generations we show a "Starter visuals" row that
  // surfaces the strongest brand-library images, so the right column never
  // looks empty for a fresh deploy. The starters are read-only previews;
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

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Image Studio"
        title="Mortgage marketing visuals"
        description="Brand-aware image generation via Fal.ai. Outputs save to Supabase Storage and can be attached to social drafts."
        action={
          <div className="flex flex-wrap gap-2">
            <StatusPill
              status={falConfigured ? "configured" : "missing"}
              label={
                falConfigured
                  ? "Fal.ai ready"
                  : "FAL_KEY or FAL_API_KEY missing"
              }
            />
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
        <ImageStudioClient />
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
