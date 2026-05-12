import { getServerEnv } from "@/lib/env";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type UsageModule =
  | "atlas"
  | "social"
  | "images"
  | "email"
  | "calendar"
  | "knowledge"
  | "admin"
  | "settings"
  | "gateway";

export interface UsageEventInput {
  module: UsageModule | string;
  event_type: string;
  provider?: string | null;
  cost_estimate?: number | null;
  metadata?: Record<string, unknown>;
}

// Record a usage event using the user's RLS-respecting client.
export async function logUsage(profile: Profile | null, input: UsageEventInput) {
  if (!profile) return;
  const supabase = getSupabaseServerClient();
  await supabase.from("usage_events").insert({
    user_id: profile.id,
    organization_id: profile.organization_id,
    module: input.module,
    event_type: input.event_type,
    provider: input.provider ?? null,
    cost_estimate: input.cost_estimate ?? null,
    metadata: input.metadata ?? {},
  });
}

// Record an audit log entry through the service role. Use for owner-visible
// actions and security-sensitive operations.
export async function recordAudit(args: {
  actor: Profile | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const service = getSupabaseServiceClient();
    await service.from("audit_logs").insert({
      actor_user_id: args.actor?.id ?? null,
      organization_id: args.actor?.organization_id ?? null,
      action: args.action,
      target_type: args.target_type ?? null,
      target_id: args.target_id ?? null,
      metadata: args.metadata ?? {},
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

// Returns the usage count and the configured cap. Cap of 0 means disabled.
export async function checkDailyCap(
  profile: Profile,
  module: UsageModule,
  capName: keyof ReturnType<typeof getServerEnv>["DAILY_CAPS"]
): Promise<{ used: number; cap: number; allowed: boolean }> {
  const env = getServerEnv();
  const cap = env.DAILY_CAPS[capName] ?? 0;
  const supabase = getSupabaseServerClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("usage_events")
    .select("*", { head: true, count: "exact" })
    .eq("user_id", profile.id)
    .eq("module", module)
    .gte("created_at", since);
  const used = count ?? 0;
  return { used, cap, allowed: cap === 0 ? true : used < cap };
}
