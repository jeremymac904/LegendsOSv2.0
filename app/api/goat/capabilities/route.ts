import { withGoat, goatOk } from "@/lib/goat/api";
import {
  listCapabilityAgents,
  listCapabilityMcpServers,
  listCapabilityMemoryStores,
  listCapabilityRepositories,
  listCapabilityTools,
} from "@/lib/goat/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// list_capabilities — the live registry of what the GOAT Architect can reach.
export const GET = withGoat("/api/goat/capabilities", async (_req, ctx) =>
  goatOk(ctx, {
    tools: listCapabilityTools(),
    agents: listCapabilityAgents(),
    mcp_servers: listCapabilityMcpServers(),
    repositories: listCapabilityRepositories(),
    memory_stores: listCapabilityMemoryStores(),
  })
);
