import Link from "next/link";
import { ExternalLink, PlayCircle, PlugZap, Share2 } from "lucide-react";

import { SocialComposer } from "@/components/social/SocialComposer";
import { Accordion, type AccordionItemData } from "@/components/ui/Accordion";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { imageLibrary } from "@/lib/assets";
import {
  loadOrgUploadedImageAssets,
  loadSocialAssetUsageCounts,
} from "@/lib/admin/orgAssets";
import { getServerEnv } from "@/lib/env";
import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";
import type { GeneratedMedia, SocialPost, SocialChannel } from "@/types/database";

export const dynamic = "force-dynamic";

interface PageProps {
  // `media` preselects an attachment from Image Studio.
  // `prefill` is a JSON-encoded handoff from Atlas — strict allowlist
  // of fields (title/body/channels) is enforced server-side before passing
  // to the composer.
  searchParams: { media?: string; prefill?: string };
}

// Strict allowlist decode for the Atlas prefill query param. Never trust the
// URL contents — only copy known scalar fields, and discard anything else.
function decodePrefill(raw: string | undefined): {
  title?: string;
  body?: string;
  channels?: SocialChannel[];
} | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const allowedChannels: SocialChannel[] = [
      "facebook",
      "instagram",
      "google_business_profile",
      "youtube",
    ];
    const out: {
      title?: string;
      body?: string;
      channels?: SocialChannel[];
    } = {};
    if (typeof parsed.title === "string") out.title = parsed.title.slice(0, 160);
    if (typeof parsed.body === "string") out.body = parsed.body.slice(0, 8000);
    if (Array.isArray(parsed.channels)) {
      const filtered = parsed.channels.filter(
        (c): c is SocialChannel =>
          typeof c === "string" && (allowedChannels as string[]).includes(c)
      );
      if (filtered.length > 0) out.channels = filtered;
    }
    return out;
  } catch {
    return null;
  }
}

type SocialMediaPreview = Pick<GeneratedMedia, "prompt" | "preview_url">;

function mediaLooksLikeVideo(media: SocialMediaPreview): boolean {
  const value = `${media.prompt ?? ""} ${media.preview_url ?? ""}`.toLowerCase();
  return (
    value.includes("video/") ||
    /\.(mp4|mov|m4v|webm)(?:$|[?#])/i.test(value)
  );
}

function SavedPostMediaThumb({ media }: { media: SocialMediaPreview }) {
  if (!media.preview_url) return null;
  if (mediaLooksLikeVideo(media)) {
    return (
      <span className="relative block h-14 w-14 overflow-hidden rounded-lg border border-ink-200 bg-ink-950 dark:border-ink-800">
        <video
          src={media.preview_url}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          title={media.prompt ?? "Attached video"}
        />
        <span className="absolute inset-0 grid place-items-center bg-black/15 text-white/90">
          <PlayCircle size={16} />
        </span>
      </span>
    );
  }
  return (
    <img
      src={media.preview_url}
      alt={media.prompt ?? ""}
      className="h-14 w-14 rounded-lg border border-ink-200 object-cover dark:border-ink-800"
    />
  );
}

export default async function SocialStudioPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = getSupabaseServerClient();
  const env = getServerEnv();

  const [{ data: postRows }, { data: mediaRows }, uploadedImageAssets, usageCounts] =
    await Promise.all([
      supabase
        .from("social_posts")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("generated_media")
        .select("id,prompt,preview_url,status,created_at,provider,model")
        .eq("status", "succeeded")
        .order("created_at", { ascending: false })
        .limit(48),
      loadOrgUploadedImageAssets(),
      loadSocialAssetUsageCounts(),
    ]);

  // Atlas handoff: ?prefill=<urlencoded JSON> opens the create-form prefilled
  // WITHOUT creating a row. Atlas may also send users to /social/<id> after
  // creating a draft — that path is handled by the [postId] route.
  const atlasPrefill = decodePrefill(searchParams?.prefill);

  // Convert the Map to a plain Record so we can pass it to the client
  // component (Maps don't serialize cleanly through the RSC boundary).
  const assetUsage: Record<string, number> = {};
  for (const [k, v] of usageCounts) assetUsage[k] = v;

  const posts = (postRows ?? []) as SocialPost[];
  const generatedRows = (mediaRows ?? []) as Pick<
    GeneratedMedia,
    "id" | "prompt" | "preview_url" | "status" | "created_at" | "provider" | "model"
  >[];

  // Manifest-based assets (logos, team photos, etc. checked into the repo).
  const manifestAssetEntries: Pick<
    GeneratedMedia,
    "id" | "prompt" | "preview_url" | "status" | "created_at" | "provider" | "model"
  >[] = imageLibrary().map((a) => ({
    id: a.id,
    prompt: a.label,
    preview_url: a.public_path,
    status: "succeeded",
    created_at: new Date(0).toISOString(),
    provider: `asset:${a.category}`,
    model: null,
  }));

  // Owner-uploaded assets from shared_resources (new — added in this sprint).
  // Order newest first.
  const uploadedAssetEntries: Pick<
    GeneratedMedia,
    "id" | "prompt" | "preview_url" | "status" | "created_at" | "provider" | "model"
  >[] = uploadedImageAssets.map((a) => ({
    id: a.id,
    prompt: a.label,
    preview_url: a.public_path,
    status: "succeeded",
    created_at: new Date().toISOString(),
    provider: `asset:uploaded:${a.category}`,
    model: null,
  }));

  // Generated media first (most recent), then uploaded assets, then the
  // checked-in manifest.
  const mediaLibrary = [
    ...generatedRows,
    ...uploadedAssetEntries,
    ...manifestAssetEntries,
  ];

  // Resolve preview URLs for any post.media_id so the saved-list shows thumbnails.
  const mediaById = new Map(mediaLibrary.map((m) => [m.id, m]));
  const preselectedMediaId = searchParams?.media ?? null;

  const publishEnabled = env.SAFETY.allowLiveSocialPublish;
  const n8nConnected = Boolean(env.N8N_WEBHOOKS.social_publish);
  const platformWebhooksReady = Boolean(
    env.N8N_WEBHOOKS.facebook_post ||
      env.N8N_WEBHOOKS.instagram_post ||
      env.N8N_WEBHOOKS.gbp_post ||
      env.N8N_WEBHOOKS.youtube_post
  );

  const setupItems: AccordionItemData[] = [
    {
      id: "posting-setup",
      title: "Posting setup path",
      icon: PlugZap,
      meta: (
        <span className="hidden sm:inline">
          {publishEnabled ? "publishing enabled" : "publishing disabled"}
        </span>
      ),
      children: (
        <div className="space-y-3">
          <p className="text-xs text-ink-600 dark:text-ink-300">
            Drafting is live. External publishing stays disabled until the owner
            flag and n8n webhooks are configured.
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            <SetupStatusCard
              title="Owner publish flag"
              detail="ALLOW_LIVE_SOCIAL_PUBLISH"
              ready={publishEnabled}
            />
            <SetupStatusCard
              title="n8n publish broker"
              detail="N8N_WEBHOOK_SOCIAL_PUBLISH"
              ready={n8nConnected}
            />
            <SetupStatusCard
              title="Platform webhooks"
              detail="FACEBOOK / INSTAGRAM / GBP / YOUTUBE"
              ready={platformWebhooksReady}
            />
          </div>
          <Link href="/settings" className="btn-ghost text-xs">
            <ExternalLink size={13} />
            Open setup
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Social Studio"
        title="Multi-channel drafts"
        description="Compose once, target multiple channels. Attach generated images, upload your own files, and save without publishing."
        action={
          <div className="flex flex-wrap gap-2">
            <StatusPill
              status={publishEnabled ? "ok" : "warn"}
              label={
                publishEnabled
                  ? "live publishing on"
                  : "live publishing off"
              }
            />
            <StatusPill
              status={n8nConnected ? "ok" : "off"}
              label={n8nConnected ? "n8n connected" : "n8n not connected"}
            />
          </div>
        }
      />

      {/* Compact status bar + collapsible setup detail, so the composer sits
          near the top instead of below a tall 3-up card grid. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white/70 px-3 py-2 text-xs dark:border-ink-800 dark:bg-ink-950/40">
        <span className="font-medium text-ink-900 dark:text-ink-100">
          Drafting live
        </span>
        <span className="text-ink-500 dark:text-ink-400">·</span>
        <span className="text-ink-600 dark:text-ink-300">
          Live publishing is{" "}
          {publishEnabled ? (
            <span className="text-status-ok">enabled</span>
          ) : (
            <span className="text-status-warn">disabled</span>
          )}
        </span>
        <span className="text-ink-500 dark:text-ink-400">·</span>
        <span className="text-ink-600 dark:text-ink-300">
          n8n {n8nConnected ? "connected" : "not connected"}
        </span>
        <Link href="/settings" className="btn-ghost ml-auto text-[11px]">
          <ExternalLink size={12} />
          Setup
        </Link>
      </div>

      <SocialComposer
        userId={profile.id}
        mediaLibrary={mediaLibrary}
        initialSelectedMediaId={preselectedMediaId}
        assetUsage={assetUsage}
        atlasPrefill={atlasPrefill}
      />

      <Accordion items={setupItems} />

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Your posts</h2>
            <p>Drafts and scheduled posts you own.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {posts.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="No posts yet"
              description="Use the composer above to create your first draft."
            />
          ) : (
            posts.map((p) => {
              const primary = p.media_id ? mediaById.get(p.media_id) : null;
              const extras = (
                (p.metadata as { media_ids?: string[] })?.media_ids ?? []
              ).filter((id) => id !== p.media_id);
              const extraMedia = extras
                .map((id) => mediaById.get(id))
                .filter((m): m is NonNullable<typeof m> => Boolean(m));
              return (
                <article
                  key={p.id}
                  className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                        {p.title ?? "Untitled draft"}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-600 dark:text-ink-300">
                        {p.body}
                      </p>
                    </div>
                    <StatusPill status={p.status as never} />
                  </header>
                  {(primary || extraMedia.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {primary?.preview_url && (
                        <SavedPostMediaThumb media={primary} />
                      )}
                      {extraMedia.map(
                        (m) =>
                          m.preview_url && (
                            <SavedPostMediaThumb
                              key={m.id}
                              media={m}
                            />
                          )
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-600 dark:text-ink-300">
                    <div className="flex flex-wrap gap-1">
                      {p.channels.map((c) => (
                        <span key={c} className="chip">
                          {c.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    <span>Updated {formatRelative(p.updated_at)}</span>
                  </div>
                  {p.error_message && (
                    <p className="mt-2 rounded-lg border border-status-err/30 bg-status-err/10 px-2 py-1 text-[11px] text-status-err">
                      {p.error_message}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function SetupStatusCard({
  title,
  detail,
  ready,
}: {
  title: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
      <div className="flex items-center justify-between gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
          <PlugZap size={14} />
        </span>
        <StatusPill status={ready ? "ok" : "warn"} label={ready ? "ready" : "setup needed"} />
      </div>
      <p className="mt-3 text-sm font-medium text-ink-900 dark:text-ink-100">{title}</p>
      <p className="mt-1 font-mono text-[10px] text-ink-500 dark:text-ink-400">{detail}</p>
    </div>
  );
}
