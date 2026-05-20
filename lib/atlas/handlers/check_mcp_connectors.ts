// Read-only snapshot of MCP connector status surfaced to the chat.
//
// This handler is the chat-side companion to the manifest API and the
// ConnectorStatusStrip. It returns a `connector_status` card that contains
// the same connector list + safety flags the UI sees, plus a plain-English
// summary the planner can use to answer "what MCP servers are connected?".
//
// HARD RULES:
//   * Never expose env var VALUES — only NAMES.
//   * Never expose `mcp_connections.auth_token` (already stripped by the
//     registry layer; only the `hasToken: boolean` flag survives).
//   * No live HTTP probe of any MCP server.

import type { ConnectorStatusCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  CheckMcpConnectorsInput,
} from "@/lib/atlas/registry";
import { getServerEnv } from "@/lib/env";
import { getConnectorSnapshot } from "@/lib/mcp/status";

const TOOL_ID = "check_mcp_connectors";

export async function checkMcpConnectors(
  _input: CheckMcpConnectorsInput,
  ctx: AtlasToolContext
): Promise<AtlasToolResult<ConnectorStatusCard>> {
  const snapshot = await getConnectorSnapshot(ctx.profile.id);
  const env = getServerEnv();
  const connected = snapshot.filter((c) => c.status === "connected").length;
  const total = snapshot.length;

  const lines = snapshot.map((c) => {
    const envHint =
      c.requiredEnv.length > 0 && c.status === "not_configured"
        ? ` — set ${c.requiredEnv.join(", ")}`
        : "";
    const scopeLabel =
      c.scope === "owner_global"
        ? "owner-global"
        : c.scope === "lo_personal"
        ? "personal"
        : "future";
    return `• ${c.name} [${scopeLabel}] — ${c.status}${envHint}`;
  });
  const safetyLines = [
    `• Live social publish — ${env.SAFETY.allowLiveSocialPublish ? "ON" : "OFF"} (ALLOW_LIVE_SOCIAL_PUBLISH)`,
    `• Live email send — ${env.SAFETY.allowLiveEmailSend ? "ON" : "OFF"} (ALLOW_LIVE_EMAIL_SEND)`,
  ];

  const card: ConnectorStatusCard = {
    kind: "connector_status",
    tool_id: TOOL_ID,
    title: `MCP connectors — ${connected}/${total} connected`,
    summary:
      total === 0
        ? "No MCP connectors registered."
        : `${connected} of ${total} ready. Click Open to manage.`,
    link: "/settings",
    connectors: snapshot,
    safety: {
      allow_live_social_publish: env.SAFETY.allowLiveSocialPublish,
      allow_live_email_send: env.SAFETY.allowLiveEmailSend,
      allow_paid_image_generation: env.SAFETY.allowPaidImageGeneration,
      allow_paid_text_generation: env.SAFETY.allowPaidTextGeneration,
    },
  };

  const message = [
    `MCP connector status (${connected}/${total} ready):`,
    ...lines,
    "",
    "Live-action flags:",
    ...safetyLines,
  ].join("\n");

  return { ok: true, card, message };
}
