import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { GeneratedMediaCard } from "@/components/images/GeneratedMediaCard";
import { ImageStudioClient } from "@/components/images/ImageStudioClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { imageLibrary } from "@/lib/assets";
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

  const { data } = await supabase
    .from("generated_media")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  const media = (data ?? []) as GeneratedMedia[];

  const falConfigured = Boolean(env.FAL_KEY);

  // Asset library entries (logos, team photos, social refs) curated by the
  // local indexer. Owner-only items are filtered out for non-owners.
  const owner = isOwner(profile);
  const assetRefs = imageLibrary().filter(
    (a) => owner || a.default_visibility === "team_shared"
  );

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
              <h2>Library</h2>
              <p>Your last 40 generations.</p>
            </div>
          </div>
          <div className="mt-4">
            {media.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="No images yet"
                description={
                  falConfigured
                    ? "Generate your first image on the left."
                    : "Add FAL_KEY in Settings → Providers to enable generation."
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {media.map((m) => (
                  <GeneratedMediaCard key={m.id} media={m} />
                ))}
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
            Hosted from <code>public/assets/</code>. Re-run{" "}
            <code>npm run index-assets</code> after dropping new files into
            the local <code>images/</code> folder.
          </p>
        </section>
      )}
    </div>
  );
}
