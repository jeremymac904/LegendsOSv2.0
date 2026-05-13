import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { enqueueAutomationJob } from "@/lib/automation/n8n";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { logUsage, recordAudit } from "@/lib/usage";
import type { SocialChannel } from "@/types/database";

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
  title: z.string().max(160).nullish(),
  body: z.string().min(1).max(8000),
  channels: z.array(z.enum(channels)).min(1).max(channels.length),
  media_id: z.string().uuid().nullish(),
  media_ids: z.array(z.string().min(1)).nullish(),
  scheduled_at: z.string().datetime().nullish(),
  action: z.enum(["draft", "schedule"]).default("draft"),
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
  const env = getServerEnv();

  // Pick the first UUID-shaped media as the primary; persist EVERY id in
  // metadata.media_ids so the composer can re-render the full list later
  // (including non-UUID asset-library tokens like "asset:logos/x.png").
  const allIds = (data.media_ids ?? []).filter(Boolean);
  const firstUuid = allIds.find((v) => UUID_RE.test(v));
  const primaryMediaId = data.media_id ?? firstUuid ?? null;

  // Persist the post.
  const { data: post, error: insErr } = await supabase
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
      metadata: allIds.length > 0 ? { media_ids: allIds } : {},
    })
    .select("*")
    .single();

  if (insErr || !post) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: insErr?.message ?? "insert failed" },
      { status: 500 }
    );
  }

  await logUsage(profile, {
    module: "social",
    event_type: data.action === "schedule" ? "post_scheduled" : "post_drafted",
    metadata: { post_id: post.id, channels: data.channels },
  });

  // If scheduling, enqueue an automation job. NEVER dispatch live unless the
  // owner has flipped ALLOW_LIVE_SOCIAL_PUBLISH=true AND a webhook is set.
  let job: { job_id: string; status: string; reason?: string } | null = null;
  if (data.action === "schedule") {
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
      },
      scheduled_at: data.scheduled_at,
      dispatch: env.SAFETY.allowLiveSocialPublish,
    });
    await recordAudit({
      actor: profile,
      action: "social_publish_requested",
      target_type: "social_posts",
      target_id: post.id,
      metadata: {
        channels: data.channels,
        dispatch: env.SAFETY.allowLiveSocialPublish,
        job_id: job.job_id,
      },
    });
  }

  return NextResponse.json({ ok: true, post, job });
}
