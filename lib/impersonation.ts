// Owner impersonation — UI-LEVEL ONLY.
//
// This is intentionally NOT a real Supabase session swap. Swapping the
// auth session would mean rewriting refresh tokens and could leak the
// target user's data through RLS in ways that are hard to reason about.
//
// Instead, the owner sets a cookie `legendsos-impersonate=<user_id>`. The
// app reads that cookie on the server (`getEffectiveProfile`) and renders
// UI as if it were that user — sidebar items, role gates, visible
// dashboards. Database reads still happen as the OWNER, because RLS still
// uses the owner's auth.uid(). That's fine for preview: the owner can see
// any row anyway. Writes, however, are blocked client-side via the banner
// + UI hints so the owner doesn't accidentally write under the wrong
// persona.
//
// The cookie is HttpOnly so a stray XSS can't read it, scoped to the same
// site, and short-lived (24h). The /api/admin/impersonate endpoint only
// accepts the cookie set request when the caller is the owner.

import { cookies } from "next/headers";

import {
  getCurrentProfile,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const IMPERSONATION_COOKIE = "legendsos-impersonate";

export async function getEffectiveProfile(): Promise<{
  profile: Profile | null;
  realProfile: Profile | null;
  impersonating: boolean;
}> {
  const real = await getCurrentProfile();
  if (!real) {
    return { profile: null, realProfile: null, impersonating: false };
  }
  if (real.role !== "owner") {
    // Only the owner can impersonate; clear any leftover cookie.
    return { profile: real, realProfile: real, impersonating: false };
  }
  const targetId = cookies().get(IMPERSONATION_COOKIE)?.value;
  if (!targetId || targetId === real.id) {
    return { profile: real, realProfile: real, impersonating: false };
  }
  // Use service-role to fetch the target profile — RLS would block the
  // owner from reading other org members via standard policies in some
  // configurations.
  const service = getSupabaseServiceClient();
  const { data } = await service
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .maybeSingle();
  if (!data) {
    return { profile: real, realProfile: real, impersonating: false };
  }
  return {
    profile: data as Profile,
    realProfile: real,
    impersonating: true,
  };
}
