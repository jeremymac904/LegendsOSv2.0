import { NextResponse } from "next/server";
import { z } from "zod";

import { IMPERSONATION_COOKIE } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile } from "@/lib/supabase/server";
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
