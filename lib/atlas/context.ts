// Knowledge retrieval context for the planner.
//
// Wraps `retrieveForAssistant` from lib/atlas/retrieval.ts and shapes the
// result into a compact block the planner LLM can use. Keeps the surface
// area small — we don't want the planner LLM to need a Supabase client
// directly; the chat route passes everything it needs as plain data.

import {
  renderKnowledgeBlock,
  retrieveForAssistant,
  type KnowledgeHit,
} from "@/lib/atlas/retrieval";

export interface KnowledgeContext {
  hits: KnowledgeHit[];
  block: string;
}

export async function buildKnowledgeContext(args: {
  assistant_id: string | null;
  message: string;
  limit?: number;
}): Promise<KnowledgeContext> {
  if (!args.assistant_id) {
    return { hits: [], block: "" };
  }
  try {
    const hits = await retrieveForAssistant({
      assistant_id: args.assistant_id,
      message: args.message,
      limit: args.limit ?? 5,
    });
    return { hits, block: renderKnowledgeBlock(hits) };
  } catch (e) {
    // Never fail the planner because retrieval errored. Surface the empty
    // context and let the chat continue.
    console.error("buildKnowledgeContext failed", e);
    return { hits: [], block: "" };
  }
}
