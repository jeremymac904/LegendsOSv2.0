import { cookies } from "next/headers";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { PUBLIC_ENV, getServerEnv, isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/types/database";

// Per-request, RLS-respecting Supabase client. Use for anything tied to the
// signed-in user (reading their data, writing through policies, etc.).
export function getSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    PUBLIC_ENV.SUPABASE_URL,
    PUBLIC_ENV.SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set({ name, value, ...options });
            }
          } catch {
            // Called from a Server Component — middleware refreshes cookies,
            // so this is a safe no-op.
          }
        },
      },
    }
  );
}

// Service-role client. NEVER use in code that runs in the browser. Use for
// privileged server actions (writing audit logs, queuing automation jobs,
// reading provider secrets for outbound API calls, owner-level admin reads).
export function getSupabaseServiceClient() {
  const env = getServerEnv();
  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. Add it to .env.local (legacy SUPABASE_SERVICE_ROLE_KEY is also accepted)."
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function supabaseReady(): boolean {
  return isSupabaseConfigured();
}

export async function getCurrentSession() {
  if (!supabaseReady()) return null;
  const supabase = getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

// Prefer auth.getUser() over reading session.user — getUser verifies the JWT
// against Supabase's auth server, while getSession trusts the cookie blob.
export async function getCurrentUser() {
  if (!supabaseReady()) return null;
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!supabaseReady()) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.error("Failed to fetch profile", error);
    return null;
  }
  return (data ?? null) as Profile | null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("No active profile. Authentication required.");
  }
  return profile;
}
