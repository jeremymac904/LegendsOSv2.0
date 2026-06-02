// Integration-specific audit + publish-attempt logging.
// ---------------------------------------------------------------------------
// recordAudit() (lib/usage) writes the GENERIC audit_logs table. These helpers
// write the DEDICATED integration tables (integration_audit_log, publish_attempts)
// so the connection center / owner can see a real integration trail. Both tables
// are INSERT-via-service-role only (their RLS is SELECT-only for owner/admin), so
// these MUST use the service client. Both are best-effort: a logging failure
// (incl. a missing table, 42P01) never breaks the calling request.

import { getSupabaseServiceClient, isMissingDatabaseObjectError } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export interface IntegrationAuditInput {
  actor: Profile | null;
  action: string;
  provider?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  source_url?: string | null;
  metadata?: Record<string, unknown>;
}

// Append an integration audit row. NON-secret detail only — never pass tokens.
export async function recordIntegrationAudit(input: IntegrationAuditInput): Promise<void> {
  try {
    const service = getSupabaseServiceClient();
    const { error } = await service.from("integration_audit_log").insert({
      organization_id: input.actor?.organization_id ?? null,
      actor_id: input.actor?.id ?? null,
      action: input.action,
      provider: input.provider ?? null,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      source_url: input.source_url ?? null,
      metadata: input.metadata ?? {},
    });
    if (error && !isMissingDatabaseObjectError(error)) {
      console.error("integration audit failed", { code: error.code, message: error.message });
    }
  } catch (err) {
    // Service key missing or table absent — degrade silently, never break caller.
    if (!isMissingDatabaseObjectError(err)) {
      console.error("integration audit failed", err);
    }
  }
}

export type PublishAttemptStatus =
  | "queued"
  | "disabled"
  | "blocked"
  | "dispatched"
  | "published"
  | "failed";

export interface PublishAttemptInput {
  organization_id: string | null;
  social_post_id?: string | null;
  platform: string;
  route: string; // e.g. 'n8n' | 'meta_graph' | 'youtube' | 'gbp'
  status: PublishAttemptStatus;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

// Append a publish_attempts row so every publish decision (incl. blocked/queued)
// is auditable. Best-effort, service-role insert (RLS is select-only).
export async function recordPublishAttempt(input: PublishAttemptInput): Promise<void> {
  try {
    const service = getSupabaseServiceClient();
    const { error } = await service.from("publish_attempts").insert({
      organization_id: input.organization_id,
      social_post_id: input.social_post_id ?? null,
      platform: input.platform,
      route: input.route,
      status: input.status,
      error: input.error ?? null,
      metadata: input.metadata ?? {},
    });
    if (error && !isMissingDatabaseObjectError(error)) {
      console.error("publish attempt log failed", { code: error.code, message: error.message });
    }
  } catch (err) {
    if (!isMissingDatabaseObjectError(err)) {
      console.error("publish attempt log failed", err);
    }
  }
}
