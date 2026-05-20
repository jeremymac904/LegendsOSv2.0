// Read-only n8n readiness snapshot.
//
// We list each webhook by env var NAME and a boolean "present" flag. NEVER
// log or echo the URL value — we only check for non-empty existence. No HTTP
// probe to n8n itself; that's deferred to a future sprint.

import type { N8nStatusCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  CheckN8nReadinessInput,
} from "@/lib/atlas/registry";
import { getN8nConfigState } from "@/lib/automation/n8n";

const TOOL_ID = "check_n8n_workflow_readiness";

const WEBHOOK_NAMES: Array<{ key: keyof ReturnType<typeof getN8nConfigState>["webhooks"]; env: string; label: string }> = [
  { key: "social_publish", env: "N8N_WEBHOOK_SOCIAL_PUBLISH", label: "Social publish" },
  { key: "email_send", env: "N8N_WEBHOOK_EMAIL_SEND", label: "Email send" },
  { key: "content_reminder", env: "N8N_WEBHOOK_CONTENT_REMINDER", label: "Content reminder" },
  { key: "daily_usage", env: "N8N_WEBHOOK_DAILY_USAGE", label: "Daily usage" },
  { key: "failed_publish_recovery", env: "N8N_WEBHOOK_FAILED_PUBLISH_RECOVERY", label: "Failed-publish recovery" },
  { key: "provider_health", env: "N8N_WEBHOOK_PROVIDER_HEALTH", label: "Provider health" },
];

export async function checkN8nWorkflowReadiness(
  _input: CheckN8nReadinessInput,
  _ctx: AtlasToolContext
): Promise<AtlasToolResult<N8nStatusCard>> {
  const state = getN8nConfigState();
  const webhooks = WEBHOOK_NAMES.map((w) => ({
    name: w.label,
    env_var: w.env,
    present: Boolean(state.webhooks[w.key]),
  }));
  const ready = webhooks.filter((w) => w.present).length;

  const card: N8nStatusCard = {
    kind: "n8n_status",
    tool_id: TOOL_ID,
    title: state.configured ? "n8n configured" : "n8n not configured",
    summary: state.configured
      ? `${ready} of ${webhooks.length} webhooks set.`
      : "Set N8N_BASE_URL plus at least one N8N_WEBHOOK_* to enable outbound dispatch.",
    link: "/settings",
    configured: state.configured,
    base_url_present: state.base_url_present,
    webhooks,
  };
  const lines = webhooks
    .map((w) => `• ${w.name} (${w.env_var}) — ${w.present ? "present" : "missing"}`)
    .join("\n");
  const message = `n8n readiness:\n${lines}`;
  return { ok: true, card, message };
}
