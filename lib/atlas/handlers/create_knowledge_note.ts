// Insert a knowledge_items row, auto-creating the "Atlas Notes" collection
// when none exists. The hint allows the planner to ask Atlas to land the note
// inside a specific collection ("save a note about X in Refi Playbook").

import type { KnowledgeNoteCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  CreateKnowledgeNoteInput,
} from "@/lib/atlas/registry";

const TOOL_ID = "create_knowledge_note";

export async function createKnowledgeNote(
  input: CreateKnowledgeNoteInput,
  ctx: AtlasToolContext
): Promise<AtlasToolResult<KnowledgeNoteCard>> {
  const { profile, supabase } = ctx;
  const { title, body, collection_hint } = input;

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
        description:
          "Notes Atlas captured for you. Edit or move at any time.",
        visibility: "private",
        metadata: { source: "atlas_tool", auto_created: true },
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return {
        ok: false,
        error: "collection_create_failed",
        message:
          createErr?.message ??
          "I couldn't create your Atlas Notes collection — try again in a moment.",
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
        tool_id: TOOL_ID,
        collection_hint: collection_hint ?? null,
      },
    })
    .select("id,title,collection_id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: "insert_failed",
      message:
        error?.message ??
        "I couldn't save your knowledge note. Try again or open Knowledge to add it manually.",
    };
  }

  const link = `/knowledge/${data.collection_id}`;
  // Look up the destination collection name so the chat bubble can name it.
  // Best-effort — we already wrote the note. If the lookup fails the message
  // still reads cleanly with a generic "knowledge collection" phrase.
  let collectionName = "your knowledge collection";
  try {
    const { data: coll } = await supabase
      .from("knowledge_collections")
      .select("name")
      .eq("id", data.collection_id)
      .maybeSingle();
    if (coll?.name && typeof coll.name === "string") {
      collectionName = `your "${coll.name}" collection`;
    }
  } catch {
    // ignore — keep the generic fallback
  }
  const card: KnowledgeNoteCard = {
    kind: "knowledge_note",
    tool_id: TOOL_ID,
    title: data.title,
    summary: "Saved as a note in your knowledge collection.",
    link,
    item_id: data.id,
    collection_id: data.collection_id,
  };
  const message = [
    `I added the note "${data.title}" to ${collectionName}.`,
    `Open it: ${link}`,
  ].join(" ");
  return { ok: true, card, message };
}
