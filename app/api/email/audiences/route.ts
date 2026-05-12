import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { logUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).nullish(),
});

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("newsletter_audiences")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, audiences: data ?? [] });
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
  const parsed = createSchema.safeParse(body);
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
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("newsletter_audiences")
    .insert({
      owner_user_id: profile.id,
      organization_id: profile.organization_id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "internal_error", message: error?.message ?? "insert failed" },
      { status: 500 }
    );
  }
  await logUsage(profile, {
    module: "email",
    event_type: "audience_created",
    metadata: { audience_id: data.id, name: data.name },
  });
  return NextResponse.json({ ok: true, audience: data });
}
