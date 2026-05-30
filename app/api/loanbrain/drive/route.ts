/**
 * GET /api/loanbrain/drive — READ-ONLY Google Drive Loan Brain surface.
 *
 * Views (query param `view`):
 *   status              -> Drive connection status + setup checklist
 *   roots               -> pipeline root sections
 *   folder&id=<id>      -> a folder's subfolders + files
 *   search&q=<query>    -> matching borrower folders
 *   summary&id=<id>     -> a borrower folder summary
 *
 * SAFETY: This route never writes to Google Drive. There is no POST/PUT/PATCH/
 * DELETE handler here. It returns safe SAMPLE data until a read-only Drive
 * connection is live. No secrets are returned.
 */

import { NextRequest, NextResponse } from "next/server";

import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import {
  getSampleSummary,
  listFolder,
  listRoots,
  searchBorrowerFolders,
} from "@/lib/loanbrain/store";
import { getCurrentProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "status";

  switch (view) {
    case "status":
      return NextResponse.json({ ok: true, status: getDriveConnectionStatus() });

    case "roots": {
      const { source, roots } = listRoots();
      return NextResponse.json({ ok: true, source, roots });
    }

    case "folder": {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
      }
      const listing = listFolder(id);
      return NextResponse.json({ ok: true, ...listing });
    }

    case "search": {
      const q = searchParams.get("q") ?? "";
      const folders = searchBorrowerFolders(q);
      return NextResponse.json({ ok: true, source: "sample", folders });
    }

    case "summary": {
      const id = searchParams.get("id");
      if (!id) {
        return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
      }
      const summary = getSampleSummary(id);
      if (!summary) {
        return NextResponse.json(
          { ok: false, error: "summary_unavailable", message: "No summary for this folder yet." },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, source: "sample", summary });
    }

    default:
      return NextResponse.json({ ok: false, error: "unknown_view" }, { status: 400 });
  }
}
