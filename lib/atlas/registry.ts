// Atlas tool registry — the single source of truth for what Atlas can do.
//
// Each `ToolEntry` is the metadata + handler + readiness check for one tool.
// The planner reads the registry to advertise tools to the LLM; the executor
// reads the registry to validate input and run the handler. The chat route
// never knows the specifics of any individual tool — everything flows through
// this registry.
//
// readinessCheck rules:
//   * Returns { ready, missing? }. `missing` is a list of env var NAMES only,
//     never values. The runtime surfaces these names in plain-English errors.
//   * Read process.env presence with `.length > 0`, never log or echo the
//     value.
//
// audit rules:
//   * `audit: true` → executor records an audit_logs row + a usage_events row
//     on success.
//   * `audit: false` (default for read-only tools) → only usage_events.

import { z } from "zod";

import type { AtlasCard } from "@/lib/atlas/cards";
import { attachAssetToSocialDraft } from "@/lib/atlas/handlers/attach_asset_to_social_draft";
import { checkMcpConnectors } from "@/lib/atlas/handlers/check_mcp_connectors";
import { checkN8nWorkflowReadiness } from "@/lib/atlas/handlers/check_n8n_workflow_readiness";
import { checkProviderStatus } from "@/lib/atlas/handlers/check_provider_status";
import { createCalendarItem } from "@/lib/atlas/handlers/create_calendar_item";
import { createEmailDraft } from "@/lib/atlas/handlers/create_email_draft";
import { createHandoffSummary } from "@/lib/atlas/handlers/create_handoff_summary";
import { createKnowledgeNote } from "@/lib/atlas/handlers/create_knowledge_note";
import { createSocialDraft } from "@/lib/atlas/handlers/create_social_draft";
import { explainCapabilities } from "@/lib/atlas/handlers/explain_capabilities";
import { prepareImageGenerationPrompt } from "@/lib/atlas/handlers/prepare_image_generation_prompt";
import { retrieveAsset } from "@/lib/atlas/handlers/retrieve_asset";
import { searchKnowledge } from "@/lib/atlas/handlers/search_knowledge";
import type {
  SupabaseServerClient,
  SupabaseServiceClient,
} from "@/lib/atlas/runtime-types";
import type { Profile } from "@/types/database";

export type AtlasToolRole =
  | "owner"
  | "admin"
  | "loan_officer"
  | "processor"
  | "marketing"
  | "viewer";

export type AtlasReadinessResult = { ready: boolean; missing?: string[] };

export interface AtlasToolContext {
  profile: Profile;
  supabase: SupabaseServerClient;
  serviceClient: SupabaseServiceClient;
  thread_id: string | null;
  assistant_id: string | null;
}

export interface AtlasToolResultOk<C extends AtlasCard = AtlasCard> {
  ok: true;
  card: C;
  // The assistant-facing text body to write into chat_messages.content.
  message: string;
}

export interface AtlasToolResultErr {
  ok: false;
  error: string;
  // Plain-English message. NEVER include env values, only NAMES.
  message: string;
}

export type AtlasToolResult<C extends AtlasCard = AtlasCard> =
  | AtlasToolResultOk<C>
  | AtlasToolResultErr;

export interface ToolEntry<I = unknown> {
  // Stable id, used by the planner + chip rendering.
  id: string;
  // Human label (chip + manifest).
  name: string;
  // Description shown to the planner LLM. ≤ 200 chars.
  description: string;
  // Zod schema for input. Used to validate planner output before exec.
  inputSchema: z.ZodType<I>;
  // Card kind this tool emits. Used for UI rendering + analytics.
  resultCardKind: AtlasCard["kind"];
  // Roles allowed to invoke the tool. Viewer is excluded from any write tool.
  rolesAllowed: AtlasToolRole[];
  // True for tools with side effects (DB writes). False for read-only.
  audit: boolean;
  // Static readiness check. NEVER reads env values, only existence.
  readinessCheck: () => AtlasReadinessResult;
  // Handler. Validated input, server context. Must never throw — return
  // { ok: false } with a plain-English message instead.
  handler: (input: I, ctx: AtlasToolContext) => Promise<AtlasToolResult>;
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const SOCIAL_CHANNELS = [
  "facebook",
  "instagram",
  "google_business_profile",
  "youtube",
] as const;

export const createSocialDraftSchema = z.object({
  title: z.string().max(160).nullable().optional(),
  body: z.string().min(1).max(4000),
  channels: z
    .array(z.enum(SOCIAL_CHANNELS))
    .min(1)
    .max(SOCIAL_CHANNELS.length),
});
export type CreateSocialDraftInput = z.infer<typeof createSocialDraftSchema>;

export const createEmailDraftSchema = z.object({
  subject: z.string().min(1).max(160),
  body: z.string().min(1).max(8000),
});
export type CreateEmailDraftInput = z.infer<typeof createEmailDraftSchema>;

export const createCalendarItemSchema = z.object({
  title: z.string().min(1).max(160),
  starts_at: z.string().min(1).max(40), // ISO string
  description: z.string().max(2000).nullable().optional(),
  date_phrase: z.string().max(60).nullable().optional(),
});
export type CreateCalendarItemInput = z.infer<typeof createCalendarItemSchema>;

export const createKnowledgeNoteSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(8000),
  collection_hint: z.string().max(80).nullable().optional(),
});
export type CreateKnowledgeNoteInput = z.infer<typeof createKnowledgeNoteSchema>;

export const searchKnowledgeSchema = z.object({
  query: z.string().min(1).max(400),
  limit: z.number().int().min(1).max(10).optional(),
});
export type SearchKnowledgeInput = z.infer<typeof searchKnowledgeSchema>;

export const retrieveAssetSchema = z.object({
  query: z.string().min(1).max(400),
  limit: z.number().int().min(1).max(10).optional(),
});
export type RetrieveAssetInput = z.infer<typeof retrieveAssetSchema>;

export const attachAssetToSocialDraftSchema = z.object({
  social_post_id: z.string().uuid(),
  asset_id: z.string().uuid(),
});
export type AttachAssetInput = z.infer<typeof attachAssetToSocialDraftSchema>;

export const checkProviderStatusSchema = z.object({});
export type CheckProviderStatusInput = z.infer<typeof checkProviderStatusSchema>;

export const checkN8nReadinessSchema = z.object({});
export type CheckN8nReadinessInput = z.infer<typeof checkN8nReadinessSchema>;

export const prepareImagePromptSchema = z.object({
  subject: z.string().min(1).max(400),
  aspect_ratio: z
    .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
    .optional(),
  notes: z.string().max(600).optional(),
});
export type PrepareImagePromptInput = z.infer<typeof prepareImagePromptSchema>;

export const createHandoffSummarySchema = z.object({
  topic: z.string().min(1).max(200),
  bullets: z.array(z.string().min(1).max(200)).min(1).max(8),
  next_step: z.string().min(1).max(280),
});
export type CreateHandoffSummaryInput = z.infer<typeof createHandoffSummarySchema>;

export const explainCapabilitiesSchema = z.object({});
export type ExplainCapabilitiesInput = z.infer<typeof explainCapabilitiesSchema>;

export const checkMcpConnectorsSchema = z.object({});
export type CheckMcpConnectorsInput = z.infer<typeof checkMcpConnectorsSchema>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const WRITE_ROLES: AtlasToolRole[] = [
  "owner",
  "admin",
  "loan_officer",
  "processor",
  "marketing",
];

const ALL_ROLES: AtlasToolRole[] = [...WRITE_ROLES, "viewer"];

// Helper for tools that don't need any env at all — always ready.
const alwaysReady = (): AtlasReadinessResult => ({ ready: true });

// Helper that checks an env var exists (NOT its value). The runtime surfaces
// `missing` names to the user; the values never leave the server.
function envPresent(...names: string[]): AtlasReadinessResult {
  const missing = names.filter((n) => !(process.env[n] && process.env[n]!.length > 0));
  return missing.length === 0
    ? { ready: true }
    : { ready: false, missing };
}

export const TOOLS: ToolEntry[] = [
  {
    id: "create_social_draft",
    name: "Draft a social post",
    description:
      "Create a draft social_posts row (Facebook / Instagram / YouTube / Google Business). Never publishes.",
    inputSchema: createSocialDraftSchema,
    resultCardKind: "social_draft",
    rolesAllowed: WRITE_ROLES,
    audit: true,
    readinessCheck: alwaysReady,
    handler: createSocialDraft as ToolEntry["handler"],
  },
  {
    id: "create_email_draft",
    name: "Draft an email / newsletter",
    description:
      "Create a draft email_campaigns row. Never sends. Live send requires ALLOW_LIVE_EMAIL_SEND.",
    inputSchema: createEmailDraftSchema,
    resultCardKind: "email_draft",
    rolesAllowed: WRITE_ROLES,
    audit: true,
    readinessCheck: alwaysReady,
    handler: createEmailDraft as ToolEntry["handler"],
  },
  {
    id: "create_calendar_item",
    name: "Add a calendar item",
    description: "Insert a calendar_items row (planning row, not an external event).",
    inputSchema: createCalendarItemSchema,
    resultCardKind: "calendar_item",
    rolesAllowed: WRITE_ROLES,
    audit: true,
    readinessCheck: alwaysReady,
    handler: createCalendarItem as ToolEntry["handler"],
  },
  {
    id: "create_knowledge_note",
    name: "Save a knowledge note",
    description:
      "Insert a knowledge_items row in an existing or auto-created Atlas Notes collection.",
    inputSchema: createKnowledgeNoteSchema,
    resultCardKind: "knowledge_note",
    rolesAllowed: WRITE_ROLES,
    audit: true,
    readinessCheck: alwaysReady,
    handler: createKnowledgeNote as ToolEntry["handler"],
  },
  {
    id: "search_knowledge",
    name: "Search knowledge",
    description:
      "Keyword search over the user's knowledge_items. Returns top hits with excerpts.",
    inputSchema: searchKnowledgeSchema,
    resultCardKind: "knowledge_results",
    rolesAllowed: ALL_ROLES,
    audit: false,
    readinessCheck: alwaysReady,
    handler: searchKnowledge as ToolEntry["handler"],
  },
  {
    id: "retrieve_asset",
    name: "Retrieve an asset",
    description:
      "Keyword search over generated_media (images Atlas / Fal made). Returns up to 5.",
    inputSchema: retrieveAssetSchema,
    resultCardKind: "asset_result",
    rolesAllowed: ALL_ROLES,
    audit: false,
    readinessCheck: alwaysReady,
    handler: retrieveAsset as ToolEntry["handler"],
  },
  {
    id: "attach_asset_to_social_draft",
    name: "Attach an asset to a social draft",
    description:
      "Update a social_posts row to reference an asset_id in metadata.assets[]. Draft must already exist.",
    inputSchema: attachAssetToSocialDraftSchema,
    resultCardKind: "asset_attached",
    rolesAllowed: WRITE_ROLES,
    audit: true,
    readinessCheck: alwaysReady,
    handler: attachAssetToSocialDraft as ToolEntry["handler"],
  },
  {
    id: "check_provider_status",
    name: "Check AI provider status",
    description:
      "Returns which AI providers are configured / enabled (env var NAMES only, never values).",
    inputSchema: checkProviderStatusSchema,
    resultCardKind: "provider_status",
    rolesAllowed: ALL_ROLES,
    audit: false,
    readinessCheck: alwaysReady,
    handler: checkProviderStatus as ToolEntry["handler"],
  },
  {
    id: "check_n8n_workflow_readiness",
    name: "Check n8n workflow readiness",
    description:
      "Returns which n8n webhook env vars are set (NAMES only). Does not call n8n.",
    inputSchema: checkN8nReadinessSchema,
    resultCardKind: "n8n_status",
    rolesAllowed: ALL_ROLES,
    audit: false,
    readinessCheck: alwaysReady,
    handler: checkN8nWorkflowReadiness as ToolEntry["handler"],
  },
  {
    id: "prepare_image_generation_prompt",
    name: "Prepare an image-generation prompt",
    description:
      "Compose a structured prompt + aspect ratio. NEVER calls the image provider in this sprint.",
    inputSchema: prepareImagePromptSchema,
    resultCardKind: "image_prompt",
    rolesAllowed: WRITE_ROLES,
    audit: false,
    readinessCheck: alwaysReady,
    handler: prepareImageGenerationPrompt as ToolEntry["handler"],
  },
  {
    id: "create_handoff_summary",
    name: "Create a handoff summary",
    description:
      "Produce a structured handoff card with bullets + a next step. No DB write.",
    inputSchema: createHandoffSummarySchema,
    resultCardKind: "handoff_summary",
    rolesAllowed: WRITE_ROLES,
    audit: false,
    readinessCheck: alwaysReady,
    handler: createHandoffSummary as ToolEntry["handler"],
  },
  {
    id: "explain_capabilities",
    name: "Explain Atlas capabilities",
    description:
      "Return a live snapshot of tools + providers + n8n + safety flags. Read-only.",
    inputSchema: explainCapabilitiesSchema,
    resultCardKind: "capability_snapshot",
    rolesAllowed: ALL_ROLES,
    audit: false,
    readinessCheck: alwaysReady,
    handler: explainCapabilities as ToolEntry["handler"],
  },
  {
    id: "check_mcp_connectors",
    name: "Check MCP connectors",
    description:
      "Snapshot of MCP connectors (owner-global L1 + per-user L2) plus live-action gating flags. NAMES only, never values.",
    inputSchema: checkMcpConnectorsSchema,
    resultCardKind: "connector_status",
    rolesAllowed: ALL_ROLES,
    audit: false,
    readinessCheck: alwaysReady,
    handler: checkMcpConnectors as ToolEntry["handler"],
  },
];

export function getToolEntry(id: string): ToolEntry | undefined {
  return TOOLS.find((t) => t.id === id);
}

// Marker so unused imports stay linted-out predictably.
export { envPresent };
