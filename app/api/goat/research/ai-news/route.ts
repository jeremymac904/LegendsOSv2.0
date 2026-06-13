import { z } from "zod";

import { goatFail, goatLog, goatOk, readJson, withGoat, zodMessage } from "@/lib/goat/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const newsSchema = z.object({
  query: z.string().min(2).max(200).default("AI OR LLM OR Claude OR OpenAI OR Anthropic"),
  days: z.number().int().min(1).max(30).default(7),
  limit: z.number().int().min(1).max(20).default(8),
});

// research_ai_news — recent AI stories via the Hacker News Algolia API
// (free, keyless, reliable). Sorted by relevance within the time window.
export const POST = withGoat("/api/goat/research/ai-news", async (req, ctx) => {
  const raw = (await readJson(req)) ?? {};
  const parsed = newsSchema.safeParse(raw);
  if (!parsed.success) {
    return goatFail(ctx, 400, "bad_request", zodMessage(parsed.error.issues));
  }
  const { query, days, limit } = parsed.data;

  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  const url = new URL("https://hn.algolia.com/api/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("numericFilters", `created_at_i>${cutoff}`);
  url.searchParams.set("hitsPerPage", String(limit));

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (err) {
    goatLog("error", ctx, "hn_unreachable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return goatFail(ctx, 502, "news_source_unreachable", "Could not reach the news index.");
  }
  if (!res.ok) {
    return goatFail(ctx, 502, "news_source_error", `News index returned ${res.status}.`);
  }

  const body = await res.json();
  const results = (body.hits ?? []).map((h: any) => ({
    title: h.title,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    points: h.points ?? 0,
    comments: h.num_comments ?? 0,
    created_at: h.created_at,
    discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
  }));
  return goatOk(ctx, { results, query, window_days: days });
});
