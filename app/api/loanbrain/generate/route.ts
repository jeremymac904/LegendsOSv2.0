/**
 * POST /api/loanbrain/generate — produce a DRAFT from a borrower folder.
 *
 * Body: { kind: GeneratorKind, folderId: string }
 *
 * SAFETY: Output is always a DRAFT. This route does not send email, publish,
 * push pipeline status, move files, or write to Google Drive. It returns the
 * draft text for human review. Viewers cannot generate. No secrets returned.
 */

import { NextRequest, NextResponse } from "next/server";

import { GENERATOR_KINDS, generateDraft } from "@/lib/loanbrain/generators";
import { getSampleSummary } from "@/lib/loanbrain/store";
import type { GeneratorKind } from "@/lib/loanbrain/types";
import { getCurrentProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  // Coarse write/generate gate — viewers cannot generate drafts.
  if (profile.role === "viewer") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    kind?: string;
    folderId?: string;
  } | null;

  if (!body?.kind || !body?.folderId) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", message: "kind and folderId are required." },
      { status: 400 }
    );
  }

  if (!GENERATOR_KINDS.includes(body.kind as GeneratorKind)) {
    return NextResponse.json({ ok: false, error: "unknown_kind" }, { status: 400 });
  }

  const summary = getSampleSummary(body.folderId);
  if (!summary) {
    return NextResponse.json(
      {
        ok: false,
        error: "summary_unavailable",
        message:
          "No summary for this folder yet. Connect read-only Drive or pick a sample borrower folder.",
      },
      { status: 404 }
    );
  }

  const draft = generateDraft(body.kind as GeneratorKind, summary);
  return NextResponse.json({ ok: true, draft });
}
