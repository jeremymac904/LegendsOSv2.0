import { NextResponse } from "next/server";

import { parseContacts, parseNumberOrNull, trimOrNull } from "@/lib/newsletter/csv";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { logUsage } from "@/lib/usage";
import type { NewsletterContactImport } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 200;
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB upload cap

interface RowError {
  row: number;
  reason: string;
  email?: string | null;
}

// POST /api/email/audiences/import
// FormData fields:
//   * file: the CSV file
//   * audience_id: target audience UUID
//   * source_file_name: optional override (defaults to file.name)
//
// Behaviour:
//   * Accepts the audience id, validates it belongs to the caller.
//   * Parses the CSV server-side (no client-side trust of mapping).
//   * Dedupes by (owner_user_id, lower(email)) — the partial unique index
//     in the migration enforces this on the DB side.
//   * Falls back to Email 2 when primary Email is missing.
//   * Inserts in batches of 200 via the service-role client (owner-only path).
//   * Returns a clean summary; row-level errors do not abort the import.
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  const audienceId = String(form.get("audience_id") ?? "").trim();
  const overrideName = String(form.get("source_file_name") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Attach a CSV file as `file`." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; max is ${MAX_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 }
    );
  }
  if (!audienceId) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "audience_id is required." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data: audience } = await supabase
    .from("newsletter_audiences")
    .select("id,owner_user_id,organization_id,name")
    .eq("id", audienceId)
    .maybeSingle();
  if (!audience) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Audience not found or not yours." },
      { status: 404 }
    );
  }

  // Create an import row up-front so the UI has something to show.
  const service = getSupabaseServiceClient();
  const sourceFileName = overrideName || file.name || "uploaded.csv";
  const { data: importRow, error: insErr } = await service
    .from("newsletter_contact_imports")
    .insert({
      owner_user_id: profile.id,
      organization_id: profile.organization_id,
      audience_id: audience.id,
      source_file_name: sourceFileName,
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (insErr || !importRow) {
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: insErr?.message ?? "import row create failed",
      },
      { status: 500 }
    );
  }

  const text = await file.text();
  const rowErrors: RowError[] = [];
  const stats = {
    total_rows: 0,
    inserted_count: 0,
    updated_count: 0,
    duplicate_count: 0,
    missing_email_count: 0,
    error_count: 0,
  };

  // Stage 1: parse + bucket by email so we can dedupe within the import too.
  const byEmail = new Map<string, Record<string, unknown>>();
  for (const parsed of parseContacts(text)) {
    stats.total_rows++;
    const c = parsed.canonical;
    const primaryEmail = parsed.email ?? parsed.email_2;
    if (!primaryEmail) {
      stats.missing_email_count++;
      rowErrors.push({
        row: parsed.row_number,
        reason: "missing valid email",
      });
      continue;
    }
    if (byEmail.has(primaryEmail)) {
      stats.duplicate_count++;
      continue;
    }
    byEmail.set(primaryEmail, {
      owner_user_id: profile.id,
      organization_id: profile.organization_id,
      audience_id: audience.id,
      source_import_id: importRow.id,
      source_file_name: sourceFileName,
      status: "active",
      full_name: c.full_name,
      first_name: c.first_name,
      last_name: c.last_name,
      email: primaryEmail,
      email_2: parsed.email_2 && parsed.email_2 !== primaryEmail ? parsed.email_2 : null,
      phone: c.phone,
      phone_2: c.phone_2,
      office_phone: c.office_phone,
      office_name: c.office_name,
      city: c.city,
      state: c.state,
      state_license: c.state_license,
      facebook_url: c.facebook_url,
      instagram_url: c.instagram_url,
      linkedin_url: c.linkedin_url,
      x_url: c.x_url,
      youtube_url: c.youtube_url,
      tiktok_url: c.tiktok_url,
      zillow_url: c.zillow_url,
      other_links: c.other_links,
      transaction_count: parseNumberOrNull(c.transaction_count),
      total_volume: parseNumberOrNull(c.total_volume),
      buyer_volume: parseNumberOrNull(c.buyer_volume),
      buyer_units: parseNumberOrNull(c.buyer_units),
    });
  }

  // Stage 2: batch upsert. We use ON CONFLICT (owner_user_id, email) to keep
  // existing rows updated rather than failing the whole batch.
  const rows = Array.from(byEmail.values());
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await service
      .from("newsletter_contacts")
      .upsert(batch, {
        onConflict: "owner_user_id,email",
        ignoreDuplicates: false,
      })
      .select("id,created_at,updated_at");
    if (error) {
      stats.error_count += batch.length;
      rowErrors.push({
        row: 0,
        reason: `batch upsert failed at offset ${i}: ${error.message.slice(0, 200)}`,
      });
      continue;
    }
    // Treat rows whose updated_at != created_at as updates (existing dedupe).
    for (const r of data ?? []) {
      if (r.created_at === r.updated_at) {
        stats.inserted_count++;
      } else {
        stats.updated_count++;
      }
    }
  }

  const finalStatus =
    stats.error_count > 0
      ? stats.inserted_count + stats.updated_count > 0
        ? "partial"
        : "failed"
      : "succeeded";

  const { data: finalImport } = await service
    .from("newsletter_contact_imports")
    .update({
      ...stats,
      errors: rowErrors.slice(0, 100), // cap stored errors
      status: finalStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", importRow.id)
    .select("*")
    .single();

  await logUsage(profile, {
    module: "email",
    event_type: "audience_import",
    metadata: {
      audience_id: audience.id,
      import_id: importRow.id,
      status: finalStatus,
      ...stats,
    },
  });

  return NextResponse.json({
    ok: true,
    import: (finalImport ?? importRow) as NewsletterContactImport,
    stats,
    errors_preview: rowErrors.slice(0, 25),
  });
}
