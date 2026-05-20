import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { IMPERSONATION_COOKIE } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  user_id: z.string().uuid().nullable(),
});

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner only." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Bad payload." },
      { status: 400 }
    );
  }
  const { user_id } = parsed.data;

  const res = NextResponse.json({ ok: true, impersonating: !!user_id });
  if (!user_id) {
    const previousTargetId = cookies().get(IMPERSONATION_COOKIE)?.value ?? null;
    res.cookies.set({
      name: IMPERSONATION_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
    });
    await recordAudit({
      actor: profile,
      action: "impersonation_ended",
      target_type: previousTargetId ? "profiles" : null,
      target_id: previousTargetId,
    });
    return res;
  }

  if (user_id === profile.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: "You're already yourself.",
      },
      { status: 400 }
    );
  }

  const service = getSupabaseServiceClient();
  const { data: target } = await service
    .from("profiles")
    .select("id,email,full_name,role,is_active,organization_id")
    .eq("id", user_id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "User not found." },
      { status: 404 }
    );
  }
  if (target.organization_id !== profile.organization_id) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "User is outside your organization." },
      { status: 403 }
    );
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Owner accounts cannot be impersonated." },
      { status: 400 }
    );
  }
  if (!target.is_active) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Inactive users cannot be previewed." },
      { status: 400 }
    );
  }

  res.cookies.set({
    name: IMPERSONATION_COOKIE,
    value: user_id,
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  await recordAudit({
    actor: profile,
    action: "impersonation_started",
    target_type: "profiles",
    target_id: user_id,
    metadata: {
      target_email: target.email,
      target_role: target.role,
    },
  });
  return res;
}

// Clearing impersonation is a convenience GET so the banner's "Stop"
// button can navigate to it without needing JS.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: IMPERSONATION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
  return res;
}
