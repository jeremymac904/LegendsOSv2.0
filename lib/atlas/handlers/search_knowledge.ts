// Keyword search across the caller's knowledge_items.
//
// Uses the same scoring approach as lib/atlas/retrieval.ts but scoped to the
// CALLER's items (via the RLS-respecting client) rather than to an assistant
// mapping. The handler returns a KnowledgeResultsCard the chat UI can render
// inline.

import type { KnowledgeResultsCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  SearchKnowledgeInput,
} from "@/lib/atlas/registry";

const TOOL_ID = "search_knowledge";

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "so",
  "that", "the", "this", "to", "us", "was", "we", "what", "when", "where",
  "which", "who", "why", "with", "you", "your",
  "please", "hello", "hi", "hey", "thanks", "tell", "give",
]);

function keywords(query: string, maxTerms = 8): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return Array.from(new Set(words)).slice(0, maxTerms);
}

function makeExcerpt(content: string | null, focus: string): string {
  if (!content) return "";
  const flat = content.replace(/\s+/g, " ").trim();
  const MAX = 280;
  if (!focus) return flat.slice(0, MAX);
  const idx = flat.toLowerCase().indexOf(focus.toLowerCase());
  if (idx < 0) return flat.slice(0, MAX);
  const start = Math.max(0, idx - 80);
  return (start > 0 ? "…" : "") + flat.slice(start, start + MAX);
}

export async function searchKnowledge(
  input: SearchKnowledgeInput,
  ctx: AtlasToolContext
): Promise<AtlasToolResult<KnowledgeResultsCard>> {
  const { profile, supabase } = ctx;
  const limit = input.limit ?? 5;
  const kws = keywords(input.query);

  let rows: Array<{
    id: string;
    collection_id: string;
    title: string;
    content: string | null;
    metadata: Record<string, unknown> | null;
  }> = [];

  if (kws.length === 0) {
    const { data } = await supabase
      .from("knowledge_items")
      .select("id,collection_id,title,content,metadata")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(limit);
    rows = (data ?? []) as typeof rows;
  } else {
    const orFilter = kws
      .flatMap((kw) => {
        const esc = kw.replace(/[%_]/g, "");
        return [`title.ilike.%${esc}%`, `content.ilike.%${esc}%`];
      })
      .join(",");
    const { data } = await supabase
      .from("knowledge_items")
      .select("id,collection_id,title,content,metadata")
      .eq("user_id", profile.id)
      .or(orFilter)
      .limit(40);
    rows = (data ?? []) as typeof rows;
  }

  const scored = rows
    .map((r) => {
      let score = 0;
      const t = (r.title ?? "").toLowerCase();
      const c = (r.content ?? "").toLowerCase();
      for (const kw of kws) {
        const titleHits = (t.match(new RegExp(kw, "g")) ?? []).length;
        const contentHits = (c.match(new RegExp(kw, "g")) ?? []).length;
        score += titleHits * 3 + contentHits;
      }
      const md = (r.metadata ?? {}) as { source_path?: string };
      return {
        item_id: r.id,
        collection_id: r.collection_id,
        title: r.title,
        excerpt: makeExcerpt(r.content, kws[0] ?? ""),
        source_path: md.source_path ?? null,
        score: kws.length === 0 ? 1 : score,
      };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Link the card's "Open" button to the top-match's collection so clicking
  // the chip drops the user straight onto the source document's page. When
  // there are no hits we fall back to the knowledge index.
  const topHit = scored[0];
  const cardLink = topHit
    ? `/knowledge/${topHit.collection_id}`
    : "/knowledge";
  const card: KnowledgeResultsCard = {
    kind: "knowledge_results",
    tool_id: TOOL_ID,
    title:
      scored.length > 0
        ? `${scored.length} knowledge hit${scored.length === 1 ? "" : "s"}`
        : "No knowledge hits",
    summary:
      scored.length > 0
        ? `Top match: "${scored[0]?.title ?? ""}".`
        : "Nothing matched. Try a more specific query.",
    link: cardLink,
    hits: scored,
  };
  const message =
    scored.length > 0
      ? `I found ${scored.length} match${scored.length === 1 ? "" : "es"} in your knowledge — top result: "${scored[0]?.title ?? ""}".`
      : "I didn't find anything in your knowledge for that query. Try more specific words, or open Knowledge to browse.";
  return { ok: true, card, message };
}
