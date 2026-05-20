// Tool manifest builder — combines the native Atlas tool registry with the
// MCP connector snapshot into a single payload the UI and the chat planner
// can read. v1 ships STATUS SURFACING only — MCP connector `availableTools`
// arrays are empty (no live execution this sprint).

import { TOOLS } from "@/lib/atlas/registry";
import { getConnectorSnapshot } from "@/lib/mcp/status";
import type { AtlasToolManifest } from "@/lib/mcp/types";
import { getServerEnv } from "@/lib/env";

/**
 * Build the combined { tools, connectors, safety } manifest for the calling
 * user. Pass the user's id when available so we can read their L2
 * mcp_connections rows; pass null to get only L1 owner-global rows.
 */
export async function buildToolManifest(
  userId?: string | null
): Promise<AtlasToolManifest> {
  const connectors = await getConnectorSnapshot(userId ?? null);

  const env = getServerEnv();

  const tools: AtlasToolManifest["tools"] = TOOLS.map((t) => {
    const readiness = t.readinessCheck();
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      rolesAllowed: t.rolesAllowed.map((r) => r as string),
      audit: t.audit,
      requiresEnv: readiness.missing ?? [],
      ready: readiness.ready,
    };
  });

  return {
    tools,
    connectors,
    safety: {
      allow_live_social_publish: env.SAFETY.allowLiveSocialPublish,
      allow_live_email_send: env.SAFETY.allowLiveEmailSend,
      allow_paid_image_generation: env.SAFETY.allowPaidImageGeneration,
      allow_paid_text_generation: env.SAFETY.allowPaidTextGeneration,
    },
  };
}
