import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import { resolveWorkspaceRecord } from "@/lib/themeServer";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const formSchema = z.object({
  scope: z.enum(["personal", "workspace"]),
  kind: z.enum(["logo", "background_image", "background_video"]),
  workspace_id: z.string().uuid().optional(),
});

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function requestHost(req: NextRequest): string | null {
  return (
    req.headers.get("x-hostname") ??
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host")
  );
}

function bucketForScope(scope: "personal" | "workspace"): "uploads" | "shared_resources" {
  return scope === "personal" ? "uploads" : "shared_resources";
}

function isAllowedMime(kind: "logo" | "background_image" | "background_video", mime: string): boolean {
  if (kind === "background_video") {
    return ["video/mp4", "video/quicktime", "video/webm"].includes(mime);
  }
  return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime);
}

export async function POST(req: NextRequest) {
  const { profile, realProfile } = await getEffectiveProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  const actorProfile = realProfile ?? profile;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Expected multipart form data." },
      { status: 400 }
    );
  }

  const parsed = formSchema.safeParse({
    scope: form.get("scope"),
    kind: form.get("kind"),
    workspace_id: form.get("workspace_id"),
  });
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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "No file uploaded." },
      { status: 400 }
    );
  }
  const maxBytes =
    parsed.data.kind === "background_video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        ok: false,
        error: "file_too_large",
        message: `File is ${(file.size / 1_048_576).toFixed(1)} MB. Max is ${(maxBytes / 1_048_576).toFixed(0)} MB.`,
      },
      { status: 413 }
    );
  }

  if (!isAllowedMime(parsed.data.kind, file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported_type",
        message: `Unsupported file type: ${file.type || "unknown"}`,
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const host = requestHost(req);
  const workspace =
    parsed.data.scope === "workspace"
      ? (parsed.data.workspace_id
          ? await (async () => {
              const { data } = await supabase
                .from("brand_workspace_settings")
                .select("id, workspace_slug, organization_id")
                .eq("id", parsed.data.workspace_id)
                .eq("organization_id", actorProfile.organization_id ?? profile.organization_id ?? "")
                .maybeSingle();
              return data ?? null;
            })()
          : await resolveWorkspaceRecord({ profile: actorProfile, host })) ?? null
      : null;

  if (parsed.data.scope === "workspace" && !isOwner(actorProfile)) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message: "Only the owner can upload workspace branding assets.",
      },
      { status: 403 }
    );
  }

  if (parsed.data.scope === "workspace" && !workspace) {
    return NextResponse.json(
      {
        ok: false,
        error: "workspace_missing",
        message: "No branded workspace is configured for this org.",
      },
      { status: 404 }
    );
  }

  const bucket = bucketForScope(parsed.data.scope);
  const storagePrefix =
    parsed.data.scope === "personal"
      ? `${profile.id}/theme/${parsed.data.kind}`
      : `branding/${workspace?.workspace_slug ?? workspace?.id ?? "workspace"}/${parsed.data.kind}`;
  const storagePath = `${storagePrefix}/${Date.now()}-${safeFilename(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, bytes, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        ok: false,
        error: "upload_failed",
        message: uploadError.message,
      },
      { status: 500 }
    );
  }

  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  return NextResponse.json({
    ok: true,
    bucket,
    path: storagePath,
    url: signed?.signedUrl ?? null,
    kind: parsed.data.kind,
    scope: parsed.data.scope,
  });
}
