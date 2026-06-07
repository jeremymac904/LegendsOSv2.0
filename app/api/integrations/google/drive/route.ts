/**
 * POST /api/integrations/google/drive — REAL Drive actions, gated + fail-closed.
 *
 * Actions:
 *   - list_folders (READ) : connection only.
 *   - create_folder (WRITE): connection AND resolveLiveAction('drive_write')
 *                            AND explicit confirm===true.
 *   - upload (WRITE)       : same write gates.
 *   - move (WRITE)         : same write gates.
 *   - edit (WRITE)         : same write gates (rename / metadata / content).
 *
 * Provider: google_drive. Honest JSON states. Tokens obtained server-side via
 * ensureFreshAccessToken; NEVER returned or logged. Audit captures non-PII
 * detail only (names/ids; never file contents).
 *
 * Body: { action, name?, mimeType?, contentBase64?, parentId?, fileId?,
 *         addParents?, removeParents?, confirm? }
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import {
  ensureFreshAccessToken,
  driveListFolders,
  driveCreateFolder,
  driveUpload,
  driveMoveFile,
  driveUpdateFile,
} from "@/lib/integrations/google";
import { resolveLiveAction } from "@/lib/integrations/liveSettings";
import { getCurrentProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["list_folders", "upload", "create_folder", "move", "edit"]),
  name: z.string().min(1).max(512).optional(),
  mimeType: z.string().min(1).max(255).optional(),
  contentBase64: z.string().max(10_000_000).optional(),
  parentId: z.string().min(1).max(255).optional(),
  fileId: z.string().min(1).max(255).optional(),
  addParents: z.string().min(1).max(255).optional(),
  removeParents: z.string().min(1).max(255).optional(),
  confirm: z.boolean().optional(),
});

// Map an ensureFreshAccessToken failure reason to an honest connection status.
function tokenStatus(reason: "not_connected" | "needs_reauth" | "not_configured" | "error"): {
  status: "not_connected" | "needs_reauth" | "needs_setup";
  message: string;
} {
  if (reason === "not_connected") {
    return { status: "not_connected", message: "Drive is not connected — connect your Google account first." };
  }
  if (reason === "needs_reauth") {
    return { status: "needs_reauth", message: "Drive access expired or was revoked — reconnect to refresh access." };
  }
  return {
    status: "needs_setup",
    message: "Drive is not available — Google OAuth is not configured. Ask the owner to set it up.",
  };
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated", message: "Sign in first." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }
  const { action, name, mimeType, contentBase64, parentId, fileId, addParents, removeParents, confirm } = parsed.data;

  // Connection gate (all actions).
  const tok = await ensureFreshAccessToken(profile.id, "google_drive");
  if (!tok.ok) {
    const mapped = tokenStatus(tok.reason);
    return NextResponse.json({ ok: false, status: mapped.status, message: mapped.message });
  }

  // ---- READ: list_folders -> connection only -------------------------------
  if (action === "list_folders") {
    let folders;
    try {
      folders = await driveListFolders(tok.accessToken, parentId);
    } catch (err) {
      return NextResponse.json(
        { ok: false, status: "error", message: err instanceof Error ? err.message : "Drive list failed." },
        { status: 502 }
      );
    }
    await recordIntegrationAudit({
      actor: profile,
      action: "drive_list_folders",
      provider: "google_drive",
      target_type: "drive",
      target_id: parentId ?? null,
      metadata: { count: folders.length },
    });
    return NextResponse.json({ ok: true, status: "ok", action, folders });
  }

  // ---- WRITES (create_folder / upload / move): gated -----------------------
  // Gate 1: user-enabled live drive write (fail-closed).
  const live = await resolveLiveAction("drive_write", {
    organizationId: profile.organization_id,
    userId: profile.id,
  });
  if (!live.allowed) {
    await recordIntegrationAudit({
      actor: profile,
      action: "drive_write_blocked",
      provider: "google_drive",
      target_type: "drive",
      target_id: null,
      metadata: { intent: action, reason: live.reason },
    });
    return NextResponse.json({
      ok: false,
      status: "disabled_by_user",
      reason: live.reason,
      message:
        "Live Drive writes are turned off. Enable live Drive write in integration settings before changing files.",
    });
  }

  // Gate 2: explicit confirmation required.
  if (confirm !== true) {
    return NextResponse.json({
      ok: false,
      error: "confirmation_required",
      message: "Writing to Drive requires confirm: true.",
    });
  }

  if (action === "create_folder") {
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "create_folder requires name." },
        { status: 400 }
      );
    }
    let folder;
    try {
      folder = await driveCreateFolder(tok.accessToken, { name, parentId });
    } catch (err) {
      return NextResponse.json(
        { ok: false, status: "error", message: err instanceof Error ? err.message : "Drive create folder failed." },
        { status: 502 }
      );
    }
    await recordIntegrationAudit({
      actor: profile,
      action: "drive_folder_created",
      provider: "google_drive",
      target_type: "drive_folder",
      target_id: folder.id,
      metadata: { name, parent_id: parentId ?? null },
    });
    return NextResponse.json({ ok: true, status: "created", action, folder });
  }

  if (action === "upload") {
    if (!name || !mimeType || contentBase64 === undefined) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "upload requires name, mimeType, and contentBase64." },
        { status: 400 }
      );
    }
    let file;
    try {
      file = await driveUpload(tok.accessToken, { name, mimeType, contentBase64, parentId });
    } catch (err) {
      return NextResponse.json(
        { ok: false, status: "error", message: err instanceof Error ? err.message : "Drive upload failed." },
        { status: 502 }
      );
    }
    await recordIntegrationAudit({
      actor: profile,
      action: "drive_uploaded",
      provider: "google_drive",
      target_type: "drive_file",
      target_id: file.id,
      metadata: { name, mime_type: mimeType, parent_id: parentId ?? null },
    });
    return NextResponse.json({ ok: true, status: "uploaded", action, file });
  }

  if (action === "move") {
    if (!fileId || !addParents || !removeParents) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "move requires fileId, addParents, and removeParents." },
        { status: 400 }
      );
    }
    let moved;
    try {
      moved = await driveMoveFile(tok.accessToken, { fileId, addParents, removeParents });
    } catch (err) {
      return NextResponse.json(
        { ok: false, status: "error", message: err instanceof Error ? err.message : "Drive move failed." },
        { status: 502 }
      );
    }
    await recordIntegrationAudit({
      actor: profile,
      action: "drive_file_moved",
      provider: "google_drive",
      target_type: "drive_file",
      target_id: moved.id,
      metadata: { add_parents: addParents, remove_parents: removeParents },
    });
    return NextResponse.json({ ok: true, status: "moved", action, file: moved });
  }

  // action === "edit" — rename / update metadata / re-parent / replace content.
  if (!fileId) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "edit requires fileId." },
      { status: 400 }
    );
  }
  if (name === undefined && !addParents && !removeParents && contentBase64 === undefined) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: "edit requires at least one of name, addParents, removeParents, or contentBase64.",
      },
      { status: 400 }
    );
  }
  let edited;
  try {
    edited = await driveUpdateFile(tok.accessToken, {
      fileId,
      name,
      addParents,
      removeParents,
      mimeType,
      contentBase64,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, status: "error", message: err instanceof Error ? err.message : "Drive edit failed." },
      { status: 502 }
    );
  }
  await recordIntegrationAudit({
    actor: profile,
    action: "drive_file_edited",
    provider: "google_drive",
    target_type: "drive_file",
    target_id: edited.id,
    metadata: {
      renamed: name !== undefined,
      reparented: Boolean(addParents || removeParents),
      content_replaced: contentBase64 !== undefined,
    },
  });
  return NextResponse.json({ ok: true, status: "edited", action, file: edited });
}
