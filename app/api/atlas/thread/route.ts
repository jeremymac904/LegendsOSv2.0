import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  thread_id: z.string().uuid(),
  is_pinned: z.boolean().optional(),
  is_saved: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  title: z.string().min(1).max(120).optional(),
});

export async function PATCH(req: Request) {
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

  const { thread_id, ...patch } = parsed.data;
  const update: Record<string, unknown> = {};
  if (typeof patch.is_pinned === "boolean") update.is_pinned = patch.is_pinned;
  if (typeof patch.is_saved === "boolean") update.is_saved = patch.is_saved;
  if (typeof patch.is_archived === "boolean") update.is_archived = patch.is_archived;
  if (patch.title) update.title = patch.title.trim();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "empty_patch", message: "No thread fields supplied." });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("chat_threads")
    .update(update)
    .eq("id", thread_id)
    .eq("user_id", profile.id);

  if (error) {
    return NextResponse.json({
      ok: false,
      error: "thread_update_failed",
      message: error.message,
    });
  }

  return NextResponse.json({ ok: true });
}
