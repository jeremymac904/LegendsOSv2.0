// Atlas tool router — translates a detected intent into a database write
// (social_posts / email_campaigns / calendar_items) using the caller's
// RLS-respecting Supabase client. Every successful tool call is mirrored
// into audit_logs via the existing recordAudit helper so owners can see
// exactly what Atlas did on their behalf.
//
// Important: we trust existing tables and existing column names. We do NOT
// add migrations from here. If a row insert fails for any reason, we surface
// the error and the chat route falls back to normal AI chat.
import { getN8nConfigState } from "@/lib/automation/n8n";
import {
  triggerWorkflow,
  type TriggerResult,
} from "@/lib/automation/n8n-bridge";
import { getAIProviderStatuses, getServerEnv } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
import type { AtlasTriggerAutomationPayload } from "@/lib/atlas/types";
import type { Profile, SocialChannel } from "@/types/database";

import type { AtlasIntent } from "./intentDetection";

export type AtlasToolKind =
  | "create_social"
  | "create_email"
  | "create_calendar"
  | "explain_capabilities"
  | "create_knowledge_note"
  | "trigger_automation";

export interface AtlasCapabilityProvider {
  id: "openrouter" | "deepseek" | "nvidia" | "fal" | "huggingface";
  label: string;
  status: "ready" | "configured" | "disabled" | "missing";
  env_var: string;
  next_action: string | null;
}

export interface AtlasCapabilityAutomation {
  n8n_configured: boolean;
  n8n_base_url_present: boolean;
  social_webhook: boolean;
  email_webhook: boolean;
}

export interface AtlasCapabilitySafety {
  live_social_publish: boolean;
  live_email_send: boolean;
  paid_text_generation: boolean;
  paid_image_generation: boolean;
}

export interface AtlasCapabilitySnapshot {
  tools: { id: AtlasToolKind; label: string; description: string }[];
  providers: AtlasCapabilityProvider[];
  automation: AtlasCapabilityAutomation;
  safety: AtlasCapabilitySafety;
}

export interface AtlasToolSuccess {
  ok: true;
  kind: AtlasToolKind;
  itemId: string;
  link: string;
  summary: string;
  // Short structured title for the result chip (so the UI can show
  // "Drafted: <title>" without slicing the long human-readable summary).
  title: string | null;
  // Optional structured payload — currently only populated by the
  // `explain_capabilities` tool so the chat UI can render a structured
  // capability card instead of plain text.
  capabilities?: AtlasCapabilitySnapshot;
  // Optional structured payload for the `trigger_automation` tool so the
  // chat UI can render the workflow's run state directly.
  trigger_automation?: AtlasTriggerAutomationPayload;
}

export interface AtlasToolFailure {
  ok: false;
  kind: AtlasToolKind | "none";
  error: string;
  message: string;
}

export type AtlasToolResult = AtlasToolSuccess | AtlasToolFailure;

// Coarse write gate — same idea as the rest of the app. Viewers don't get to
// trigger Atlas writes. Everything else (owner/admin/loan_officer/processor/
// marketing) can drive tool calls.
export function canRunAtlasTools(profile: Profile | null): boolean {
  if (!profile) return false;
  return profile.role !== "viewer";
}

// Build a plain-English capability snapshot from the live env. Never
// includes secrets or env var VALUES — only NAMES and human-friendly
// status copy. Safe to render directly in the chat UI.
export function buildCapabilitySnapshot(): AtlasCapabilitySnapshot {
  const env = getServerEnv();
  const statuses = getAIProviderStatuses();
  const n8n = getN8nConfigState();
  const providers: AtlasCapabilityProvider[] = statuses.map((p) => {
    let status: AtlasCapabilityProvider["status"];
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
  return {
    tools: [
      {
        id: "create_social",
        label: "Draft a social post",
        description: "Insert a draft into Social Studio (no live publishing).",
      },
      {
        id: "create_email",
        label: "Draft a newsletter",
        description: "Insert a draft into Email Studio (no live sending).",
      },
      {
        id: "create_calendar",
        label: "Add a calendar item",
        description: "Insert a planning row into Calendar.",
      },
      {
        id: "explain_capabilities",
        label: "Explain what Atlas can do",
        description:
          "Show this list and the live env / connector readiness state.",
      },
    ],
    providers,
    automation: {
      n8n_configured: n8n.configured,
      n8n_base_url_present: n8n.base_url_present,
      social_webhook: Boolean(env.N8N_WEBHOOKS.social_publish),
      email_webhook: Boolean(env.N8N_WEBHOOKS.email_send),
    },
    safety: {
      live_social_publish: env.SAFETY.allowLiveSocialPublish,
      live_email_send: env.SAFETY.allowLiveEmailSend,
      paid_text_generation: env.SAFETY.allowPaidTextGeneration,
      paid_image_generation: env.SAFETY.allowPaidImageGeneration,
    },
  };
}

// Render the snapshot as a single chat message body. Uses plain prose
// + bullets so it reads naturally without markdown rendering (the chat
// UI shows raw text). Lists missing env vars by NAME, never by value.
export function renderCapabilityMessage(snap: AtlasCapabilitySnapshot): string {
  const lines: string[] = [];
  lines.push(
    "I'm Atlas — the orchestrator for LegendsOS. Here's what I can do right now:"
  );
  lines.push("");
  lines.push("Tools (deterministic, no AI cost):");
  for (const t of snap.tools) {
    lines.push(`• ${t.label} — ${t.description}`);
  }
  lines.push("");
  lines.push("AI providers (chat + image generation):");
  for (const p of snap.providers) {
    if (p.status === "ready") {
      lines.push(`• ${p.label} — ready.`);
    } else if (p.status === "disabled") {
      lines.push(
        `• ${p.label} — configured but disabled by the owner. ${p.next_action ?? ""}`
      );
    } else {
      lines.push(`• ${p.label} — not configured. ${p.next_action ?? ""}`);
    }
  }
  lines.push("");
  lines.push("Automation (n8n outbound):");
  if (snap.automation.n8n_configured) {
    const parts: string[] = [];
    if (snap.automation.social_webhook) parts.push("social publish webhook");
    if (snap.automation.email_webhook) parts.push("email send webhook");
    lines.push(
      `• n8n connected (${parts.length > 0 ? parts.join(", ") : "no specific webhooks wired"}).`
    );
  } else if (snap.automation.n8n_base_url_present) {
    lines.push(
      "• n8n base URL present but no webhook URLs are set. Set N8N_WEBHOOK_SOCIAL_PUBLISH and / or N8N_WEBHOOK_EMAIL_SEND in Netlify env to enable outbound dispatch."
    );
  } else {
    lines.push(
      "• n8n not configured. Set N8N_BASE_URL plus the matching N8N_WEBHOOK_* URLs in Netlify env."
    );
  }
  lines.push("");
  lines.push("Safety flags (owner-controlled):");
  lines.push(
    `• Live social publish: ${snap.safety.live_social_publish ? "ENABLED" : "off (drafts only)"}.`
  );
  lines.push(
    `• Live email send: ${snap.safety.live_email_send ? "ENABLED" : "off (drafts only)"}.`
  );
  lines.push(
    `• Paid text generation: ${snap.safety.paid_text_generation ? "enabled" : "off"}.`
  );
  lines.push(
    `• Paid image generation: ${snap.safety.paid_image_generation ? "enabled" : "off"}.`
  );
  lines.push("");
  lines.push(
    "What I can't do: send anything live without Jeremy flipping the matching ALLOW_LIVE_* flag, and call any AI provider whose env var is missing or whose enable flag is off."
  );
  return lines.join("\n");
}

export async function runAtlasTool(
  intent: AtlasIntent,
  profile: Profile
): Promise<AtlasToolResult> {
  const supabase = getSupabaseServerClient();

  if (intent.kind === "trigger_automation") {
    const hint = intent.extracted.workflow_hint;
    let triggered: TriggerResult;
    try {
      triggered = await triggerWorkflow(hint, { source: "atlas_chat" });
    } catch (e) {
      triggered = {
        status: "failed",
        workflow_id: hint,
        workflow_label: null,
        message: e instanceof Error ? e.message : "dispatch failed",
      };
    }
    // Always audit — including stub / not_configured so the owner sees
    // every dispatch attempt. We never block the response on this.
    try {
      await recordAudit({
        actor: profile,
        action: "atlas_tool_call",
        target_type: "atlas_automation",
        target_id: triggered.workflow_id,
        metadata: {
          kind: "trigger_automation",
          status: triggered.status,
          execution_id: triggered.execution_id ?? null,
          hint,
        },
      });
    } catch {
      // never block — audit failure is non-fatal here
    }
    const payload: AtlasTriggerAutomationPayload = {
      workflow_id: triggered.workflow_id,
      workflow_label: triggered.workflow_label ?? null,
      execution_id: triggered.execution_id ?? null,
      status: triggered.status,
      message: triggered.message ?? null,
    };
    const summary =
      triggered.status === "not_configured"
        ? `Automation "${hint}" is not configured.`
        : triggered.status === "stub"
        ? `Automation "${triggered.workflow_label ?? hint}" is gated by ALLOW_LIVE_*.`
        : triggered.status === "failed"
        ? `Automation "${triggered.workflow_label ?? hint}" failed to dispatch.`
        : `Automation "${triggered.workflow_label ?? hint}" ${triggered.status}.`;
    return {
      ok: true,
      kind: "trigger_automation",
      itemId: triggered.workflow_id,
      link: "/settings",
      summary,
      title: triggered.workflow_label ?? hint,
      trigger_automation: payload,
    };
  }

  if (intent.kind === "explain_capabilities") {
    const snap = buildCapabilitySnapshot();
    // Best-effort audit — never block the response on this.
    try {
      await recordAudit({
        actor: profile,
        action: "atlas_tool_call",
        target_type: "atlas",
        target_id: null,
        metadata: { kind: "explain_capabilities" },
      });
    } catch {
      // swallow — informational tool must always answer
    }
    return {
      ok: true,
      kind: "explain_capabilities",
      itemId: "capabilities",
      link: "/settings",
      summary: "Capability snapshot rendered",
      title: "Atlas capabilities",
      capabilities: snap,
    };
  }

  if (intent.kind === "create_social") {
    const { title, body, channels } = intent.extracted;
    const { data, error } = await supabase
      .from("social_posts")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        title: title ?? null,
        body,
        channels: channels as SocialChannel[],
        status: "draft",
        metadata: { source: "atlas_tool" },
      })
      .select("id,title,body,channels")
      .single();
    if (error || !data) {
      return {
        ok: false,
        kind: "create_social",
        error: "insert_failed",
        message: error?.message ?? "social insert failed",
      };
    }
    await recordAudit({
      actor: profile,
      action: "atlas_tool_call",
      target_type: "social_posts",
      target_id: data.id,
      metadata: { kind: "create_social", channels },
    });
    const summary = title
      ? `Social draft "${title}" on ${channels.join(", ")}`
      : `Social draft on ${channels.join(", ")}`;
    return {
      ok: true,
      kind: "create_social",
      itemId: data.id,
      link: `/social/${data.id}`,
      summary,
      title: title ?? null,
    };
  }

  if (intent.kind === "create_email") {
    const { subject, body } = intent.extracted;
    const { data, error } = await supabase
      .from("email_campaigns")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        subject,
        body_text: body,
        body_html: null,
        status: "draft",
        metadata: { source: "atlas_tool" },
      })
      .select("id,subject")
      .single();
    if (error || !data) {
      return {
        ok: false,
        kind: "create_email",
        error: "insert_failed",
        message: error?.message ?? "email insert failed",
      };
    }
    await recordAudit({
      actor: profile,
      action: "atlas_tool_call",
      target_type: "email_campaigns",
      target_id: data.id,
      metadata: { kind: "create_email" },
    });
    return {
      ok: true,
      kind: "create_email",
      itemId: data.id,
      link: `/email/${data.id}`,
      summary: `Newsletter draft "${data.subject}"`,
      title: data.subject ?? null,
    };
  }

  if (intent.kind === "create_knowledge_note") {
    const { title, body, collection_hint } = intent.extracted;
    // Knowledge items belong to a collection. Find one the caller owns —
    // prefer a name match against `collection_hint`, otherwise fall back to
    // any private collection the user already has, otherwise auto-create a
    // default "Atlas Notes" collection for this user. This keeps the tool
    // call a single round-trip from the user's perspective.
    let collectionId: string | null = null;

    if (collection_hint) {
      const { data: hinted } = await supabase
        .from("knowledge_collections")
        .select("id")
        .eq("user_id", profile.id)
        .ilike("name", collection_hint)
        .limit(1)
        .maybeSingle();
      if (hinted?.id) collectionId = hinted.id;
    }

    if (!collectionId) {
      const { data: anyOwned } = await supabase
        .from("knowledge_collections")
        .select("id,name")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: true })
        .limit(50);
      const atlasNotes = (anyOwned ?? []).find(
        (c) => (c.name ?? "").toLowerCase() === "atlas notes"
      );
      if (atlasNotes?.id) {
        collectionId = atlasNotes.id;
      } else if ((anyOwned ?? []).length > 0) {
        collectionId = anyOwned![0].id;
      }
    }

    if (!collectionId) {
      const { data: created, error: createErr } = await supabase
        .from("knowledge_collections")
        .insert({
          user_id: profile.id,
          organization_id: profile.organization_id,
          name: "Atlas Notes",
          description: "Notes Atlas captured for you. Edit or move at any time.",
          visibility: "private",
          metadata: { source: "atlas_tool", auto_created: true },
        })
        .select("id")
        .single();
      if (createErr || !created) {
        return {
          ok: false,
          kind: "create_knowledge_note",
          error: "collection_create_failed",
          message:
            createErr?.message ??
            "Could not create the Atlas Notes collection — try again in a moment.",
        };
      }
      collectionId = created.id;
    }

    const { data, error } = await supabase
      .from("knowledge_items")
      .insert({
        collection_id: collectionId,
        user_id: profile.id,
        organization_id: profile.organization_id,
        title,
        content: body,
        source_type: "atlas_note",
        metadata: {
          source: "atlas_tool",
          collection_hint: collection_hint ?? null,
        },
      })
      .select("id,title,collection_id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        kind: "create_knowledge_note",
        error: "insert_failed",
        message: error?.message ?? "knowledge note insert failed",
      };
    }
    await recordAudit({
      actor: profile,
      action: "atlas_tool_call",
      target_type: "knowledge_items",
      target_id: data.id,
      metadata: {
        kind: "create_knowledge_note",
        collection_id: collectionId,
      },
    });
    return {
      ok: true,
      kind: "create_knowledge_note",
      itemId: data.id,
      link: `/knowledge/${collectionId}`,
      summary: `Knowledge note "${data.title}" saved`,
      title: data.title ?? null,
    };
  }

  if (intent.kind === "create_calendar") {
    const { title, starts_at, date_phrase } = intent.extracted;
    const { data, error } = await supabase
      .from("calendar_items")
      .insert({
        user_id: profile.id,
        organization_id: profile.organization_id,
        item_type: "team_event",
        title,
        starts_at,
        all_day: false,
        metadata: { source: "atlas_tool", date_phrase },
      })
      .select("id,title,starts_at")
      .single();
    if (error || !data) {
      return {
        ok: false,
        kind: "create_calendar",
        error: "insert_failed",
        message: error?.message ?? "calendar insert failed",
      };
    }
    await recordAudit({
      actor: profile,
      action: "atlas_tool_call",
      target_type: "calendar_items",
      target_id: data.id,
      metadata: { kind: "create_calendar", starts_at },
    });
    const when = new Date(starts_at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return {
      ok: true,
      kind: "create_calendar",
      itemId: data.id,
      // Use `?focus=<id>` so the calendar page can scroll-into-view and
      // highlight the new item. Also stamp `?month=YYYY-MM` so the grid
      // auto-navigates to the month the item was created in instead of
      // defaulting to today's month and silently dropping the focus.
      link: `/calendar?month=${new Date(starts_at)
        .toISOString()
        .slice(0, 7)}&focus=${data.id}`,
      summary: `Calendar item "${data.title}" on ${when}`,
      title: data.title ?? null,
    };
  }

  return {
    ok: false,
    kind: "none",
    error: "no_intent",
    message: "No actionable intent detected.",
  };
}
