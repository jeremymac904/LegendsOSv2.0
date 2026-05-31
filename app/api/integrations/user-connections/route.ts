import { NextResponse } from "next/server";

import { isAdminOrOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sprint 4 — Lane 5. Per-user integration connection status.
//
// HONESTY: this route returns STATUS ONLY (provider, status, scopes, updated
// timestamp). It NEVER returns a raw token, refresh token, or any secret
// column. The `user_integration_connections` table is created by the Supabase
// lane as an RLS migration that is NOT applied this sprint, so every read is
// wrapped and a missing table (Postgres 42P01) degrades to an honest
// "not provisioned yet" snapshot rather than a 500.

const TABLE = "user_integration_connections";

// The four Google capabilities surfaced in Settings. We always return a row
// per provider so the UI can render a "setup needed" card even when the table
// is empty or absent.
const PROVIDERS = [
  { provider: "google", label: "Google account" },
  { provider: "gmail", label: "Gmail" },
  { provider: "google_drive", label: "Google Drive" },
  { provider: "google_calendar", label: "Google Calendar" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["provider"];

// Honest connection status values. "setup_needed" is the safe default whenever
// no row exists or the table is not provisioned yet.
type ConnectionStatus =
  | "connected"
  | "setup_needed"
  | "error"
  | "disconnected";

// Inline row type — do NOT depend on a types/database.ts edit landing first.
// NOTE: we deliberately do not select any token column. Even if one exists in
// the table, it must never travel to the client.
interface UserIntegrationConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  status: string | null;
  scopes: string[] | null;
  updated_at: string | null;
}

interface ConnectionView {
  provider: ProviderId;
  label: string;
  status: ConnectionStatus;
  scopes: string[];
  updated_at: string | null;
}

interface TeamConnectionRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  provider: string;
  status: ConnectionStatus;
  updated_at: string | null;
}

function normalizeStatus(raw: string | null | undefined): ConnectionStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "connected":
    case "active":
      return "connected";
    case "error":
    case "failed":
      return "error";
    case "disconnected":
    case "revoked":
      return "disconnected";
    default:
      return "setup_needed";
  }
}

// True when the Supabase error is a missing-table / undefined-table error.
// Treated as "the migration hasn't been applied yet" -> honest setup needed.
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  // Build the always-present per-provider view, defaulting to setup_needed.
  const base: Record<ProviderId, ConnectionView> = PROVIDERS.reduce(
    (acc, p) => {
      acc[p.provider] = {
        provider: p.provider,
        label: p.label,
        status: "setup_needed",
        scopes: [],
        updated_at: null,
      };
      return acc;
    },
    {} as Record<ProviderId, ConnectionView>
  );

  let provisioned = true;

  // Read the current user's own rows under RLS. Missing table -> not
  // provisioned (honest setup needed), never a crash.
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("id,user_id,provider,status,scopes,updated_at")
      .eq("user_id", profile.id);

    if (error) {
      if (isMissingTable(error)) {
        provisioned = false;
      }
      // Any other error: keep defaults (setup_needed). Do not leak details.
    } else {
      const rows = (data ?? []) as UserIntegrationConnectionRow[];
      for (const row of rows) {
        const key = row.provider as ProviderId;
        if (key in base) {
          base[key] = {
            provider: key,
            label: base[key].label,
            status: normalizeStatus(row.status),
            scopes: Array.isArray(row.scopes) ? row.scopes : [],
            updated_at: row.updated_at,
          };
        }
      }
    }
  } catch {
    // Unconfigured Supabase / client construction failure — degrade honestly.
    provisioned = false;
  }

  // Owner/admin: compact team status table (status only, never tokens).
  const owner = isAdminOrOwner(profile);
  let team: TeamConnectionRow[] | null = null;
  if (owner) {
    team = [];
    try {
      const supabase = getSupabaseServerClient();
      // RLS on the table allows owner/admin to read team rows. Join the
      // status columns only; no token columns are ever selected.
      const { data, error } = await supabase
        .from(TABLE)
        .select("user_id,provider,status,updated_at")
        .order("updated_at", { ascending: false });

      if (error) {
        if (isMissingTable(error)) provisioned = false;
      } else {
        const rows = (data ?? []) as Array<{
          user_id: string;
          provider: string;
          status: string | null;
          updated_at: string | null;
        }>;

        // Resolve display names for the user ids we saw (best-effort).
        const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
        const nameById = new Map<string, { full_name: string | null; email: string | null }>();
        if (userIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id,full_name,email")
              .in("id", userIds);
            for (const p of (profiles ?? []) as Array<{
              id: string;
              full_name: string | null;
              email: string | null;
            }>) {
              nameById.set(p.id, { full_name: p.full_name, email: p.email });
            }
          } catch {
            // best-effort name resolution; status still renders without names
          }
        }

        team = rows.map((r) => ({
          user_id: r.user_id,
          full_name: nameById.get(r.user_id)?.full_name ?? null,
          email: nameById.get(r.user_id)?.email ?? null,
          provider: r.provider,
          status: normalizeStatus(r.status),
          updated_at: r.updated_at,
        }));
      }
    } catch {
      provisioned = false;
    }
  }

  return NextResponse.json({
    ok: true,
    // When false, the table migration has not been applied — the UI shows an
    // honest "setup needed" state for every provider.
    provisioned,
    connections: PROVIDERS.map((p) => base[p.provider]),
    isOwnerOrAdmin: owner,
    team,
  });
}
