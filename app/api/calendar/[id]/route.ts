import { NextResponse } from "next/server";

import {
  getCurrentProfile,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/calendar/:id — removes a calendar_items row.
//
// Auth: the standard Supabase server client honors the user's session, which
// means RLS scopes the delete to rows the caller owns (calendar_items has a
// `user_id = auth.uid()` policy). The owner can always delete their own; we
// don't expose a service-role delete here to keep blast radius small.
//
// This route powers the hover-to-delete chip on `CalendarMonthGrid`.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  const id = params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Invalid id." },
      { status: 400 }
    );
  }
  const supabase = getSupabaseServerClient();
  const { error, count } = await supabase
    .from("calendar_items")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: "delete_failed", message: error.message },
      { status: 500 }
    );
  }
  if (count === 0) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Nothing to delete." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
