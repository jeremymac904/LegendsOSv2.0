import { getSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Simple keyword-based retrieval for Atlas.
 *
 * Given the message a user just sent and an assistant_id, return the top-N
 * knowledge_items from the collections that assistant has access to. No
 * embeddings yet — just a keyword OR-match across `title` and `content`
 * via Postgres `ilike` with the words from the message, scored client-side
 * by hit count. Good enough as a v0 grounding layer.
 *
 * The service-role client is used so we can read across user-owned rows
 * regardless of who is signed in; the actual `chat_messages` write still
 * uses the user's RLS-respecting client, so audit + ownership are intact.
 */

export interface KnowledgeHit {
  item_id: string;
  collection_id: string;
  title: string;
  excerpt: string;
  score: number;
  source_path: string | null;
}

// Stopwords trimmed from the user message before keyword extraction. Tiny
// list — we don't need to over-engineer this for v0.
const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "so",
  "that", "the", "this", "to", "us", "was", "we", "what", "when", "where",
  "which", "who", "why", "with", "you", "your",
  "please", "hello", "hi", "hey", "thanks", "tell", "give",
]);

function extractKeywords(message: string, maxTerms = 8): string[] {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.keys()]
    .sort((a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b))
    .slice(0, maxTerms);
}

interface RawItem {
  id: string;
  collection_id: string;
  title: string;
  content: string | null;
}

export async function retrieveForAssistant(args: {
  assistant_id: string | null;
  message: string;
  limit?: number;
}): Promise<KnowledgeHit[]> {
  const { assistant_id, message } = args;
  const limit = args.limit ?? 5;
  if (!assistant_id || !message.trim()) return [];

  const service = getSupabaseServiceClient();

  // 1) Which collections is this assistant wired to?
  const { data: access } = await service
    .from("assistant_knowledge_access")
    .select("collection_id")
    .eq("assistant_id", assistant_id);
  const collectionIds = (access ?? []).map((a) => a.collection_id);
  if (collectionIds.length === 0) return [];

  // 2) Extract keywords; if none, fall back to most-recent items.
  const keywords = extractKeywords(message);
  if (keywords.length === 0) {
    const { data } = await service
      .from("knowledge_items")
      .select("id,collection_id,title,content,metadata")
      .in("collection_id", collectionIds)
      .order("updated_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((row) => ({
      item_id: row.id,
      collection_id: row.collection_id,
      title: row.title,
      excerpt: makeExcerpt(row.content, ""),
      score: 1,
      source_path:
        (row.metadata as { source_path?: string } | null)?.source_path ?? null,
    }));
  }

  // 3) ilike OR-match across title and content (top-level — Postgres builds
  // an OR clause per keyword AND ALSO over both columns). We over-fetch a
  // bit so we can score and trim client-side.
  const orFilter = keywords
    .flatMap((kw) => {
      const esc = kw.replace(/[%_]/g, ""); // strip ilike specials
      return [`title.ilike.%${esc}%`, `content.ilike.%${esc}%`];
    })
    .join(",");
  const { data: rows } = await service
    .from("knowledge_items")
    .select("id,collection_id,title,content,metadata")
    .in("collection_id", collectionIds)
    .or(orFilter)
    .limit(50);

  const items = (rows ?? []) as (RawItem & { metadata: Record<string, unknown> | null })[];

  // 4) Score by keyword hit count across title + content.
  const scored = items.map((r) => {
    let score = 0;
    const t = (r.title ?? "").toLowerCase();
    const c = (r.content ?? "").toLowerCase();
    for (const kw of keywords) {
      const titleHits = countOccurrences(t, kw);
      const contentHits = countOccurrences(c, kw);
      // Title hits weighted 3x, content hits 1x.
      score += titleHits * 3 + contentHits;
    }
    return {
      item_id: r.id,
      collection_id: r.collection_id,
      title: r.title,
      excerpt: makeExcerpt(r.content, keywords[0]),
      score,
      source_path:
        (r.metadata as { source_path?: string } | null)?.source_path ?? null,
    };
  });

  return scored
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let i = 0;
  let count = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count++;
    i += needle.length;
  }
  return count;
}

function makeExcerpt(content: string | null, focus: string): string {
  if (!content) return "";
  const flat = content.replace(/\s+/g, " ").trim();
  const MAX = 360;
  if (!focus) return flat.slice(0, MAX);
  const idx = flat.toLowerCase().indexOf(focus.toLowerCase());
  if (idx < 0) return flat.slice(0, MAX);
  const start = Math.max(0, idx - 80);
  return (start > 0 ? "…" : "") + flat.slice(start, start + MAX);
}

/**
 * Render hits as a system-prompt addendum. Compact so we don't blow the
 * token budget on small free-tier models.
 */
export function renderKnowledgeBlock(hits: KnowledgeHit[]): string {
  if (hits.length === 0) return "";
  const lines: string[] = [
    "",
    "## Knowledge sources",
    "Use the snippets below as authoritative source material when relevant. If a snippet contradicts the user, prefer the snippet and cite the source by title.",
    "",
  ];
  hits.forEach((h, i) => {
    lines.push(`### ${i + 1}. ${h.title}`);
    if (h.source_path) lines.push(`_source: ${h.source_path}_`);
    lines.push(h.excerpt);
    lines.push("");
  });
  return lines.join("\n");
}
