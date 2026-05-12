"use client";

import { createBrowserClient } from "@supabase/ssr";

import { PUBLIC_ENV, isSupabaseConfigured } from "@/lib/env";

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (legacy NEXT_PUBLIC_SUPABASE_ANON_KEY is accepted as a fallback)."
    );
  }
  if (cached) return cached;
  cached = createBrowserClient(
    PUBLIC_ENV.SUPABASE_URL,
    PUBLIC_ENV.SUPABASE_PUBLISHABLE_KEY
  );
  return cached;
}
