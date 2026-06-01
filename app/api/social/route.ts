import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueAutomationJob } from "@/lib/automation/n8n";
import { recordPublishAttempt } from "@/lib/integrations/audit";
import { resolveLiveAction } from "@/lib/integrations/liveSettings";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
  isMissingDatabaseObjectError,
} from "@/lib/supabase/server";
import { logUsage, recordAudit } from "@/lib/usage";
import type { SocialChannel } from "@/types/database";

// Each social channel maps to the social_account_connections.platform whose
// owner-approval switch (is_publish_enabled) must be ON for a live publish.
// Facebook + Instagram are both gated by the single "meta" connection.
const CHANNEL_PLATFORM: Record<(typeof channels)[number], string> = {
  facebook: "meta",
  instagram: "meta",
  google_business_profile: "google_business_profile",
  youtube: "youtube",
};

// Returns the set of platforms whose owner-approval switch is ON. Best-effort:
// a missing table / no rows yields an empty set (fail-closed -> stays draft).
async function publishEnabledPlatforms(organizationId: string | null): Promise<Set<string>> {
  try {
    const service = getSupabaseServiceClient();
    let q = service
      .from("social_account_connections")
      .select("platform,is_publish_enabled")
      .eq("is_publish_enabled", true);
    q = organizationId ? q.eq("organization_id", organizationId) : q.is("organization_id", null);
    const { data, error } = await q;
    if (error || !data) return new Set();
    return new Set((data as { platform: string }[]).map((r) => r.platform));
  } catch (err) {
    if (!isMissingDatabaseObjectError(err)) console.error("publishEnabledPlatforms failed", err);
    return new Set();
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const channels = [
  "facebook",
  "instagram",
  "google_business_profile",
  "youtube",
] as const;

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
  // the owner's in-app live-social toggle (integration_settings, resolved per
  // user) AND, for every selected channel, the owner-approval switch on that
  // platform's connection (social_account_connections.is_publish_enabled).
  // If either is off, the post stays queued/draft — it is NEVER published.
  let job: { job_id: string; status: string; reason?: string } | null = null;
  let publishGate: { live: boolean; reason: string } | null = null;
  if (data.action === "schedule") {
    const liveSetting = await resolveLiveAction("social", {
      organizationId: profile.organization_id,
      userId: profile.id,
    });
    const enabledPlatforms = await publishEnabledPlatforms(profile.organization_id);
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
        channels: data.channels,
        scheduled_at: data.scheduled_at,
        youtube_title:
          data.youtube_title && data.channels.includes("youtube")
            ? data.youtube_title.trim()
            : null,
      },
      scheduled_at: data.scheduled_at,
      dispatch: dispatchLive,
    });

    // Record one publish_attempts row per selected channel for the audit trail.
    const attemptStatus = !dispatchLive
      ? ("disabled" as const)
      : job.status === "dispatched"
      ? ("dispatched" as const)
      : ("queued" as const);
    await Promise.all(
      data.channels.map((channel) =>
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
      },
    });
  }

  return NextResponse.json({ ok: true, post, job, publish: publishGate });
}
