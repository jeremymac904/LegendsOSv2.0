import { NextResponse } from "next/server";

import { allowedUserAutomations } from "@/lib/automation/n8n-control";
import { buildAutomationRegistry } from "@/lib/automation/registry";
import { isAdminOrOwner } from "@/lib/permissions";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Authenticated status endpoint. Owner/admin gets the full registry; team
// members get only allowed automation entry points. No secret values, URLs, or
// activation calls are returned.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isAdminOrOwner(profile)) {
    return NextResponse.json({
      ok: true,
      scope: "user",
      automations: allowedUserAutomations(),
    });
  }

  return NextResponse.json({
    ok: true,
    scope: "admin",
    registry: buildAutomationRegistry(),
  });
}
