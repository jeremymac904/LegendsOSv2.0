// Atlas tool router — translates a detected intent into a database write
// (social_posts / email_campaigns / calendar_items) using the caller's
// RLS-respecting Supabase client. Every successful tool call is mirrored
// into audit_logs via the existing recordAudit helper so owners can see
// exactly what Atlas did on their behalf.
//
// Important: we trust existing tables and existing column names. We do NOT
// add migrations from here. If a row insert fails for any reason, we surface
// the error and the chat route falls back to normal AI chat.
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
import type { Profile, SocialChannel } from "@/types/database";

import type { AtlasIntent } from "./intentDetection";

export type AtlasToolKind =
  | "create_social"
  | "create_email"
  | "create_calendar"
  | "create_knowledge_note";

export interface AtlasToolSuccess {
  ok: true;
  kind: AtlasToolKind;
  itemId: string;
  link: string;
  summary: string;
  // Short structured title for the result chip (so the UI can show
  // "Drafted: <title>" without slicing the long human-readable summary).
  title: string | null;
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

export async function runAtlasTool(
  intent: AtlasIntent,
  profile: Profile
): Promise<AtlasToolResult> {
  const supabase = getSupabaseServerClient();

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
      link: `/calendar?id=${data.id}`,
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
