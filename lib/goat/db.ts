// GOAT Architect Command API — Supabase access helpers.
// ---------------------------------------------------------------------------
// All GOAT tables (goat_projects, goat_memories, goat_runs) are service-role
// only: RLS is enabled with no policies, so the ONLY path in is this server
// using the secret key. Routes never expose the client to the browser.
// ---------------------------------------------------------------------------

import type { NextResponse } from "next/server";

import { getSupabaseServiceClient, isMissingDatabaseObjectError } from "@/lib/supabase/server";

import { goatFail, type GoatContext } from "./api";

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>;

export function getGoatClient(
  ctx: GoatContext
): { db: ServiceClient; fail: null } | { db: null; fail: NextResponse } {
  try {
    return { db: getSupabaseServiceClient(), fail: null };
  } catch {
    return {
      db: null,
      fail: goatFail(
        ctx,
        503,
        "supabase_not_configured",
        "Supabase service credentials are not set on this deployment (SUPABASE_SECRET_KEY)."
      ),
    };
  }
}

/** Maps a Supabase error to a useful JSON failure (migration hint included). */
export function goatDbFail(ctx: GoatContext, error: { message: string; code?: string }) {
  if (isMissingDatabaseObjectError(error)) {
    return goatFail(
      ctx,
      503,
      "migration_missing",
      "GOAT tables are missing. Apply supabase/migrations/*_goat_command_api.sql and retry."
    );
  }
  return goatFail(ctx, 500, "database_error", error.message);
}

/** Sanitizes a keyword for use inside a PostgREST .or(ilike...) filter. */
export function ilikeTerm(raw: string): string {
  return `%${raw.replace(/[%_,()]/g, " ").trim()}%`;
}
