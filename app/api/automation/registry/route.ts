import { NextResponse } from "next/server";

import { buildAutomationRegistry } from "@/lib/automation/registry";
import { isOwner } from "@/lib/permissions";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only status endpoint. Presence/status only; no secret values, URLs, or
// activation calls are returned.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isOwner(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner-only endpoint." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, registry: buildAutomationRegistry() });
}
