import { NextResponse } from "next/server";

import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The categories the UI presents. Images and videos surface in Social /
// Image Studio pickers; docs only surface on the Asset Library list. The
// db doesn't enforce this enum — we just store the string in payload.category
// so we can adjust without a migration.
const CATEGORIES = [
  "logo",
  "background",
  "team_photo",
  "social_image",
  "image_studio_reference",
  "document",
  "video",
] as const;
type Category = (typeof CATEGORIES)[number];

const VISIBILITIES = ["owner_only", "team_shared"] as const;
type Visibility = (typeof VISIBILITIES)[number];

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/markdown",
  "text/plain",
  "text/csv",
  "application/json",
];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB ceiling — Supabase free-tier safe

function inferKind(mime: string): "image" | "document" | "video" | null {
  if (IMAGE_TYPES.includes(mime)) return "image";
  if (DOC_TYPES.includes(mime)) return "document";
  if (VIDEO_TYPES.includes(mime)) return "video";
  // Some browsers send octet-stream for .docx / .mov / .webm. Fall back to
  // extension sniffing in the route handler when this returns null.
  return null;
}

function inferKindFromFilename(name: string): "image" | "document" | "video" | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  if (["pdf", "docx", "pptx", "md", "txt", "csv", "json"].includes(ext))
    return "document";
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  return null;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isOwner(profile) || !profile.organization_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "Owner only.",
      },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Expected multipart form." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const label = String(form.get("label") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const categoryRaw = String(form.get("category") ?? "").trim();
  const visibilityRaw = String(form.get("visibility") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "No file uploaded." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "file_too_large",
        message: `File is ${(file.size / 1_048_576).toFixed(1)} MB. Max is 50 MB.`,
      },
      { status: 413 }
    );
  }

  const category = (CATEGORIES as readonly string[]).includes(categoryRaw)
    ? (categoryRaw as Category)
    : null;
  if (!category) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: `category must be one of: ${CATEGORIES.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const visibility = (VISIBILITIES as readonly string[]).includes(visibilityRaw)
    ? (visibilityRaw as Visibility)
    : "team_shared";

  const kind = inferKind(file.type) ?? inferKindFromFilename(file.name);
  if (!kind) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported_type",
        message: `Unsupported file type: ${file.type || "unknown"} (${file.name}).`,
      },
      { status: 400 }
    );
  }

  // Storage path uses an `assets/` prefix so a single bucket holds everything.
  // The RLS on shared_resources allows owner writes regardless of subpath, so
  // we don't need to encode org_id in the path.
  const storagePath = `assets/${Date.now()}-${safeFilename(file.name)}`;
  const supabase = getSupabaseServerClient();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("shared_resources")
    .upload(storagePath, bytes, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "upload_failed",
        message: upErr.message,
      },
      { status: 500 }
    );
  }

  // Pre-sign a long-lived URL for thumbnail rendering. The bucket is private
  // so we can't use a public URL; signed URLs are scoped + renewable. For
  // owner_only items we still use the same path — RLS gates the listing.
  const { data: signed } = await supabase.storage
    .from("shared_resources")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  const payload = {
    category,
    visibility,
    mime_type: file.type || null,
    size_bytes: file.size,
    storage_bucket: "shared_resources",
    storage_path: storagePath,
    public_url: signed?.signedUrl ?? null,
    original_name: file.name,
    kind,
  };

  // shared_resources.is_active stays true; we use payload.visibility to
  // gate owner-only items in the page server query (RLS already restricts
  // by org membership).
  const insert = {
    organization_id: profile.organization_id,
    created_by: profile.id,
    resource_type: `asset_${kind}`,
    title: label || file.name,
    description: description || null,
    payload,
    is_active: true,
  };

  // For owner_only, we still let the RLS-managed read return it because the
  // page server filters by payload.visibility — RLS doesn't read jsonb.
  const { data: row, error: insErr } = await supabase
    .from("shared_resources")
    .insert(insert)
    .select("*")
    .single();
  if (insErr) {
    // Roll back storage to keep things consistent if the DB insert failed.
    try {
      await getSupabaseServiceClient()
        .storage.from("shared_resources")
        .remove([storagePath]);
    } catch {
      /* best effort */
    }
    return NextResponse.json(
      { ok: false, error: "insert_failed", message: insErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, asset: row });
}

// Optional: DELETE an asset by id. Owner only. Removes the storage object
// and the shared_resources row.
export async function DELETE(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !isOwner(profile) || !profile.organization_id) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner only." },
      { status: 403 }
    );
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Missing ?id" },
      { status: 400 }
    );
  }
  const supabase = getSupabaseServerClient();
  const { data: existing } = await supabase
    .from("shared_resources")
    .select("id,payload")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Asset not found." },
      { status: 404 }
    );
  }
  const storagePath =
    (existing.payload as { storage_path?: string })?.storage_path ?? null;
  await supabase.from("shared_resources").delete().eq("id", id);
  if (storagePath) {
    try {
      await supabase.storage.from("shared_resources").remove([storagePath]);
    } catch {
      /* best effort */
    }
  }
  return NextResponse.json({ ok: true });
}
