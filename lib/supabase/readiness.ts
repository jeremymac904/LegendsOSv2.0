import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingDatabaseObjectError } from "@/lib/supabase/server";

export type ReadinessGroup =
  | "browser_companion"
  | "integrations"
  | "agent_runtime"
  | "loan_memory"
  | "team_onboarding";

export interface RequiredTableCheck {
  table: string;
  group: ReadinessGroup;
  required: boolean;
}

export interface TableReadiness extends RequiredTableCheck {
  exists: boolean;
  readable: boolean;
  status: "ready" | "missing" | "not_readable";
  error_code: string | null;
}

export const REQUIRED_PRODUCTION_TABLES: RequiredTableCheck[] = [
  { table: "browser_companion_sessions", group: "browser_companion", required: true },
  { table: "browser_companion_captures", group: "browser_companion", required: true },
  { table: "integration_audit_log", group: "integrations", required: true },
  { table: "user_integration_connections", group: "integrations", required: true },
  { table: "social_account_connections", group: "integrations", required: true },
  { table: "publish_attempts", group: "integrations", required: true },
  { table: "agent_sessions", group: "agent_runtime", required: true },
  { table: "agent_messages", group: "agent_runtime", required: true },
  { table: "agent_memories", group: "agent_runtime", required: true },
  { table: "agent_memory_events", group: "agent_runtime", required: true },
  { table: "agent_skills", group: "agent_runtime", required: true },
  { table: "agent_skill_versions", group: "agent_runtime", required: true },
  { table: "agent_skill_usage", group: "agent_runtime", required: true },
  { table: "agent_tool_calls", group: "agent_runtime", required: true },
  { table: "agent_traces", group: "agent_runtime", required: true },
  { table: "agent_handoffs", group: "agent_runtime", required: true },
  { table: "loan_memory", group: "loan_memory", required: true },
  { table: "loan_memory_events", group: "loan_memory", required: true },
  { table: "loan_documents", group: "loan_memory", required: true },
  { table: "loan_ai_retrieval_logs", group: "loan_memory", required: true },
  { table: "user_ai_preferences", group: "loan_memory", required: true },
  { table: "profiles", group: "team_onboarding", required: true },
  { table: "organization_members", group: "team_onboarding", required: true },
];

export async function checkRequiredTables(
  supabase: SupabaseClient,
  checks: RequiredTableCheck[] = REQUIRED_PRODUCTION_TABLES
): Promise<TableReadiness[]> {
  const results: TableReadiness[] = [];

  for (const check of checks) {
    const { error } = await supabase
      .from(check.table)
      .select("id", { count: "exact", head: true });

    if (!error) {
      results.push({
        ...check,
        exists: true,
        readable: true,
        status: "ready",
        error_code: null,
      });
      continue;
    }

    const missing = isMissingDatabaseObjectError(error);
    results.push({
      ...check,
      exists: !missing,
      readable: false,
      status: missing ? "missing" : "not_readable",
      error_code: error.code ?? null,
    });
  }

  return results;
}
