import { ImageIcon } from "lucide-react";

import { ImageStudioClient } from "@/components/images/ImageStudioClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getServerEnv } from "@/lib/env";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {media.map((m) => (
                  <figure
                    key={m.id}
                    className="overflow-hidden rounded-xl border border-ink-800 bg-checker"
                  >
                    {m.preview_url ? (
                      <img
                        src={m.preview_url}
                        alt={m.prompt}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="grid aspect-square place-items-center text-[10px] text-ink-300">
                        {m.status}
                      </div>
                    )}
                    <figcaption className="p-2 text-[11px] text-ink-300">
                      <span className="line-clamp-2 text-ink-100">{m.prompt}</span>
                      <span className="mt-1 flex items-center justify-between">
                        <StatusPill status={m.status as never} />
                        <span>{formatRelative(m.created_at)}</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
