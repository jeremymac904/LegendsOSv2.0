import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueAutomationJob } from "@/lib/automation/n8n";
import { recordPublishAttempt } from "@/lib/integrations/audit";
import { createGbpPost, isGbpConnected } from "@/lib/integrations/gbp";
import { resolveLiveAction } from "@/lib/integrations/liveSettings";
import {
  type MetaPublishPost,
  MetaPublishGateError,
  publishToMeta,
} from "@/lib/integrations/meta";
import { isYoutubeConnected, uploadYoutubeVideo } from "@/lib/integrations/youtube";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
  isMissingDatabaseObjectError,
} from "@/lib/supabase/server";
import { logUsage, recordAudit } from "@/lib/usage";
import type { SocialChannel } from "@/types/database";

const channels = [
  "facebook",
  "instagram",
  "google_business_profile",
  "youtube",
] as const;

// Each social channel maps to the signed-in user's exact
// social_account_connections.platform row whose publish switch must be ON.
// App credentials can be global; destinations and toggles are user-owned.
const CHANNEL_PLATFORM: Record<(typeof channels)[number], string> = {
  facebook: "facebook",
  instagram: "instagram",
  google_business_profile: "google_business_profile",
  youtube: "youtube",
};

// Returns the set of selected platforms whose user-owned publish switch is ON.
// Best-effort: missing table / no rows yields an empty set (fail-closed).
async function publishEnabledPlatforms(
  userId: string,
  selectedPlatforms: string[]
): Promise<Set<string>> {
  try {
    if (selectedPlatforms.length === 0) return new Set();
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("social_account_connections")
      .select("platform,is_publish_enabled")
      .eq("user_id", userId)
      .in("platform", Array.from(new Set(selectedPlatforms)))
      .eq("status", "connected")
      .eq("is_publish_enabled", true);
    if (error || !data) return new Set();
    return new Set((data as { platform: string }[]).map((r) => r.platform));
  } catch (err) {
    if (!isMissingDatabaseObjectError(err)) console.error("publishEnabledPlatforms failed", err);
    return new Set();
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `media_id` (FK to generated_media) must be a UUID — but `media_ids` can
// be ANY string (UUID OR an `asset:*` token pulled from the curated asset
// library). The non-UUID tokens get stored only in `metadata.media_ids`
// (jsonb) and are resolved client-side from the manifest.
const schema = z.object({
  // When `post_id` is set, the route UPDATEs the existing row instead of
  // inserting a new draft. RLS guarantees the caller owns the row (the
  // user-scoped client gates by user_id).
  post_id: z.string().uuid().nullish(),
  title: z.string().max(160).nullish(),
  body: z.string().min(1).max(8000),
  channels: z.array(z.enum(channels)).min(1).max(channels.length),
  media_id: z.string().uuid().nullish(),
  media_ids: z.array(z.string().min(1)).nullish(),
  scheduled_at: z.string().datetime().nullish(),
  action: z.enum(["draft", "schedule"]).default("draft"),
  // YouTube needs its own title field separate from the internal `title`.
  // We stash it in `metadata.youtube_title` rather than carving out a new
  // column. Front-end only sends it when YouTube is in `channels`.
  youtube_title: z.string().max(100).nullish(),
});

function metadataStringValue(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const supabase = getSupabaseServerClient();

  // Pick the first UUID-shaped media as the primary; persist EVERY id in
  // metadata.media_ids so the composer can re-render the full list later
  // (including non-UUID asset-library tokens like "asset:logos/x.png").
  const allIds = (data.media_ids ?? []).filter(Boolean);
  const firstUuid = allIds.find((v) => UUID_RE.test(v));
  const primaryMediaId = data.media_id ?? firstUuid ?? null;

  // Build metadata: media_ids (when present) + youtube_title (when YouTube is
  // selected). Keeping youtube_title out of the top-level columns means we can
  // ship it without a migration.
  const metadata: Record<string, unknown> = {};
  if (allIds.length > 0) metadata.media_ids = allIds;
  if (data.youtube_title && data.channels.includes("youtube")) {
    metadata.youtube_title = data.youtube_title.trim();
  }

  if (data.action === "schedule") {
    const channelsNeedingDestinations = data.channels as SocialChannel[];
    const { data: destinationRows, error: destinationError } = await supabase
      .from("social_account_connections")
      .select("platform,status,is_publish_enabled")
      .eq("user_id", profile.id)
      .in("platform", channelsNeedingDestinations);

    if (destinationError) {
      const missingTable =
        destinationError.code === "42P01" ||
        destinationError.message.toLowerCase().includes("does not exist");
      if (missingTable) {
        return NextResponse.json(
          {
            ok: false,
            error: "destination_setup_needed",
            message:
              "Connection Center storage is not provisioned yet. Apply the migration, then select a destination before scheduling.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          ok: false,
          error: "internal_error",
          message: destinationError.message,
        },
        { status: 500 }
      );
    }

    const rows = (destinationRows ?? []) as Array<{
      platform: SocialChannel;
      status: string | null;
      is_publish_enabled: boolean;
    }>;
    const selectedByChannel = new Map<
      SocialChannel,
      { selected: boolean; publish_enabled: boolean }
    >([
      ["facebook", { selected: false, publish_enabled: false }],
      ["instagram", { selected: false, publish_enabled: false }],
      ["google_business_profile", { selected: false, publish_enabled: false }],
      ["youtube", { selected: false, publish_enabled: false }],
    ]);

    for (const row of rows) {
      const current = selectedByChannel.get(row.platform);
      if (!current) continue;
      current.selected = true;
      if (row.status === "connected" && row.is_publish_enabled) {
        current.publish_enabled = true;
      }
    }

    const missingChannels = channelsNeedingDestinations.filter(
      (channel) => !selectedByChannel.get(channel)?.selected
    );
    const disabledChannels = channelsNeedingDestinations.filter(
      (channel) =>
        selectedByChannel.get(channel)?.selected &&
        !selectedByChannel.get(channel)?.publish_enabled
    );

    if (missingChannels.length > 0 || disabledChannels.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: missingChannels.length > 0 ? "destination_required" : "publish_disabled",
          message:
            missingChannels.length > 0
              ? "Select a destination in Connection Center before scheduling."
              : "Enable publishing for the selected destination before scheduling.",
          missing_channels: missingChannels,
          disabled_channels: disabledChannels,
        },
        { status: 409 }
      );
    }
  }

  // Persist the post. UPDATE when post_id is provided AND the caller owns
  // the row (RLS enforces ownership). Otherwise INSERT a brand-new draft.
  let post:
    | (Record<string, unknown> & { id: string })
    | null = null;
  let dbError: { message: string } | null = null;

  if (data.post_id) {
    const { data: updated, error: updErr } = await supabase
      .from("social_posts")
      .update({
        title: data.title ?? null,
        body: data.body,
        channels: data.channels as SocialChannel[],
        media_id: primaryMediaId,
        scheduled_at: data.scheduled_at ?? null,
        status: data.action === "schedule" ? "scheduled" : "draft",
        metadata,
      })
      .eq("id", data.post_id)
      .select("*")
      .maybeSingle();
    if (updErr) {
      dbError = updErr;
    } else if (!updated) {
      // RLS hid the row OR the id was wrong. Treat as not-found so the
      // caller knows the update didn't land.
      return NextResponse.json(
        {
          ok: false,
          error: "not_found",
          message: "Post not found, or you don't have access to it.",
        },
        { status: 404 }
      );
    } else {
      post = updated as Record<string, unknown> & { id: string };
    }
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("social_posts")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        title: data.title ?? null,
        body: data.body,
        channels: data.channels as SocialChannel[],
        media_id: primaryMediaId,
        scheduled_at: data.scheduled_at ?? null,
        status: data.action === "schedule" ? "scheduled" : "draft",
        metadata,
      })
      .select("*")
      .single();
    if (insErr) dbError = insErr;
    else post = inserted as Record<string, unknown> & { id: string };
  }

  if (dbError || !post) {
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message:
          dbError?.message ?? (data.post_id ? "update failed" : "insert failed"),
      },
      { status: 500 }
    );
  }

  await logUsage(profile, {
    module: "social",
    event_type: data.action === "schedule" ? "post_scheduled" : "post_drafted",
    metadata: { post_id: post.id, channels: data.channels, edited: !!data.post_id },
  });

  // If scheduling, enqueue an automation job. A live dispatch requires BOTH
  // the signed-in user's in-app live-social toggle (integration_settings,
  // resolved per user) AND, for every selected channel, the user's publish
  // switch on that platform's connection (social_account_connections.is_publish_enabled).
  // If either is off, the post stays queued/draft — it is NEVER published.
  let job: { job_id: string; status: string; reason?: string } | null = null;
  let publishGate: { live: boolean; reason: string } | null = null;
  let directResults: Array<{
    channel: string;
    platform: string;
    status: "published" | "failed" | "skipped";
    error?: string;
    platform_post_id?: string;
  }> = [];
  if (data.action === "schedule") {
    const liveSetting = await resolveLiveAction("social", {
      organizationId: profile.organization_id,
      userId: profile.id,
    });
    const enabledPlatforms = await publishEnabledPlatforms(
      profile.id,
      data.channels.map((channel) => CHANNEL_PLATFORM[channel])
    );
    const blockedChannels = data.channels.filter(
      (c) => !enabledPlatforms.has(CHANNEL_PLATFORM[c])
    );
    const accountsAllEnabled = blockedChannels.length === 0;
    const dispatchLive = liveSetting.allowed && accountsAllEnabled;

    publishGate = {
      live: dispatchLive,
      reason: dispatchLive
        ? "ok"
        : !liveSetting.allowed
        ? `live_social_${liveSetting.reason}`
        : `account_publish_disabled:${blockedChannels.join(",")}`,
    };

    // ------------------------------------------------------------------
    // Direct real-time publish — attempt before n8n enqueue.
    // For each selected channel, if live gates pass AND the real publisher
    // is available (token connected), call it directly. Channels that
    // succeed are recorded as 'published'; failures fall through to n8n
    // with status 'queued'. Channels with disabled gates fall through to
    // n8n with status 'disabled'. This does NOT block the response on
    // channel failures — the post is always saved; publish is best-effort.
    // ------------------------------------------------------------------

    if (dispatchLive) {
      const imageUrl = metadataStringValue(post.metadata, "image_url");
      const videoUrl = metadataStringValue(post.metadata, "video_url");

      // Meta (Facebook + Instagram share one token/connection)
      const metaChannels = (
        data.channels as string[]
      ).filter((c) => c === "facebook" || c === "instagram");
      if (metaChannels.length > 0) {
        for (const ch of metaChannels) {
          const surface = ch as "facebook" | "instagram";
          const platform = CHANNEL_PLATFORM[surface];
          if (surface === "instagram" && !imageUrl && !videoUrl) {
            directResults.push({
              channel: ch,
              platform,
              status: "skipped",
              error: "instagram_media_required",
            });
            continue;
          }
          try {
            const metaPost: MetaPublishPost = {
              surface,
              message: data.body,
              image_url: imageUrl,
              video_url: videoUrl,
              connection_id: post.id,
            };
            const metaCtx = { is_publish_enabled: true, actor: profile };
            const result = await publishToMeta(metaPost, metaCtx);
            directResults.push({
              channel: ch,
              platform,
              status: "published",
              platform_post_id: result.platform_post_id,
            });
            await recordPublishAttempt({
              organization_id: profile.organization_id,
              social_post_id: post.id,
              platform,
              route: "meta_graph",
              status: "published",
              metadata: { channel: ch, platform_post_id: result.platform_post_id },
            });
          } catch (err) {
            const errMsg =
              err instanceof MetaPublishGateError
                ? err.reason
                : err instanceof Error
                ? err.message
                : "meta_publish_failed";
            directResults.push({
              channel: ch,
              platform,
              status: "failed",
              error: errMsg,
            });
            await recordPublishAttempt({
              organization_id: profile.organization_id,
              social_post_id: post.id,
              platform,
              route: "meta_graph",
              status: "failed",
              error: errMsg,
              metadata: { channel: ch },
            });
          }
        }
      }

      // YouTube
      if ((data.channels as string[]).includes("youtube")) {
        const ytConnected = await isYoutubeConnected(profile.id);
        const youtubeVideoUrl =
          metadataStringValue(post.metadata, "youtube_video_url") ?? videoUrl;
        const youtubeContent = metadataStringValue(
          post.metadata,
          "youtube_content_base64"
        );
        const youtubeMimeType = metadataStringValue(post.metadata, "youtube_mime_type");
        if (ytConnected && (youtubeVideoUrl || youtubeContent)) {
          const ytTitle =
            (data.youtube_title ?? data.title ?? data.body.slice(0, 100)).trim();
          const ytResult = await uploadYoutubeVideo(profile.id, {
            title: ytTitle,
            description: data.body,
            videoUrl: youtubeVideoUrl,
            content_base64: youtubeContent,
            mimeType: youtubeMimeType,
            social_post_id: post.id,
          });
          directResults.push({
            channel: "youtube",
            platform: "youtube",
            status: ytResult.ok ? "published" : "failed",
            error: ytResult.ok ? undefined : ytResult.message,
            platform_post_id: ytResult.videoId,
          });
          await recordPublishAttempt({
            organization_id: profile.organization_id,
            social_post_id: post.id,
            platform: "youtube",
            route: "youtube",
            status: ytResult.ok ? "published" : "failed",
            error: ytResult.ok ? null : ytResult.message,
            metadata: { video_id: ytResult.videoId ?? null },
          });
        } else {
          directResults.push({
            channel: "youtube",
            platform: "youtube",
            status: "skipped",
            error: ytConnected ? "video_media_required" : "not_connected",
          });
        }
      }

      // Google Business Profile
      if ((data.channels as string[]).includes("google_business_profile")) {
        const gbpConnected = await isGbpConnected(profile.id);
        if (gbpConnected) {
          const gbpResult = await createGbpPost(profile.id, {
            summary: data.body,
            social_post_id: post.id,
          });
          directResults.push({
            channel: "google_business_profile",
            platform: "google_business_profile",
            status: gbpResult.ok ? "published" : "failed",
            error: gbpResult.ok ? undefined : gbpResult.message,
            platform_post_id: gbpResult.postName,
          });
          await recordPublishAttempt({
            organization_id: profile.organization_id,
            social_post_id: post.id,
            platform: "google_business_profile",
            route: "gbp",
            status: gbpResult.ok ? "published" : "failed",
            error: gbpResult.ok ? null : gbpResult.message,
            metadata: { post_name: gbpResult.postName ?? null },
          });
        } else {
          directResults.push({
            channel: "google_business_profile",
            platform: "google_business_profile",
            status: "skipped",
            error: "not_connected",
          });
        }
      }
    }

    // Determine which channels still need n8n (not published directly)
    const directlyPublished = new Set(
      directResults
        .filter((r) => r.status === "published")
        .map((r) => r.channel)
    );
    const channelsForN8n = data.channels.filter(
      (c) => !directlyPublished.has(c)
    );

    // Only enqueue n8n job if there are channels left to process
    if (channelsForN8n.length === 0) {
      // All channels published directly — create a no-op job record for
      // consistency with the existing response shape.
      job = {
        job_id: `direct-${post.id}`,
        status: "dispatched",
        reason: "all_channels_published_directly",
      };
    } else {
      job = await enqueueAutomationJob({
        profile,
        job_type: "social_publish",
        module: "social",
        target_table: "social_posts",
        target_id: post.id,
        webhook_key: "social_publish",
        payload: {
          post_id: post.id,
          body: data.body,
          channels: channelsForN8n,
          scheduled_at: data.scheduled_at,
          youtube_title:
            data.youtube_title && channelsForN8n.includes("youtube")
              ? data.youtube_title.trim()
              : null,
        },
        scheduled_at: data.scheduled_at,
        dispatch: dispatchLive,
      });

      // Record n8n attempt rows for remaining channels
      const attemptStatus = !dispatchLive
        ? ("disabled" as const)
        : job.status === "dispatched"
        ? ("dispatched" as const)
        : ("queued" as const);
      await Promise.all(
        channelsForN8n
          .filter((c) => {
            // Skip channels already recorded via directResults
            const already = directResults.find((r) => r.channel === c);
            return !already;
          })
          .map((channel) =>
            recordPublishAttempt({
              organization_id: profile.organization_id,
              social_post_id: post!.id,
              platform: CHANNEL_PLATFORM[channel],
              route: "n8n",
              status: attemptStatus,
              error: dispatchLive ? null : publishGate!.reason,
              metadata: { channel, job_id: job!.job_id },
            })
          )
      );
    }

    await recordAudit({
      actor: profile,
      action: "social_publish_requested",
      target_type: "social_posts",
      target_id: post.id,
      metadata: {
        channels: data.channels,
        dispatch: dispatchLive,
        gate_reason: publishGate.reason,
        job_id: job.job_id,
        direct_published: directResults
          .filter((r) => r.status === "published")
          .map((r) => r.channel),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    post,
    job,
    publish: publishGate,
    // Per-channel direct publish results (only present when action='schedule')
    direct_results: directResults.length > 0 ? directResults : undefined,
  });
}
