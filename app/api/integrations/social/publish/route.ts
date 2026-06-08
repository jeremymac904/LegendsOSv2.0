/**
 * POST /api/integrations/social/publish
 *
 * Authenticated direct publish route. Loads the signed-in user's own
 * social_posts row, verifies ALL gates, calls the appropriate real publisher,
 * and returns an honest result.
 *
 * Required body:
 *   {
 *     platform: 'facebook' | 'instagram' | 'youtube' | 'google_business_profile',
 *     post_id: string (UUID),
 *     confirm: true          ← explicit safeguard; request is blocked without it
 *   }
 *
 * Gates (ALL must pass — fail-closed):
 *   1. caller owns the social_posts row
 *   2. resolveLiveAction('social').allowed
 *   3. caller has a selected, connected, publish-enabled destination for platform
 *   4. publisher token is connected (for Google-OAuth platforms)
 *   5. body.confirm === true
 *
 * Any gate failure → { ok: false, status: 'blocked', reason: string }
 * Every attempt (including blocked ones) is audited.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordIntegrationAudit, recordPublishAttempt } from "@/lib/integrations/audit";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_PLATFORMS = [
  "facebook",
  "instagram",
  "youtube",
  "google_business_profile",
] as const;

type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

const bodySchema = z.object({
  platform: z.enum(SUPPORTED_PLATFORMS),
  post_id: z.string().uuid(),
  confirm: z.literal(true),
});

function metadataStringValue(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Load the signed-in user's selected publish-enabled destination for a platform.
// Returns false on missing table, missing row, revoked row, or disabled row.
async function loadPublishEnabled(
  userId: string,
  platform: SupportedPlatform
): Promise<boolean> {
  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("social_account_connections")
      .select("is_publish_enabled")
      .eq("user_id", userId)
      .eq("platform", platform)
      .eq("status", "connected")
      .eq("is_publish_enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;
    return Boolean((data as { is_publish_enabled: boolean }).is_publish_enabled);
  } catch (err) {
    if (!isMissingDatabaseObjectError(err)) {
      console.error("loadPublishEnabled failed", err);
    }
    return false;
  }
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, status: "blocked", reason: "unauthenticated" },
      { status: 401 }
    );
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        status: "blocked",
        reason: "bad_request",
        detail: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }
  const { platform, post_id, confirm } = parsed.data;

  // Gate 5: explicit confirm (already validated by zod literal true, but
  // double-check defensively — must be exactly true)
  if (confirm !== true) {
    return NextResponse.json(
      { ok: false, status: "blocked", reason: "confirm_required" },
      { status: 400 }
    );
  }

  const platformKey = platform;

  // Gate 1: the caller must own the post. Use an explicit user_id filter so
  // owner/admin visibility cannot become publish authority for another user.
  const supabase = getSupabaseServerClient();
  const { data: postRow, error: postErr } = await supabase
    .from("social_posts")
    .select("id,user_id,body,title,channels,metadata,media_id,status")
    .eq("id", post_id)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (postErr || !postRow) {
    await recordIntegrationAudit({
      actor: profile,
      action: "social_publish_blocked",
      provider: platformKey,
      target_type: "social_posts",
      target_id: post_id,
      metadata: { reason: "post_not_found_or_not_owned", platform },
    });
    return NextResponse.json(
      {
        ok: false,
        status: "blocked",
        reason: "post_not_found",
        detail: postErr?.message ?? "No row returned for the signed-in user.",
      },
      { status: 404 }
    );
  }

  const post = postRow as {
    id: string;
    user_id: string;
    body: string;
    title: string | null;
    channels: string[];
    metadata: Record<string, unknown> | null;
    media_id: string | null;
    status: string;
  };

  if (!post.channels.includes(platform)) {
    await recordIntegrationAudit({
      actor: profile,
      action: "social_publish_blocked",
      provider: platformKey,
      target_type: "social_posts",
      target_id: post.id,
      metadata: { reason: "platform_not_in_post_channels", platform },
    });
    return NextResponse.json(
      {
        ok: false,
        status: "blocked",
        reason: "platform_not_in_post_channels",
      },
      { status: 409 }
    );
  }

  // Gate 2: live social toggle (integration_settings)
  const liveResolution = await resolveLiveAction("social", {
    organizationId: profile.organization_id,
    userId: profile.id,
  });
  if (!liveResolution.allowed) {
    await recordIntegrationAudit({
      actor: profile,
      action: "social_publish_blocked",
      provider: platformKey,
      target_type: "social_posts",
      target_id: post_id,
      metadata: { reason: `live_social_${liveResolution.reason}`, platform },
    });
    return NextResponse.json(
      {
        ok: false,
        status: "blocked",
        reason: `live_social_${liveResolution.reason}`,
      },
      { status: 403 }
    );
  }

  // Gate 3: is_publish_enabled on the connection
  const publishEnabled = await loadPublishEnabled(profile.id, platform);
  if (!publishEnabled) {
    await recordIntegrationAudit({
      actor: profile,
      action: "social_publish_blocked",
      provider: platformKey,
      target_type: "social_posts",
      target_id: post_id,
      metadata: { reason: "publish_not_enabled", platform },
    });
    return NextResponse.json(
      {
        ok: false,
        status: "blocked",
        reason: "publish_not_enabled",
        detail: `No connected, publish-enabled ${platformKey} destination is selected for the signed-in user.`,
      },
      { status: 403 }
    );
  }

  // Run the publisher
  let publishResult: { ok: boolean; platform_post_id?: string; message?: string };

  try {
    if (platform === "facebook" || platform === "instagram") {
      // Gate 4 for Meta: detectMetaConfig is inside publishToMeta — it will
      // throw MetaPublishGateError('not_configured') when env is absent.
      const imageUrl = metadataStringValue(post.metadata, "image_url");
      const videoUrl = metadataStringValue(post.metadata, "video_url");
      if (platform === "instagram" && !imageUrl && !videoUrl) {
        await recordIntegrationAudit({
          actor: profile,
          action: "social_publish_blocked",
          provider: platformKey,
          target_type: "social_posts",
          target_id: post.id,
          metadata: { reason: "instagram_media_required", platform },
        });
        return NextResponse.json(
          { ok: false, status: "blocked", reason: "instagram_media_required" },
          { status: 422 }
        );
      }
      const metaPost: MetaPublishPost = {
        surface: platform,
        message: post.body,
        image_url: imageUrl,
        video_url: videoUrl,
        connection_id: post.id,
      };
      const metaResult = await publishToMeta(metaPost, {
        is_publish_enabled: true, // already verified above
        actor: profile,
      });
      publishResult = {
        ok: true,
        platform_post_id: metaResult.platform_post_id,
      };

    } else if (platform === "youtube") {
      // Gate 4: token connection
      const ytConnected = await isYoutubeConnected(profile.id);
      if (!ytConnected) {
        await recordIntegrationAudit({
          actor: profile,
          action: "social_publish_blocked",
          provider: "youtube",
          target_type: "social_posts",
          target_id: post.id,
          metadata: { reason: "not_connected", platform },
        });
        return NextResponse.json(
          { ok: false, status: "blocked", reason: "not_connected" },
          { status: 422 }
        );
      }
      const ytTitle =
        (
          (post.metadata?.youtube_title as string | undefined) ??
          post.title ??
          post.body.slice(0, 100)
        ).trim();
      const youtubeVideoUrl =
        metadataStringValue(post.metadata, "youtube_video_url") ??
        metadataStringValue(post.metadata, "video_url");
      const youtubeContent = metadataStringValue(
        post.metadata,
        "youtube_content_base64"
      );
      const youtubeMimeType = metadataStringValue(post.metadata, "youtube_mime_type");
      if (!youtubeVideoUrl && !youtubeContent) {
        await recordIntegrationAudit({
          actor: profile,
          action: "social_publish_blocked",
          provider: "youtube",
          target_type: "social_posts",
          target_id: post.id,
          metadata: { reason: "video_media_required", platform },
        });
        return NextResponse.json(
          { ok: false, status: "blocked", reason: "video_media_required" },
          { status: 422 }
        );
      }
      const ytResult = await uploadYoutubeVideo(profile.id, {
        title: ytTitle,
        description: post.body,
        videoUrl: youtubeVideoUrl,
        content_base64: youtubeContent,
        mimeType: youtubeMimeType,
        social_post_id: post.id,
      });
      publishResult = {
        ok: ytResult.ok,
        platform_post_id: ytResult.videoId,
        message: ytResult.message,
      };

    } else {
      // google_business_profile
      // Gate 4: token connection
      const gbpConn = await isGbpConnected(profile.id);
      if (!gbpConn) {
        await recordIntegrationAudit({
          actor: profile,
          action: "social_publish_blocked",
          provider: "google_business_profile",
          target_type: "social_posts",
          target_id: post.id,
          metadata: { reason: "not_connected", platform },
        });
        return NextResponse.json(
          { ok: false, status: "blocked", reason: "not_connected" },
          { status: 422 }
        );
      }
      const gbpResult = await createGbpPost(profile.id, {
        summary: post.body,
        social_post_id: post.id,
      });
      publishResult = {
        ok: gbpResult.ok,
        platform_post_id: gbpResult.postName,
        message: gbpResult.message,
      };
    }

  } catch (err) {
    const reason =
      err instanceof MetaPublishGateError
        ? err.reason
        : err instanceof Error
        ? err.message
        : "publish_error";

    await recordPublishAttempt({
      organization_id: profile.organization_id,
      social_post_id: post.id,
      platform: platformKey,
      route: platform === "facebook" || platform === "instagram"
        ? "meta_graph"
        : platform === "youtube"
        ? "youtube"
        : "gbp",
      status: "failed",
      error: reason,
      metadata: { platform, initiated_by: "user_direct_publish" },
    });

    return NextResponse.json(
      { ok: false, status: "failed", reason },
      { status: 500 }
    );
  }

  // Record the publish attempt
  const routeLabel =
    platform === "facebook" || platform === "instagram"
      ? "meta_graph"
      : platform === "youtube"
      ? "youtube"
      : "gbp";

  await recordPublishAttempt({
    organization_id: profile.organization_id,
    social_post_id: post.id,
    platform: platformKey,
    route: routeLabel,
    status: publishResult.ok ? "published" : "failed",
    error: publishResult.ok ? null : (publishResult.message ?? null),
    metadata: {
      platform,
      platform_post_id: publishResult.platform_post_id ?? null,
      initiated_by: "user_direct_publish",
    },
  });

  if (!publishResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: "failed",
        reason: publishResult.message ?? "publish_failed",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: "published",
    platform,
    platform_post_id: publishResult.platform_post_id ?? null,
  });
}
