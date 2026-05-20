// GET /api/atlas/tools — returns the combined Atlas tool manifest.
//
// Shape:
//   {
//     ok: true,
//     manifest: {
//       tools:      [...native registry tools, ready-flag + roles + audit],
//       connectors: [...L1 owner-global + L2 LO personal],
//       safety:     { allow_live_*, allow_paid_* booleans }
//     }
//   }
//
// HARD RULES:
//   * Never emit env var VALUES — only NAMES.
//   * Never emit `auth_token` for mcp_connections rows. The registry layer
//     drops it server-side; we only re-surface a `hasToken: boolean`.
//   * RLS-scoped (the L2 read goes through the user's server client; L1 is
//     env-only so it's safe for anonymous callers).
//   * application/json response on every code path (auth-fail included) so
//     the AtlasShell defensive parser never hits "Unexpected token '<'".

import { NextResponse } from "next/server";

import { buildToolManifest } from "@/lib/mcp/manifest";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  try {
    const manifest = await buildToolManifest(profile.id);
    return NextResponse.json({ ok: true, manifest });
  } catch (e) {
    // Never leak the exception text — could include row payloads.
    console.error("/api/atlas/tools failed", e);
    return NextResponse.json(
      {
        ok: false,
        error: "manifest_build_failed",
        message: "Could not build the Atlas tool manifest. Please retry.",
      },
      { status: 500 }
    );
  }
}
