import { NextResponse } from "next/server";

import { buildChiefOfStaffBriefing } from "@/lib/chiefOfStaff/recommendations";
import { getEffectiveProfile } from "@/lib/impersonation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only AI Chief of Staff briefing. Returns the prioritized "what matters
// today" payload for the signed-in user. RLS scopes every underlying read, so
// each caller only ever sees their own data. This route never writes.
export async function GET() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  try {
    const briefing = await buildChiefOfStaffBriefing(profile);
    return NextResponse.json({ ok: true, briefing });
  } catch (error) {
    // The builder is already fault-tolerant per section; this is a last-resort
    // guard so the endpoint degrades gracefully rather than 500-ing.
    return NextResponse.json(
      {
        ok: false,
        error: "briefing_failed",
        message:
          error instanceof Error ? error.message : "Could not build the briefing.",
      },
      { status: 200 }
    );
  }
}
