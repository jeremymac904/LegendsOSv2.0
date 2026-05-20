// Atlas tool result card shapes.
//
// Each registered handler returns a card. Cards are the contract between the
// runtime executor and the AtlasShell UI — adding a new tool kind means
// declaring a new card shape here and registering a renderer in AtlasShell.
//
// Keep this file dependency-free (only imports types) so it can be imported
// from both server (executor, route) and client (AtlasShell) without dragging
// in supabase / nextjs / node.
//
// Honest-action-wording rule: every "title" / "summary" string MUST describe
// what actually happened. Never say "Posted" / "Sent" / "Published" — Atlas
// only writes drafts.

import type { AtlasCapabilitySnapshot } from "@/lib/atlas/toolRouter";

export type AtlasCardKind =
  | "social_draft"
  | "email_draft"
  | "calendar_item"
  | "knowledge_results"
  | "knowledge_note"
  | "asset_result"
  | "asset_attached"
  | "provider_status"
  | "n8n_status"
  | "image_prompt"
  | "handoff_summary"
  | "capability_snapshot"
  | "chat";

export interface AtlasCardBase {
  kind: AtlasCardKind;
  title: string;
  // Short one-line summary the chip displays under the title.
  summary: string;
  // Optional deep-link the chip's "Open" button goes to.
  link?: string;
  // Tool id that produced the card (so the chip can show the tool id chip).
  tool_id: string;
}

export interface SocialDraftCard extends AtlasCardBase {
  kind: "social_draft";
  item_id: string;
  channels: string[];
}

export interface EmailDraftCard extends AtlasCardBase {
  kind: "email_draft";
  item_id: string;
  subject: string;
}

export interface CalendarItemCard extends AtlasCardBase {
  kind: "calendar_item";
  item_id: string;
  starts_at: string;
}

export interface KnowledgeNoteCard extends AtlasCardBase {
  kind: "knowledge_note";
  item_id: string;
  collection_id: string;
}

export interface KnowledgeResultsCard extends AtlasCardBase {
  kind: "knowledge_results";
  hits: {
    item_id: string;
    collection_id: string;
    title: string;
    excerpt: string;
    source_path: string | null;
    score: number;
  }[];
}

export interface AssetResultCard extends AtlasCardBase {
  kind: "asset_result";
  hits: {
    item_id: string;
    title: string | null;
    prompt: string | null;
    preview_url: string | null;
    storage_bucket: string | null;
    storage_path: string | null;
    aspect_ratio: string | null;
  }[];
}

export interface AssetAttachedCard extends AtlasCardBase {
  kind: "asset_attached";
  social_post_id: string;
  asset_id: string;
}

export interface ProviderStatusCard extends AtlasCardBase {
  kind: "provider_status";
  providers: {
    id: string;
    label: string;
    status: "ready" | "configured" | "disabled" | "missing";
    env_var: string;
    next_action: string | null;
  }[];
}

export interface N8nStatusCard extends AtlasCardBase {
  kind: "n8n_status";
  configured: boolean;
  base_url_present: boolean;
  webhooks: {
    name: string;
    env_var: string;
    present: boolean;
  }[];
}

export interface ImagePromptCard extends AtlasCardBase {
  kind: "image_prompt";
  prompt: string;
  aspect_ratio: string;
  notes: string;
  // True only when ALLOW_LIVE_IMAGE_GEN is on (we never set this to true
  // in this sprint, even when the flag is on — handler stays read-only).
  live_image_gen_available: boolean;
}

export interface HandoffSummaryCard extends AtlasCardBase {
  kind: "handoff_summary";
  bullets: string[];
  next_step: string;
}

// Backwards-compat: the existing explain_capabilities tool returns a richer
// snapshot already typed in toolRouter.ts. Surface it as a card kind so the
// AtlasShell renderer has a single switch table.
export interface CapabilitySnapshotCard extends AtlasCardBase {
  kind: "capability_snapshot";
  snapshot: AtlasCapabilitySnapshot;
}

// Chat fallthrough — no tool ran, the planner asked for normal AI chat.
export interface ChatCard extends AtlasCardBase {
  kind: "chat";
}

export type AtlasCard =
  | SocialDraftCard
  | EmailDraftCard
  | CalendarItemCard
  | KnowledgeNoteCard
  | KnowledgeResultsCard
  | AssetResultCard
  | AssetAttachedCard
  | ProviderStatusCard
  | N8nStatusCard
  | ImagePromptCard
  | HandoffSummaryCard
  | CapabilitySnapshotCard
  | ChatCard;
