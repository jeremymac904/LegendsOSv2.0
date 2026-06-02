// Server-only YouTube Data API v3 publisher.
// ---------------------------------------------------------------------------
// Tokens are stored in oauth_token_grants (provider='youtube') and refreshed
// transparently via ensureFreshAccessToken from lib/integrations/google.ts.
// Tokens are ONLY ever placed in the Authorization header — never logged,
// echoed, or included in error messages. Server-only: never import from a
// client component.

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import { ensureFreshAccessToken } from "@/lib/integrations/google";
import { getTokenGrant } from "@/lib/integrations/tokenStore";

const YOUTUBE_UPLOAD_API =
  "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_CHANNELS_API =
  "https://www.googleapis.com/youtube/v3/channels";

const PROVIDER = "youtube";

// ---------------------------------------------------------------------------
// isYoutubeConnected — presence check only (no live probe).
// ---------------------------------------------------------------------------

/**
 * Returns true when a 'youtube' OAuth token grant exists for the user.
 * Does NOT make a live YouTube API call — use getYoutubeChannelInfo for that.
 */
export async function isYoutubeConnected(userId: string): Promise<boolean> {
  try {
    const grant = await getTokenGrant(userId, PROVIDER);
    return Boolean(grant?.access_token);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// getYoutubeChannelInfo — cheap live probe for status display.
// ---------------------------------------------------------------------------

export interface YoutubeChannelInfo {
  connected: boolean;
  channelTitle?: string;
  channelId?: string;
  reason?: string;
}

/**
 * Returns the connected channel's title and id for status display.
 * Returns { connected: false, reason } when the token is absent or invalid.
 * Never returns the access token.
 */
export async function getYoutubeChannelInfo(
  userId: string
): Promise<YoutubeChannelInfo> {
  const tokenResult = await ensureFreshAccessToken(userId, PROVIDER);
  if (!tokenResult.ok) {
    return { connected: false, reason: tokenResult.reason };
  }

  try {
    const url = new URL(YOUTUBE_CHANNELS_API);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("mine", "true");
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });
    if (!resp.ok) {
      return { connected: false, reason: `http_${resp.status}` };
    }
    const json = (await resp.json().catch(() => ({}))) as {
      items?: Array<{ id?: string; snippet?: { title?: string } }>;
    };
    const item = json.items?.[0];
    if (!item) {
      return { connected: true, reason: "no_channel_found" };
    }
    return {
      connected: true,
      channelTitle: item.snippet?.title,
      channelId: item.id,
    };
  } catch (err) {
    return {
      connected: false,
      reason: err instanceof Error ? err.message : "probe_failed",
    };
  }
}

// ---------------------------------------------------------------------------
// uploadYoutubeVideo — real multipart video upload.
// ---------------------------------------------------------------------------

export interface YoutubeUploadInput {
  title: string;
  description?: string;
  /** Public URL to the video. Mutually exclusive with content_base64. */
  videoUrl?: string;
  /** Raw base64-encoded video bytes. Use when direct upload is needed. */
  content_base64?: string;
  mimeType?: string;
  /** YouTube category ID (default: 22 = People & Blogs). */
  categoryId?: string;
  /** 'public' | 'unlisted' | 'private' (default: 'public') */
  privacyStatus?: "public" | "unlisted" | "private";
  /** For audit trail — caller-supplied social_posts.id or similar. */
  social_post_id?: string;
}

export interface YoutubeUploadResult {
  ok: boolean;
  videoId?: string;
  message: string;
}

/**
 * Upload a video to YouTube.
 *
 * If videoUrl is provided (and no content_base64), we download the video
 * then re-upload via multipart to avoid giving YouTube a signed S3/Blob URL
 * that could expire. If content_base64 is provided we use it directly.
 *
 * Returns { ok: false, message: 'not_connected' } when the user has no
 * YouTube OAuth token. Never logs the access token.
 */
export async function uploadYoutubeVideo(
  userId: string,
  input: YoutubeUploadInput
): Promise<YoutubeUploadResult> {
  const tokenResult = await ensureFreshAccessToken(userId, PROVIDER);
  if (!tokenResult.ok) {
    return {
      ok: false,
      message:
        tokenResult.reason === "not_connected"
          ? "not_connected"
          : tokenResult.reason === "needs_reauth"
          ? "needs_reauth"
          : "token_unavailable",
    };
  }

  const accessToken = tokenResult.accessToken;

  try {
    // Build the snippet + status metadata part
    const snippet = {
      title: input.title,
      description: input.description ?? "",
      categoryId: input.categoryId ?? "22",
    };
    const status = {
      privacyStatus: input.privacyStatus ?? "public",
    };
    const metadata = { snippet, status };

    let videoBuffer: Buffer;
    const mimeType = input.mimeType ?? "video/mp4";

    if (input.content_base64) {
      videoBuffer = Buffer.from(input.content_base64, "base64");
    } else if (input.videoUrl) {
      // Fetch the video bytes — avoid leaking the URL in logs
      const videoResp = await fetch(input.videoUrl);
      if (!videoResp.ok) {
        throw new Error(`video fetch failed: http ${videoResp.status}`);
      }
      const arrayBuf = await videoResp.arrayBuffer();
      videoBuffer = Buffer.from(arrayBuf);
    } else {
      throw new Error("Either videoUrl or content_base64 must be provided");
    }

    // Build a multipart body: metadata (JSON) + video bytes
    const boundary = `legends-yt-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const metadataPart = Buffer.from(
      `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        `${JSON.stringify(metadata)}\r\n`,
      "utf-8"
    );
    const videoPart = Buffer.from(
      `--${boundary}\r\n` + `Content-Type: ${mimeType}\r\n\r\n`,
      "utf-8"
    );
    const closingBoundary = Buffer.from(`\r\n--${boundary}--`, "utf-8");

    const body = Buffer.concat([
      metadataPart,
      videoPart,
      videoBuffer,
      closingBoundary,
    ]);

    const url = new URL(YOUTUBE_UPLOAD_API);
    url.searchParams.set("uploadType", "multipart");
    url.searchParams.set("part", "snippet,status");

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    });

    const json = (await resp.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string; errors?: unknown[] };
    };

    if (!resp.ok || !json.id) {
      const msg = json.error?.message ?? `http ${resp.status}`;
      throw new Error(`youtube upload failed: ${msg}`);
    }

    // Audit success
    await recordIntegrationAudit({
      actor: null,
      action: "youtube_published",
      provider: PROVIDER,
      target_type: "social_post",
      target_id: input.social_post_id ?? null,
      metadata: {
        video_id: json.id,
        title: input.title,
        privacy: input.privacyStatus ?? "public",
      },
    });

    return { ok: true, videoId: json.id, message: "published" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload_failed";

    // Audit failure — never include the token
    await recordIntegrationAudit({
      actor: null,
      action: "youtube_publish_failed",
      provider: PROVIDER,
      target_type: "social_post",
      target_id: input.social_post_id ?? null,
      metadata: { error: message },
    });

    return { ok: false, message };
  }
}
