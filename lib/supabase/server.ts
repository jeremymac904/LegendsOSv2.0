import { cookies } from "next/headers";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";

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
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

// Prefer auth.getUser() over reading session.user — getUser verifies the JWT
// against Supabase's auth server, while getSession trusts the cookie blob.
export async function getCurrentUser() {
  if (!supabaseReady()) return null;
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!supabaseReady()) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch profile", {
        code: error.code,
        message: error.message,
      });
      return ownerFallbackProfile(user, error) ?? null;
    }
    return ((data ?? ownerFallbackProfile(user)) as Profile | null) ?? null;
  } catch (error) {
    console.error("Failed to fetch profile", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return ownerFallbackProfile(user, error) ?? null;
  }
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("No active profile. Authentication required.");
  }
  return profile;
}

export function isMissingDatabaseObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  const message = maybe.message?.toLowerCase() ?? "";
  return (
    maybe.code === "42P01" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("schema cache") && message.includes("could not find"))
  );
}

function ownerFallbackProfile(user: User, error?: unknown): Profile | null {
  const email = user.email?.trim().toLowerCase();
  const ownerEmail = PUBLIC_ENV.OWNER_EMAIL.trim().toLowerCase();
  if (!email || email !== ownerEmail) return null;

  if (error && !isMissingDatabaseObjectError(error)) return null;

  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
      ? metadata.name
      : null;
  const now = new Date().toISOString();

  return {
    id: user.id,
    email,
    full_name: name,
    role: "owner",
    organization_id: null,
    avatar_url:
      typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
    is_active: true,
    last_seen_at: null,
    created_at: user.created_at ?? now,
    updated_at: now,
  };
}
