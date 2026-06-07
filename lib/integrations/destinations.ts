// Server-only selected-destination resolver.
// ---------------------------------------------------------------------------
// "Which destination did THIS user pick for platform X?" Reads the per-user
// social_account_connections rows (service client — works regardless of the
// caller's RLS context) and returns the active publish destination. Publishers
// use this to target the user's own Page / IG account / GBP location / channel
// instead of any env-global id.
//
// Server-only: never import from a client component.

import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type DestinationPlatform =
  | "facebook"
  | "instagram"
  | "google_business_profile"
  | "youtube";

export interface SelectedDestination {
  destination_ref: string | null;
  page_id: string | null;
  destination_label: string | null;
  is_publish_enabled: boolean;
  status: string | null;
  metadata: Record<string, unknown> | null;
}

export type SelectedDestinationResult =
  | { ok: true; destination: SelectedDestination }
  | { ok: false; reason: "no_destination" | "error"; message?: string };

interface DestinationRow {
  destination_ref: string | null;
  page_id: string | null;
  destination_label: string | null;
  is_publish_enabled: boolean | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string | null;
}

function toDestination(row: DestinationRow): SelectedDestination {
  return {
    destination_ref: row.destination_ref ?? null,
    page_id: row.page_id ?? null,
    destination_label: row.destination_label ?? null,
    is_publish_enabled: Boolean(row.is_publish_enabled),
    status: row.status ?? null,
    metadata: row.metadata ?? null,
  };
}

/**
 * Return the user's selected publish destination for a platform.
 *
 * Prefers a publish-enabled + connected destination; falls back to the most
 * recently updated row otherwise. Returns { ok: false, reason: 'no_destination' }
 * when the user has selected nothing for the platform.
 */
export async function getSelectedDestination(
  userId: string,
  platform: DestinationPlatform
): Promise<SelectedDestinationResult> {
  const service = getSupabaseServiceClient();

  let rows: DestinationRow[];
  try {
    const { data, error } = await service
      .from("social_account_connections")
      .select("destination_ref,page_id,destination_label,is_publish_enabled,status,metadata,updated_at")
      .eq("user_id", userId)
      .eq("platform", platform)
      .order("updated_at", { ascending: false });
    if (error) {
      return { ok: false, reason: "error", message: error.message };
    }
    rows = (data as DestinationRow[] | null) ?? [];
  } catch (err) {
    return { ok: false, reason: "error", message: err instanceof Error ? err.message : "destination read failed" };
  }

  if (rows.length === 0) {
    return { ok: false, reason: "no_destination" };
  }

  // Prefer a publish-enabled, connected destination; rows are already ordered
  // most-recent-first, so the first match wins.
  const preferred =
    rows.find((r) => Boolean(r.is_publish_enabled) && r.status === "connected") ?? rows[0];

  return { ok: true, destination: toDestination(preferred) };
}
