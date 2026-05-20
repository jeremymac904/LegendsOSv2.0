// Re-export the Supabase client types used by Atlas handlers + registry, so
// registry.ts doesn't need to import from `lib/supabase/server` (which would
// drag the cookies / runtime dependency into a file that handlers import for
// types).
//
// These are intentionally `ReturnType<typeof ...>` so we stay in lock-step
// with the actual factory signatures without re-declaring the schema.

import type {
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

export type SupabaseServerClient = ReturnType<typeof getSupabaseServerClient>;
export type SupabaseServiceClient = ReturnType<typeof getSupabaseServiceClient>;
