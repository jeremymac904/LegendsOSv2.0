import { NextResponse } from "next/server";
import { z } from "zod";

import { runImage } from "@/lib/ai/providers";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { checkDailyCap, logUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  prompt: z.string().min(3).max(2000),
  aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
  model: z.string().optional(),
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
  const { prompt, aspect_ratio, model } = parsed.data;

  // Respect the owner's per-org Fal toggle in Settings.
  {
    const sb = getSupabaseServerClient();
    const { data: row } = await sb
      .from("provider_credentials_public")
      .select("provider,is_enabled")
      .eq("provider", "fal")
      .maybeSingle();
    if (row && row.is_enabled === false) {
      return NextResponse.json(
        {
          ok: false,
          error: "provider_disabled",
          message: "Fal.ai is disabled by the owner. Re-enable it in Settings → AI Provider Gateway.",
          provider: "fal",
        },
        { status: 200 }
      );
    }
  }

  const cap = await checkDailyCap(profile, "images", "images");
  if (!cap.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "cap_exceeded",
        message: `Daily image cap reached (${cap.used}/${cap.cap}).`,
      },
      { status: 429 }
    );
  }

  const supabase = getSupabaseServerClient();

  // Create a queued media row up front so the UI has something to link to.
  const { data: queued, error: insErr } = await supabase
    .from("generated_media")
    .insert({
      user_id: profile.id,
      organization_id: profile.organization_id,
      prompt,
      provider: "fal",
      model: model ?? null,
      aspect_ratio: aspect_ratio ?? "1:1",
      status: "queued",
    })
    .select("*")
    .single();

  if (insErr || !queued) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: insErr?.message ?? "insert failed" },
      { status: 500 }
    );
  }

  const result = await runImage({ prompt, aspect_ratio, model });

  await logUsage(profile, {
    module: "images",
    event_type: result.ok ? "image_generated" : "image_blocked",
    provider: "fal",
    metadata: {
      media_id: queued.id,
      ok: result.ok,
      error: result.ok ? null : result.error,
    },
  });

  if (!result.ok) {
    await supabase
      .from("generated_media")
      .update({
        status: "failed",
        metadata: { error: result.error, message: result.message },
      })
      .eq("id", queued.id);
    return NextResponse.json(result);
  }

  await supabase
    .from("generated_media")
    .update({
      status: "succeeded",
      preview_url: result.image_url,
      model: result.model,
      cost_estimate: result.cost_estimate ?? null,
      revised_prompt: result.revised_prompt ?? null,
    })
    .eq("id", queued.id);

  return NextResponse.json({
    ok: true,
    media_id: queued.id,
    preview_url: result.image_url,
    provider: "fal",
    model: result.model,
    usage: { daily_count: cap.used + 1, daily_limit: cap.cap },
  });
}
