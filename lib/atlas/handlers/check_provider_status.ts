// Read-only status snapshot for every AI provider Atlas can call.
//
// We DELIBERATELY read only `configured` and `enabled` booleans — the values
// of the API keys never leave the server. The card lists env var NAMES so
// owners know what to flip in Netlify env when something is missing.

import type { ProviderStatusCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  CheckProviderStatusInput,
} from "@/lib/atlas/registry";
import { getAIProviderStatuses } from "@/lib/env";

const TOOL_ID = "check_provider_status";

export async function checkProviderStatus(
  _input: CheckProviderStatusInput,
  _ctx: AtlasToolContext
): Promise<AtlasToolResult<ProviderStatusCard>> {
  const statuses = getAIProviderStatuses();
  const providers = statuses.map((p) => {
    let status: ProviderStatusCard["providers"][number]["status"];
    let next_action: string | null = null;
    if (!p.configured) {
      status = "missing";
      next_action = `Set ${p.envVarNames[0]} in Netlify env to enable live ${p.label} calls.`;
    } else if (!p.enabled) {
      status = "disabled";
      next_action = `Re-enable ${p.label} in Settings — AI_ENABLE_${p.id.toUpperCase()} is off.`;
    } else {
      status = "ready";
    }
    return {
      id: p.id,
      label: p.label,
      status,
      env_var: p.envVarNames[0],
      next_action,
    };
  });

  const ready = providers.filter((p) => p.status === "ready").length;
  const card: ProviderStatusCard = {
    kind: "provider_status",
    tool_id: TOOL_ID,
    title: "AI provider status",
    summary: `${ready} of ${providers.length} provider${providers.length === 1 ? "" : "s"} ready.`,
    link: "/settings",
    providers,
  };
  const lines = providers
    .map(
      (p) =>
        `• ${p.label} — ${p.status}${p.next_action ? ` (${p.next_action})` : ""}`
    )
    .join("\n");
  const message = `AI provider status:\n${lines}`;
  return { ok: true, card, message };
}
