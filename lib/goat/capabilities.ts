// GOAT Architect Command API — capabilities registry.
// ---------------------------------------------------------------------------
// list_capabilities returns what the GOAT Architect can actually reach from
// this deployment. Tools and agents are read from the live LegendsOS agent
// registry (single source of truth); MCP servers / repositories / memory
// stores are declared here because they live outside this codebase.
// ---------------------------------------------------------------------------

import { TOOL_DEFS } from "@/lib/agents/tools";
import { AGENT_TYPES } from "@/lib/agents/types";

export interface CapabilityTool {
  name: string;
  description: string;
  permission: string;
}

export interface CapabilityAgent {
  type: string;
  label: string;
}

export interface CapabilityMcpServer {
  name: string;
  purpose: string;
}

export interface CapabilityRepository {
  name: string;
  url: string;
  default_branch: string;
  deploy_target: string;
}

export interface CapabilityMemoryStore {
  name: string;
  backend: string;
  purpose: string;
}

const AGENT_LABELS: Record<string, string> = {
  owner_atlas: "Atlas (owner command agent)",
  lo_atlas: "Atlas for loan officers",
  processor_flo: "Flo (processing agent)",
  coordinator_agent: "Transaction coordinator agent",
  builder_agent: "Builder / automation agent",
  marketing_agent: "Marketing agent",
  academy_agent: "Academy coaching agent",
  media_agent: "Media production agent",
  social_agent: "Social content agent",
  docs_agent: "Docs / knowledge agent",
  ux_agent: "UX review agent",
};

export function listCapabilityTools(): CapabilityTool[] {
  return Object.values(TOOL_DEFS).map((t) => ({
    name: t.name,
    description: t.description,
    permission: t.permission,
  }));
}

export function listCapabilityAgents(): CapabilityAgent[] {
  return AGENT_TYPES.map((type) => ({
    type,
    label: AGENT_LABELS[type] ?? type,
  }));
}

export function listCapabilityMcpServers(): CapabilityMcpServer[] {
  return [
    { name: "supabase", purpose: "Database, auth, storage, and migrations for LegendsOS." },
    { name: "netlify", purpose: "Deploys, env vars, and function logs for legendsos.app." },
    { name: "n8n", purpose: "Automation workflows (sandboxed queue for social/email)." },
    { name: "github", purpose: "Repository operations on jeremymac904/LegendsOSv2.0." },
    { name: "zapier", purpose: "Cross-app automations (Gmail, Sheets, Calendar, GHL)." },
    { name: "context7", purpose: "Up-to-date library documentation lookups." },
  ];
}

export function listCapabilityRepositories(): CapabilityRepository[] {
  return [
    {
      name: "LegendsOSv2.0",
      url: "https://github.com/jeremymac904/LegendsOSv2.0",
      default_branch: "main",
      deploy_target: "https://legendsos.app (Netlify)",
    },
  ];
}

export function listCapabilityMemoryStores(): CapabilityMemoryStore[] {
  return [
    {
      name: "goat_memories",
      backend: "supabase",
      purpose: "GOAT Architect long-term memory (written via write_memory).",
    },
    {
      name: "goat_projects",
      backend: "supabase",
      purpose: "GOAT project registry (created via create_project).",
    },
    {
      name: "agent_memories",
      backend: "supabase",
      purpose: "Per-user LegendsOS agent memory (RLS protected).",
    },
    {
      name: "loan_memory",
      backend: "supabase",
      purpose: "Persistent loan timeline memory for the mortgage team.",
    },
    {
      name: "claude-code-memory",
      backend: "filesystem",
      purpose: "Claude Code session memory on Jeremy's workstation (not reachable from this API).",
    },
  ];
}
